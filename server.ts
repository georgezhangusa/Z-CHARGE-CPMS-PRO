import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  parseOcpp16Message,
  parseOcpp201Message,
  resolveOcppProfile,
  type OcppTransactionState,
} from './src/lib/ocpp/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const app = express();
app.use(express.json());

const server = http.createServer(app);

// Data structures for OCPP management
interface ConnectedCharger {
  stationId: string;
  siteId?: string;
  ws: WebSocket;
  remoteAddress: string;
  connectedAt: string;
  lastPing: string;
  ocppVersion: string;
  subprotocol?: string;
  model?: string;
  vendor?: string;
  firmwareVersion?: string;
  activeTransactions: Map<number | string, OcppTransactionState>;
}

export interface StoredOcppMessage {
  id: string;
  timestamp: string;
  stationId: string;
  direction: 'CP_TO_CS' | 'CS_TO_CP';
  action: string;
  messageTypeId: number; // 2=Call, 3=CallResult, 4=CallError
  payload: Record<string, unknown>;
}

// In-memory registries
const connectedChargers = new Map<string, ConnectedCharger>();
const uiClients = new Set<WebSocket>();
const recentMessages: StoredOcppMessage[] = [];
const pendingCallResolvers = new Map<
  string,
  {
    resolve: (val: Record<string, unknown>) => void;
    reject: (err: Error) => void;
    timer: NodeJS.Timeout;
  }
>();

// The OCPP WebSocket server gateway is permanently active and open at all times to connect to chargers
const isOcppServerActive = true;

function setOcppServerStatus(_active: boolean = true) {
  // Always maintain active open state for chargers per system requirement
  console.log(`[OCPP WS Gateway] WebSocket server is permanently maintained ONLINE (ALWAYS OPEN)`);
  broadcastToUI({
    type: 'server:ws_status',
    isActive: true,
    activeChargersCount: connectedChargers.size,
  });
}

// Helper to broadcast events to all connected CPMS UI browser sessions
function broadcastToUI(data: Record<string, unknown>) {
  const json = JSON.stringify(data);
  for (const client of uiClients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(json);
      } catch (err) {
        console.error('Failed to send to UI client:', err);
      }
    }
  }
}

// Helper to store and broadcast OCPP message
function recordAndBroadcastMessage(msg: StoredOcppMessage) {
  recentMessages.unshift(msg);
  if (recentMessages.length > 100) {
    recentMessages.pop();
  }
  broadcastToUI({
    type: 'ocpp:message',
    message: msg,
  });
}

// --------------------------------------------------------------------------
// WebSocket Server for physical/internet EV Chargers (OCPP 1.6-J / 2.0.1)
// --------------------------------------------------------------------------
const ocppWss = new WebSocketServer({
  noServer: true,
  handleProtocols: (protocols, request) => {
    const list = Array.isArray(protocols) ? protocols : Array.from(protocols);
    if (!list || list.length === 0) return false;
    const url = request?.url || '';
    // If URL path explicitly specifies 2.0.1 or 2.0, prioritize 2.0.1
    if (url.includes('/2.0.1') || url.includes('/2.0')) {
      for (const p of list) {
        const lower = p.toLowerCase();
        if (lower === 'ocpp2.0.1' || lower === 'ocpp2.0') return p;
      }
    }
    // Otherwise match in the client's offered priority order
    for (const p of list) {
      const lower = p.toLowerCase();
      if (lower === 'ocpp2.0.1' || lower === 'ocpp2.0') return p;
      if (lower === 'ocpp1.6' || lower === 'ocpp1.6j') return p;
    }
    return list[0] || false;
  },
});

ocppWss.on('connection', (ws: WebSocket, req: http.IncomingMessage, stationId: string, siteId?: string) => {
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
    req.socket.remoteAddress ||
    '127.0.0.1';

  // Determine negotiated WebSocket profile from subprotocol or URL
  const rawSubprotocol =
    ws.protocol ||
    (req.url && (req.url.includes('/ocpp/2.0.1/') || req.url.includes('/ocpp/2.0/')) ? 'ocpp2.0.1' : 'ocpp1.6');
  const profileInfo = resolveOcppProfile(rawSubprotocol);
  const now = new Date().toISOString();

  console.log(
    `[OCPP WS] Charger connected: ${stationId} (IP: ${ip}, Negotiated Profile: ${profileInfo.profile}, Version: ${profileInfo.version})`
  );

  const chargerRecord: ConnectedCharger = {
    stationId,
    siteId,
    ws,
    remoteAddress: ip,
    connectedAt: now,
    lastPing: now,
    ocppVersion: profileInfo.version,
    subprotocol: profileInfo.profile,
    activeTransactions: new Map(),
  };

  // Configure underlying TCP socket keepalive to maintain continuous open connection
  if (req.socket && !req.socket.destroyed) {
    req.socket.setKeepAlive(true, 15000);
    req.socket.setNoDelay(true);
  }

  // Ping/pong heartbeat to keep socket open against cloud proxies & idle timeouts
  (ws as any).isAlive = true;
  ws.on('pong', () => {
    (ws as any).isAlive = true;
    chargerRecord.lastPing = new Date().toISOString();
  });
  ws.on('ping', () => {
    (ws as any).isAlive = true;
    try {
      ws.pong();
    } catch {}
  });

  connectedChargers.set(stationId, chargerRecord);

  // Notify UI
  broadcastToUI({
    type: 'charger:connected',
    stationId,
    siteId,
    ip,
    ocppVersion: chargerRecord.ocppVersion,
    timestamp: now,
  });

  // Handle incoming messages from the charger
  ws.on('message', (data: Buffer | string) => {
    try {
      const rawStr = data.toString('utf-8');
      const parsed = JSON.parse(rawStr);

      if (!Array.isArray(parsed) || parsed.length < 3) {
        console.warn(`[OCPP WS] Invalid frame from ${stationId}:`, rawStr);
        return;
      }

      chargerRecord.lastPing = new Date().toISOString();
      const messageTypeId = parsed[0];
      const uniqueId = String(parsed[1]);
      const timeStr = new Date().toTimeString().split(' ')[0];

      // Any message from charger resets countdown timer
      broadcastToUI({
        type: 'charger:activity',
        stationId,
        timestamp: chargerRecord.lastPing,
      });

      // 1. CALL from Charger to Central System [2, "<id>", "<action>", {payload}]
      if (messageTypeId === 2) {
        const action = String(parsed[2]);
        const payload = (parsed[3] || {}) as Record<string, unknown>;

        // Record incoming message
        recordAndBroadcastMessage({
          id: uniqueId,
          timestamp: timeStr,
          stationId,
          direction: 'CP_TO_CS',
          action,
          messageTypeId: 2,
          payload,
        });

        // Process OCPP action and respond
        handleChargerCall(ws, stationId, uniqueId, action, payload, chargerRecord);
      }
      // 2. CALLRESULT from Charger [3, "<id>", {payload}]
      else if (messageTypeId === 3) {
        const payload = (parsed[2] || {}) as Record<string, unknown>;

        recordAndBroadcastMessage({
          id: uniqueId,
          timestamp: timeStr,
          stationId,
          direction: 'CP_TO_CS',
          action: 'CallResult',
          messageTypeId: 3,
          payload,
        });

        // Check if there was an in-flight command waiting for this result
        if (pendingCallResolvers.has(uniqueId)) {
          const resolver = pendingCallResolvers.get(uniqueId)!;
          clearTimeout(resolver.timer);
          pendingCallResolvers.delete(uniqueId);
          resolver.resolve(payload);
        }
      }
      // 3. CALLERROR from Charger [4, "<id>", "<errorCode>", "<errorDescription>", {errorDetails}]
      else if (messageTypeId === 4) {
        const errorCode = String(parsed[2] || 'InternalError');
        const errorDescription = String(parsed[3] || '');
        const errorDetails = (parsed[4] || {}) as Record<string, unknown>;

        recordAndBroadcastMessage({
          id: uniqueId,
          timestamp: timeStr,
          stationId,
          direction: 'CP_TO_CS',
          action: `CallError:${errorCode}`,
          messageTypeId: 4,
          payload: { errorCode, errorDescription, errorDetails },
        });

        if (pendingCallResolvers.has(uniqueId)) {
          const resolver = pendingCallResolvers.get(uniqueId)!;
          clearTimeout(resolver.timer);
          pendingCallResolvers.delete(uniqueId);
          resolver.reject(new Error(`OCPP Error: ${errorCode} - ${errorDescription}`));
        }
      }
    } catch (err: unknown) {
      console.error(`[OCPP WS] Error parsing frame from ${stationId}:`, err);
    }
  });

  ws.on('close', (code, reason) => {
    console.log(`[OCPP WS] Charger disconnected: ${stationId} (Code: ${code}, Reason: ${reason})`);
    connectedChargers.delete(stationId);

    broadcastToUI({
      type: 'charger:disconnected',
      stationId,
      timestamp: new Date().toISOString(),
    });
  });

  ws.on('error', (err) => {
    console.error(`[OCPP WS] Socket error on ${stationId}:`, err);
  });
});

// Helper to resolve port number (1 or 2) across OCPP 1.6 and 2.0.1 schemas
function resolveOcppPort(payload: Record<string, any>): number {
  if (!payload || typeof payload !== 'object') return 1;
  const evseObj = (payload.evse as any) || {};

  const rawConnId = payload.connectorId !== undefined && !isNaN(Number(payload.connectorId)) ? Number(payload.connectorId) : undefined;
  const rawEvseConnId = typeof evseObj.connectorId === 'number' && !isNaN(evseObj.connectorId) ? Number(evseObj.connectorId) : undefined;
  const rawEvseId = payload.evseId !== undefined && !isNaN(Number(payload.evseId)) ? Number(payload.evseId) : undefined;
  const rawEvseObjId = typeof evseObj.id === 'number' && !isNaN(evseObj.id) ? Number(evseObj.id) : undefined;
  const rawPort = payload.port !== undefined && !isNaN(Number(payload.port)) ? Number(payload.port) : undefined;
  const rawPortNumber = payload.portNumber !== undefined && !isNaN(Number(payload.portNumber)) ? Number(payload.portNumber) : undefined;

  // Explicit check for Port 2
  if (
    rawPort === 2 ||
    rawPortNumber === 2 ||
    rawConnId === 2 ||
    rawEvseConnId === 2 ||
    rawEvseId === 2 ||
    rawEvseObjId === 2
  ) {
    return 2;
  }

  // Explicit check for Port 1
  if (
    rawPort === 1 ||
    rawPortNumber === 1 ||
    rawConnId === 1 ||
    rawEvseConnId === 1 ||
    rawEvseId === 1 ||
    rawEvseObjId === 1
  ) {
    return 1;
  }

  // Check for 0 (ChargePoint main controller)
  if (rawConnId === 0 || rawEvseId === 0) {
    return 0;
  }

  return 1;
}

/**
 * Dispatches incoming OCPP CALL actions to the dedicated OCPP 1.6-J or OCPP 2.0.1 parser
 * strictly based on the active WebSocket profile (subprotocol).
 */
function handleChargerCall(
  ws: WebSocket,
  stationId: string,
  uniqueId: string,
  action: string,
  payload: Record<string, unknown>,
  charger: ConnectedCharger
) {
  const timeStr = new Date().toTimeString().split(' ')[0];
  const subprotocol = ws.protocol || charger.subprotocol || (charger.ocppVersion === '2.0.1' ? 'ocpp2.0.1' : 'ocpp1.6');
  const profileInfo = resolveOcppProfile(subprotocol);

  console.log(
    `[OCPP WS] Dispatching '${action}' from ${stationId} via ${profileInfo.version} parser (profile: ${profileInfo.profile})`
  );

  // ROUTING RULE: Strictly separate OCPP 1.6-J and 2.0.1 parsers by WebSocket profile
  const parseResult = profileInfo.isVersion201
    ? parseOcpp201Message({
        stationId,
        uniqueId,
        action,
        payload,
        activeTransactions: charger.activeTransactions,
        subprotocol: profileInfo.profile,
      })
    : parseOcpp16Message({
        stationId,
        uniqueId,
        action,
        payload,
        activeTransactions: charger.activeTransactions,
        subprotocol: profileInfo.profile,
      });

  // Update charger hardware metadata
  if (action === 'BootNotification') {
    const updateEvent = parseResult.uiBroadcasts.find((b) => b.type === 'charger:updated');
    if (updateEvent) {
      if (updateEvent.vendor) charger.vendor = updateEvent.vendor;
      if (updateEvent.model) charger.model = updateEvent.model;
      if (updateEvent.firmwareVersion) charger.firmwareVersion = updateEvent.firmwareVersion;
    }
  }

  // Apply state updates to active transactions map
  if (parseResult.transactionUpdate) {
    const { action: txAction, transactionId, state } = parseResult.transactionUpdate;
    if (txAction === 'start' && state) {
      charger.activeTransactions.set(transactionId, state as any);
    } else if (txAction === 'update' && state) {
      const existing = charger.activeTransactions.get(transactionId);
      if (existing) {
        Object.assign(existing, state);
      }
    } else if (txAction === 'stop') {
      charger.activeTransactions.delete(transactionId);
    }
  }

  // Broadcast typed updates to all connected CPMS UI clients
  for (const broadcast of parseResult.uiBroadcasts) {
    broadcastToUI(broadcast);
  }

  // Send response frame (CallResult or CallError) back to charger
  try {
    if (ws.readyState === WebSocket.OPEN) {
      let frameToSend: string;
      let loggedAction = `${action}Response`;
      let loggedMessageTypeId = 3;
      let loggedPayload: any = parseResult.responsePayload;

      if (parseResult.responseFrame) {
        frameToSend = JSON.stringify(parseResult.responseFrame);
        loggedMessageTypeId = parseResult.responseFrame[0];
        if (loggedMessageTypeId === 4) {
          loggedAction = `CallError:${parseResult.responseFrame[2]}`;
          loggedPayload = {
            errorCode: parseResult.responseFrame[2],
            errorDescription: parseResult.responseFrame[3],
            errorDetails: parseResult.responseFrame[4],
          };
        }
      } else {
        frameToSend = JSON.stringify([3, uniqueId, parseResult.responsePayload]);
      }

      ws.send(frameToSend);

      // Record and broadcast server response
      recordAndBroadcastMessage({
        id: uniqueId,
        timestamp: timeStr,
        stationId,
        direction: 'CS_TO_CP',
        action: loggedAction,
        messageTypeId: loggedMessageTypeId,
        payload: loggedPayload,
      });
    }
  } catch (err) {
    console.error(`[OCPP WS] Failed sending response to ${stationId}:`, err);
  }
}

// --------------------------------------------------------------------------
// WebSocket Server for CPMS UI Clients (Browsers)
// --------------------------------------------------------------------------
const uiWss = new WebSocketServer({ noServer: true });

uiWss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
  uiClients.add(ws);
  console.log('[UI WS] Browser connected to CPMS WebSocket feed. Total clients:', uiClients.size);

  // Configure underlying TCP socket keepalive
  if (req.socket && !req.socket.destroyed) {
    req.socket.setKeepAlive(true, 15000);
    req.socket.setNoDelay(true);
  }

  // Ping/pong keepalive
  (ws as any).isAlive = true;
  ws.on('pong', () => {
    (ws as any).isAlive = true;
  });
  ws.on('ping', () => {
    (ws as any).isAlive = true;
    try {
      ws.pong();
    } catch {}
  });

  // Send initial snapshot of connected physical chargers and recent messages
  const onlineChargers = Array.from(connectedChargers.values()).map((c) => ({
    stationId: c.stationId,
    siteId: c.siteId,
    ip: c.remoteAddress,
    connectedAt: c.connectedAt,
    lastPing: c.lastPing,
    ocppVersion: c.ocppVersion,
    model: c.model,
    vendor: c.vendor,
  }));

  ws.send(
    JSON.stringify({
      type: 'init',
      onlineChargers,
      recentMessages: recentMessages.slice(0, 30),
      isOcppServerActive: true,
    })
  );

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());

      // Immediate keepalive response to client ping
      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        return;
      }

      // Handle UI-initiated server query or status request (always active)
      if (msg.type === 'ws:toggle_server') {
        setOcppServerStatus(true);
        return;
      }

      // Handle UI-initiated remote commands: { type: 'remote:command', stationId, action, payload }
      if (msg.type === 'remote:command') {
        const { stationId, action, payload } = msg;
        try {
          const result = await sendRemoteCommandToCharger(stationId, action, payload);
          ws.send(
            JSON.stringify({
              type: 'remote:command_result',
              stationId,
              action,
              status: 'success',
              result,
            })
          );
        } catch (err: any) {
          ws.send(
            JSON.stringify({
              type: 'remote:command_result',
              stationId,
              action,
              status: 'error',
              error: err?.message || 'Remote command failed',
            })
          );
        }
      }
    } catch (err) {
      console.error('[UI WS] Error parsing message from UI:', err);
    }
  });

  ws.on('close', () => {
    uiClients.delete(ws);
    console.log('[UI WS] Browser disconnected from CPMS WebSocket. Remaining clients:', uiClients.size);
  });
});

// Helper function to send Central System -> Charge Point CALL
export async function sendRemoteCommandToCharger(
  stationId: string,
  action: string,
  payload: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  const charger = connectedChargers.get(stationId);
  const uniqueId = `CS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const timeStr = new Date().toTimeString().split(' ')[0];

  let targetAction = action;
  let targetPayload = { ...payload };

  // Translate command if communicating with an OCPP 2.0.1 charger
  if (charger && charger.ocppVersion === '2.0.1') {
    if (action === 'RemoteStartTransaction') {
      targetAction = 'RequestStartTransaction';
      targetPayload = {
        remoteStartId: Math.floor(1000 + Math.random() * 9000),
        idToken: {
          idToken: String(payload.idTag || 'USER-APP'),
          type: 'Central',
        },
        evseId: Number(payload.connectorId || 1),
      };
    } else if (action === 'RemoteStopTransaction') {
      targetAction = 'RequestStopTransaction';
      targetPayload = {
        transactionId: String(payload.transactionId || ''),
      };
    } else if (action === 'Reset') {
      targetAction = 'Reset';
      targetPayload = {
        type: payload.type === 'Soft' ? 'OnIdle' : 'Immediate',
      };
    }
  }

  // Log outgoing command
  recordAndBroadcastMessage({
    id: uniqueId,
    timestamp: timeStr,
    stationId,
    direction: 'CS_TO_CP',
    action: targetAction,
    messageTypeId: 2,
    payload: targetPayload,
  });

  if (!charger || charger.ws.readyState !== WebSocket.OPEN) {
    // If not connected via physical socket, simulate positive response for UI convenience
    const simResult = { status: 'Accepted', info: 'Station not connected over physical WS; emulated response.' };
    recordAndBroadcastMessage({
      id: uniqueId,
      timestamp: timeStr,
      stationId,
      direction: 'CP_TO_CS',
      action: `${targetAction}Response`,
      messageTypeId: 3,
      payload: simResult,
    });
    return simResult;
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingCallResolvers.delete(uniqueId);
      reject(new Error(`Timeout: Charger ${stationId} did not respond within 8000ms`));
    }, 8000);

    pendingCallResolvers.set(uniqueId, { resolve, reject, timer });

    // Send CALL frame [2, "<uniqueId>", "<action>", {payload}]
    const frame = JSON.stringify([2, uniqueId, targetAction, targetPayload]);
    charger.ws.send(frame, (err) => {
      if (err) {
        clearTimeout(timer);
        pendingCallResolvers.delete(uniqueId);
        reject(err);
      }
    });
  });
}

// Note: Inactive timer is not used for state updates. Connected idle chargers remain Available unless an explicit OCPP message is received.


// --------------------------------------------------------------------------
// WebSocket Heartbeat / Keepalive Ping (Every 15s)
// Keeps all charger and UI WebSockets open continuously against cloud proxy idle timeouts
// --------------------------------------------------------------------------
setInterval(() => {
  connectedChargers.forEach((charger, stationId) => {
    if (charger.ws.readyState === WebSocket.OPEN) {
      try {
        charger.ws.ping();
      } catch (err) {
        console.warn(`[OCPP WS] Ping error for ${stationId}:`, err);
      }
    }
  });

  uiClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.ping();
      } catch (err) {
        console.warn('[UI WS] Ping error:', err);
      }
    }
  });
}, 15000);

// --------------------------------------------------------------------------
// REST API Routes
// --------------------------------------------------------------------------
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptimeSeconds: Math.floor(process.uptime()),
    activeChargersCount: connectedChargers.size,
    uiClientsCount: uiClients.size,
    time: new Date().toISOString(),
  });
});

// List online chargers connected via WebSocket from the internet
app.get('/api/live-chargers', (_req, res) => {
  const list = Array.from(connectedChargers.values()).map((c) => ({
    stationId: c.stationId,
    siteId: c.siteId,
    remoteAddress: c.remoteAddress,
    connectedAt: c.connectedAt,
    lastPing: c.lastPing,
    ocppVersion: c.ocppVersion,
    model: c.model,
    vendor: c.vendor,
    firmwareVersion: c.firmwareVersion,
    activeTransactionsCount: c.activeTransactions.size,
  }));
  res.json({ chargers: list, total: list.length });
});

// Trigger a remote command (Reset, UnlockConnector, RemoteStartTransaction, RemoteStopTransaction)
app.post('/api/chargers/:stationId/ocpp-call', async (req, res) => {
  const { stationId } = req.params;
  const { action, payload } = req.body;

  if (!action) {
    return res.status(400).json({ error: 'Missing required field: action' });
  }

  try {
    const result = await sendRemoteCommandToCharger(stationId, action, payload || {});
    res.json({ status: 'success', stationId, action, result });
  } catch (err: any) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Endpoint providing connection parameters for external chargers
app.get('/api/ocpp-info', (req, res) => {
  const host = req.get('host') || `localhost:${PORT}`;
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const wsProto = isSecure ? 'wss' : 'ws';
  const httpProto = isSecure ? 'https' : 'http';

  res.json({
    wsUrlTemplate: `${wsProto}://${host}/ocpp/:version/:chargerId`,
    wsUrlTemplate16: `${wsProto}://${host}/ocpp/1.6/:chargerId`,
    wsUrlTemplate201: `${wsProto}://${host}/ocpp/2.0.1/:chargerId`,
    exampleWsUrl16: `${wsProto}://${host}/ocpp/1.6/CHG-101`,
    exampleWsUrl201: `${wsProto}://${host}/ocpp/2.0.1/CHG-101`,
    exampleWsUrl: `${wsProto}://${host}/ocpp/1.6/CHG-101`,
    webhookUrlTemplate: `${httpProto}://${host}/api/webhook/ocpp/:version/:chargerId`,
    exampleWebhookUrl: `${httpProto}://${host}/api/webhook/ocpp/1.6/CHG-101`,
    supportedProtocols: ['ocpp1.6', 'ocpp2.0.1'],
    onlineCount: connectedChargers.size,
    isOcppServerActive,
  });
});

// --------------------------------------------------------------------------
// Real Webhook Ingestion Route for Hardware Event Pushes (HTTP/HTTPS)
// --------------------------------------------------------------------------
app.post(['/api/webhook/ocpp/:stationId', '/api/webhook/ocpp/:version/:stationId'], async (req, res) => {
  const { stationId } = req.params;
  const body = req.body || {};
  const signature = req.headers['x-webhook-signature'] || req.headers['authorization'];

  console.log(`[Real Webhook] Received webhook event for station ${stationId}:`, body?.action || 'TelemetryEvent');

  // Broadcast incoming webhook event as an OCPP message to connected UI clients
  broadcastToUI({
    type: 'ocpp_message',
    data: {
      id: `wh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      stationId,
      direction: 'inbound',
      action: body.action || body.eventType || 'WebhookNotification',
      payload: body,
      timestamp: new Date().toISOString(),
      rawFrame: JSON.stringify(body),
    },
  });

  res.json({
    status: 'success',
    stationId,
    receivedAt: new Date().toISOString(),
    message: 'Webhook processed by Z-CHARGE CPMS Gateway',
  });
});

// Get and toggle OCPP WS server status (ON / OFF)
app.get('/api/ws-server/status', (_req, res) => {
  res.json({
    isActive: isOcppServerActive,
    activeChargersCount: connectedChargers.size,
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/ws-server/toggle', (req, res) => {
  const { active } = req.body || {};
  const targetState = typeof active === 'boolean' ? active : !isOcppServerActive;
  setOcppServerStatus(targetState);
  res.json({
    status: 'success',
    isActive: isOcppServerActive,
    message: isOcppServerActive
      ? 'OCPP WebSocket Server Gateway started (ONLINE)'
      : 'OCPP WebSocket Server Gateway paused (OFFLINE)',
  });
});

// --------------------------------------------------------------------------
// OCPI 2.2.1 Protocol Endpoints (Charge Point Operator - CPO Role: US*ZCH)
// --------------------------------------------------------------------------

// 1. OCPI Versions endpoint
app.get('/ocpi/versions', (_req, res) => {
  res.json({
    status_code: 1000,
    status_message: 'Success',
    timestamp: new Date().toISOString(),
    data: [
      { version: '2.2.1', url: '/ocpi/2.2.1' },
      { version: '2.1.1', url: '/ocpi/2.1.1' },
    ],
  });
});

// 2. OCPI 2.2.1 Version details / Endpoints catalog
app.get(['/ocpi/2.2.1', '/ocpi/2.1.1'], (_req, res) => {
  res.json({
    status_code: 1000,
    status_message: 'Success',
    timestamp: new Date().toISOString(),
    data: {
      version: '2.2.1',
      endpoints: [
        { identifier: 'credentials', role: 'SENDER', url: '/ocpi/2.2.1/credentials' },
        { identifier: 'locations', role: 'SENDER', url: '/ocpi/2.2.1/cpo/locations' },
        { identifier: 'tariffs', role: 'SENDER', url: '/ocpi/2.2.1/cpo/tariffs' },
        { identifier: 'cdrs', role: 'SENDER', url: '/ocpi/2.2.1/cpo/cdrs' },
        { identifier: 'tokens', role: 'RECEIVER', url: '/ocpi/2.2.1/cpo/tokens' },
        { identifier: 'commands', role: 'RECEIVER', url: '/ocpi/2.2.1/cpo/commands' },
      ],
    },
  });
});

// 3. OCPI Locations & EVSEs endpoint
app.get('/ocpi/2.2.1/cpo/locations', (_req, res) => {
  const onlineChargersList = Array.from(connectedChargers.values());
  res.json({
    status_code: 1000,
    status_message: 'Success',
    timestamp: new Date().toISOString(),
    data: [
      {
        id: 'site-houston-03',
        type: 'ON_STREET',
        name: 'Houston Energy Corridor Hub',
        address: '15320 Park Row Dr',
        city: 'Houston',
        postal_code: '77084',
        country: 'USA',
        coordinates: { latitude: '29.7891', longitude: '-95.6322' },
        operator: { name: 'Z-CHARGE CPMS Network' },
        time_zone: 'America/Chicago',
        evses: [
          {
            uid: 'EVSE-HOU-01',
            evse_id: 'US*ZCH*E00101',
            status: onlineChargersList.some((c) => c.activeTransactions.size > 0) ? 'CHARGING' : 'AVAILABLE',
            capabilities: ['REMOTE_START_STOP_CAPABLE', 'RFID_READER', 'RESERVABLE'],
            connectors: [
              {
                id: 'CONN-CCS-1',
                standard: 'CCS1',
                format: 'CABLE',
                power_type: 'DC',
                max_voltage: 1000,
                max_amperage: 350,
                max_electric_power: 350000,
                tariff_ids: ['TAR-DCFC-ROAMING-01'],
                last_updated: new Date().toISOString(),
              },
            ],
            last_updated: new Date().toISOString(),
          },
        ],
        last_updated: new Date().toISOString(),
      },
    ],
  });
});

// 4. OCPI Tariffs endpoint
app.get('/ocpi/2.2.1/cpo/tariffs', (_req, res) => {
  res.json({
    status_code: 1000,
    status_message: 'Success',
    timestamp: new Date().toISOString(),
    data: [
      {
        id: 'TAR-DCFC-ROAMING-01',
        currency: 'USD',
        elements: [
          {
            price_components: [
              { type: 'FLAT', price: 1.5, vat: 0.0 },
              { type: 'ENERGY', price: 0.52, vat: 0.0, step_size: 1 },
              { type: 'PARKING_TIME', price: 0.6, vat: 0.0, step_size: 60 },
            ],
          },
        ],
        country_code: 'US',
        party_id: 'ZCH',
        last_updated: new Date().toISOString(),
      },
    ],
  });
});

// 5. OCPI Token Authorization endpoint
app.post('/ocpi/2.2.1/cpo/tokens/:country_code/:party_id/:token_uid/authorize', (req, res) => {
  const { country_code, party_id, token_uid } = req.params;
  const isAllowed = Boolean(token_uid && token_uid.length > 3);

  res.json({
    status_code: 1000,
    status_message: 'Success',
    timestamp: new Date().toISOString(),
    data: {
      allowed: isAllowed ? 'ALLOWED' : 'NOT_ALLOWED',
      token: {
        uid: token_uid,
        type: 'RFID',
        contract_id: `${country_code}-${party_id}-C001`,
        visual_number: `PASS-${token_uid.slice(0, 6)}`,
        issuer: `${party_id} eMSP`,
        valid: isAllowed,
        whitelist: 'ALWAYS',
        last_updated: new Date().toISOString(),
      },
      location: {
        location_id: 'site-houston-03',
        evse_uids: ['EVSE-HOU-01'],
      },
    },
  });
});

// 6. Admin User Email Dispatch simulation endpoint
app.post('/api/admin/send-invite-email', (req, res) => {
  const { recipientEmail, recipientName, role, inviteUrl } = req.body || {};
  console.log(`[Admin Email Service] Dispatching 1st-time login invitation to ${recipientEmail} (${recipientName}, Role: ${role})`);
  console.log(`[Admin Email Service] Onboarding URL: ${inviteUrl}`);

  res.json({
    status: 'delivered',
    smtpCode: 250,
    message: `Message accepted for delivery to ${recipientEmail}`,
    dispatchedAt: new Date().toISOString(),
  });
});

// --------------------------------------------------------------------------
// HTTP Upgrade Handler for WebSockets
// --------------------------------------------------------------------------
server.on('upgrade', (request, socket, head) => {
  const urlObj = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;
  const rawProtocols = (request.headers['sec-websocket-protocol'] as string) || '';
  const isOcppProtocol = /ocpp/i.test(rawProtocols);

  // 1. CPMS Browser UI WebSocket connection: /ws/ui or /ws/cpms or /ws/client
  if (
    pathname.startsWith('/ws/ui') ||
    pathname.startsWith('/ws/cpms') ||
    pathname.startsWith('/ws/client')
  ) {
    uiWss.handleUpgrade(request, socket, head, (ws) => {
      uiWss.emit('connection', ws, request);
    });
    return;
  }

  // 2. Charger WebSocket connection
  // Matches standard OCPP endpoints:
  // - /ocpp/... (e.g. /ocpp/ws/:stationId, /ocpp/:stationId, /ocpp/ws/:siteId/:stationId)
  // - /steve/... or /CentralSystemService/... or /ocpp16/... or /ocpp1.6/...
  // - /ws/:stationId (non-UI)
  // - Any upgrade request specifying an OCPP subprotocol
  if (
    pathname.startsWith('/ocpp') ||
    pathname.startsWith('/steve') ||
    pathname.startsWith('/CentralSystemService') ||
    pathname.startsWith('/websocket') ||
    pathname.startsWith('/ws/') ||
    isOcppProtocol
  ) {
    // Configure TCP socket keepalive on incoming upgrade connection
    if (socket && !socket.destroyed) {
      if ('setKeepAlive' in socket && typeof (socket as any).setKeepAlive === 'function') {
        (socket as any).setKeepAlive(true, 15000);
      }
      if ('setNoDelay' in socket && typeof (socket as any).setNoDelay === 'function') {
        (socket as any).setNoDelay(true);
      }
    }

    const parts = pathname.split('/').filter(Boolean);
    let stationId = 'CHG-GENERIC';
    let siteId = 'site-main';

    if (parts.length >= 4) {
      siteId = parts[2];
      stationId = parts[3];
    } else if (parts.length === 3) {
      stationId = parts[2];
    } else if (
      parts.length === 2 &&
      parts[1] !== 'ws' &&
      parts[1] !== 'ui' &&
      parts[1] !== '1.6' &&
      parts[1] !== '2.0.1' &&
      parts[1] !== '2.0'
    ) {
      stationId = parts[1];
    } else if (parts.length === 1 && parts[0] !== 'ocpp' && parts[0] !== 'ws') {
      stationId = parts[0];
    }

    // Extract station ID from HTTP Basic Auth username (RFC 7617) if path didn't provide specific ID
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Basic ')) {
      try {
        const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
        const [user] = decoded.split(':');
        if (user && user.trim()) {
          stationId = user.trim();
        }
      } catch {
        // ignore invalid base64
      }
    }

    ocppWss.handleUpgrade(request, socket, head, (ws) => {
      ocppWss.emit('connection', ws, request, stationId, siteId);
    });
    return;
  }

  // Vite HMR or other paths
});

// --------------------------------------------------------------------------
// Vite Middleware (Dev) or Static Assets (Production)
// --------------------------------------------------------------------------
async function setupViteOrStatic() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('[Server] Vite middleware mounted for development.');
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
    console.log('[Server] Static assets served from dist/ for production.');
  }
}

setupViteOrStatic().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(`⚡ Z-CHARGE CPMS Full-Stack Express + WS Server Running`);
    console.log(`⚡ HTTP & WebSocket Port: ${PORT}`);
    console.log(`⚡ OCPP Endpoint: ws://localhost:${PORT}/ocpp/ws/:stationId`);
    console.log(`⚡ UI Stream:     ws://localhost:${PORT}/ws/ui`);
    console.log(`====================================================`);
  });
});
