import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

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
  model?: string;
  vendor?: string;
  firmwareVersion?: string;
  activeTransactions: Map<
    number,
    {
      connectorId: number;
      idTag: string;
      startTime: string;
      lastMeterValueTime: number;
      meterStart?: number;
      meterValuesCount?: number;
    }
  >;
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
  handleProtocols: (protocols) => {
    const list = Array.isArray(protocols) ? protocols : Array.from(protocols);
    if (!list || list.length === 0) return false;
    for (const p of list) {
      const lower = p.toLowerCase();
      if (lower === 'ocpp1.6' || lower === 'ocpp1.6j') return p;
      if (lower === 'ocpp2.0.1' || lower === 'ocpp2.0') return p;
    }
    return list[0] || false;
  },
});

ocppWss.on('connection', (ws: WebSocket, req: http.IncomingMessage, stationId: string, siteId?: string) => {
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
    req.socket.remoteAddress ||
    '127.0.0.1';

  const subprotocol = ws.protocol || 'ocpp1.6';
  const now = new Date().toISOString();

  console.log(`[OCPP WS] Charger connected from internet: ${stationId} (IP: ${ip}, Protocol: ${subprotocol})`);

  const chargerRecord: ConnectedCharger = {
    stationId,
    siteId,
    ws,
    remoteAddress: ip,
    connectedAt: now,
    lastPing: now,
    ocppVersion: subprotocol.includes('2.0') ? '2.0.1' : '1.6-J',
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

// Process OCPP 1.6 / 2.0.1 CALL actions received from physical/internet EV charger
function handleChargerCall(
  ws: WebSocket,
  stationId: string,
  uniqueId: string,
  action: string,
  payload: Record<string, unknown>,
  charger: ConnectedCharger
) {
  const timeStr = new Date().toTimeString().split(' ')[0];
  let responsePayload: Record<string, unknown> = {};

  switch (action) {
    case 'BootNotification': {
      charger.vendor = String(
        payload.chargePointVendor ||
        (payload.chargingStation as any)?.vendorName ||
        payload.vendor ||
        'Unknown Vendor'
      );
      charger.model = String(
        payload.chargePointModel ||
        (payload.chargingStation as any)?.model ||
        payload.model ||
        'Unknown Model'
      );
      charger.firmwareVersion = String(
        payload.firmwareVersion ||
        (payload.chargingStation as any)?.firmwareVersion ||
        'v1.0.0'
      );

      responsePayload = {
        status: 'Accepted',
        currentTime: new Date().toISOString(),
        interval: 30, // 30s heartbeat interval
      };

      // Broadcast charger metadata update
      broadcastToUI({
        type: 'charger:updated',
        stationId,
        vendor: charger.vendor,
        model: charger.model,
        firmwareVersion: charger.firmwareVersion,
        wsStatus: 'connected',
      });
      break;
    }

    case 'Heartbeat': {
      responsePayload = {
        currentTime: new Date().toISOString(),
      };
      broadcastToUI({
        type: 'charger:heartbeat',
        stationId,
        timestamp: new Date().toISOString(),
      });
      break;
    }

    case 'StatusNotification': {
      const connectorId =
        payload.connectorId !== undefined && Number(payload.connectorId) > 0
          ? Number(payload.connectorId)
          : payload.evseId !== undefined && Number(payload.evseId) > 0
            ? Number(payload.evseId)
            : 1;
      const rawStatus = String(payload.connectorStatus || payload.status || 'Available');
      const statusMap: Record<string, string> = {
        available: 'Available',
        occupied: 'Occupied',
        charging: 'Charging',
        preparing: 'Preparing',
        suspendedev: 'SuspendedEV',
        suspendedevse: 'SuspendedEVSE',
        finishing: 'Finishing',
        reserved: 'Reserved',
        unavailable: 'Unavailable',
        faulted: 'Faulted',
      };
      let status = statusMap[rawStatus.toLowerCase()] || rawStatus;
      if (status === 'Occupied') {
        let isActivelyCharging = false;
        charger.activeTransactions.forEach((tx) => {
          if (tx.connectorId === connectorId) isActivelyCharging = true;
        });
        status = isActivelyCharging ? 'Charging' : 'Preparing';
      }

      // OCPP 1.6-J Rule: until see the 2nd MeterValues then change the state to "Charging"
      const isOcpp16 = !charger.ocppVersion || charger.ocppVersion.includes('1.6');
      if (isOcpp16 && status === 'Charging') {
        let activeTxForConn: { meterValuesCount?: number } | undefined;
        charger.activeTransactions.forEach((tx) => {
          if (tx.connectorId === connectorId) activeTxForConn = tx;
        });
        if (activeTxForConn && (activeTxForConn.meterValuesCount || 0) < 2) {
          console.log(
            `[OCPP 1.6-J] StatusNotification 'Charging' held as 'Preparing' on ${stationId} connector ${connectorId} until 2nd MeterValues (current count: ${activeTxForConn.meterValuesCount || 0}/2)`
          );
          status = 'Preparing';
        }
      }
      const errorCode = String(payload.errorCode || 'NoError');

      responsePayload = {};

      broadcastToUI({
        type: 'connector:status',
        stationId,
        connectorId,
        status,
        errorCode,
        info: payload.info,
      });
      break;
    }

    case 'Authorize': {
      responsePayload = {
        idTokenInfo: {
          status: 'Accepted',
          type: 'Central',
        },
        idTagInfo: {
          status: 'Accepted',
          expiryDate: new Date(Date.now() + 86400000).toISOString(),
          parentIdTag: 'ADMIN-GROUP',
        },
      };
      break;
    }

    // OCPP 2.0.1 Core Lifecycle Event: TransactionEvent (Started, Updated, Ended)
    case 'TransactionEvent': {
      const eventType = String(payload.eventType || 'Updated');
      const transactionInfo = (payload.transactionInfo as any) || {};
      const txIdRaw = transactionInfo.transactionId || payload.transactionId;
      const transactionId = typeof txIdRaw === 'number' ? txIdRaw : parseInt(String(txIdRaw || '').replace(/\D/g, '') || String(Math.floor(100000 + Math.random() * 900000)), 10) || 100001;
      
      const evseObj = (payload.evse as any) || {};
      const connectorId = evseObj.connectorId || evseObj.id || (payload.evseId ? Number(payload.evseId) : (payload.connectorId ? Number(payload.connectorId) : 1));
      const idTokenObj = (payload.idToken as any) || {};
      const idTag = String(idTokenObj.idToken || payload.idTag || 'RFID-USER');
      const now = Date.now();

      // Extract meter values if included in TransactionEvent
      const meterValues = payload.meterValue || payload.meterValues;

      if (eventType.toLowerCase() === 'started') {
        let meterStart = 0;
        if (Array.isArray(meterValues) && meterValues.length > 0) {
          const sampled = meterValues[0]?.sampledValue || [];
          const energySample = sampled.find((s: any) => String(s.measurand || '').toLowerCase().includes('energy'));
          if (energySample) {
            const val = parseFloat(energySample.value);
            if (!isNaN(val)) meterStart = val;
          }
        }

        charger.activeTransactions.set(transactionId, {
          connectorId,
          idTag,
          startTime: new Date().toISOString(),
          lastMeterValueTime: now,
          meterStart,
        });

        broadcastToUI({
          type: 'session:started',
          stationId,
          connectorId,
          transactionId,
          idTag,
          meterStart,
          timestamp: new Date().toISOString(),
        });

        broadcastToUI({
          type: 'connector:status',
          stationId,
          connectorId,
          status: 'Charging',
          errorCode: 'NoError',
        });
      } else if (eventType.toLowerCase() === 'updated') {
        if (charger.activeTransactions.has(transactionId)) {
          const tx = charger.activeTransactions.get(transactionId)!;
          tx.lastMeterValueTime = now;
        }

        const chargingState = transactionInfo.chargingState ? String(transactionInfo.chargingState) : undefined;
        if (chargingState) {
          const mappedStatus = chargingState === 'Charging' ? 'Charging' : chargingState === 'SuspendedEV' || chargingState === 'SuspendedEVSE' ? 'SuspendedEV' : chargingState === 'Idle' ? 'Available' : 'Preparing';
          broadcastToUI({
            type: 'connector:status',
            stationId,
            connectorId,
            status: mappedStatus,
            errorCode: 'NoError',
          });
        }
      } else if (eventType.toLowerCase() === 'ended') {
        const activeTx = charger.activeTransactions.get(transactionId);
        const resolvedConnectorId = activeTx ? activeTx.connectorId : connectorId;
        charger.activeTransactions.delete(transactionId);

        let meterStop: number | undefined;
        if (Array.isArray(meterValues) && meterValues.length > 0) {
          const sampled = meterValues[0]?.sampledValue || [];
          const energySample = sampled.find((s: any) => String(s.measurand || '').toLowerCase().includes('energy'));
          if (energySample) {
            const val = parseFloat(energySample.value);
            if (!isNaN(val)) meterStop = val;
          }
        }

        broadcastToUI({
          type: 'session:stopped',
          stationId,
          transactionId,
          meterStop,
          reason: transactionInfo.stoppedReason || payload.reason || 'Local',
          timestamp: new Date().toISOString(),
        });

        broadcastToUI({
          type: 'connector:status',
          stationId,
          connectorId: resolvedConnectorId,
          status: 'Available',
          errorCode: 'NoError',
        });
      }

      // If telemetry included in TransactionEvent, forward to UI
      if (meterValues) {
        broadcastToUI({
          type: 'telemetry:meter_values',
          stationId,
          connectorId,
          transactionId,
          meterValues,
        });
      }

      // OCPP 2.0.1 TransactionEventResponse
      responsePayload = {
        totalCost: 0,
        idTokenInfo: {
          status: 'Accepted',
        },
      };
      break;
    }

    case 'StartTransaction': {
      const connectorId = payload.connectorId !== undefined ? Number(payload.connectorId) : 1;
      const idTag = String(payload.idTag || 'RFID-TAG');
      const transactionId = Math.floor(100000 + Math.random() * 900000);
      const now = Date.now();
      const meterStart = Number(payload.meterStart || 0);

      const isOcpp16 = !charger.ocppVersion || charger.ocppVersion.includes('1.6');

      charger.activeTransactions.set(transactionId, {
        connectorId,
        idTag,
        startTime: new Date().toISOString(),
        lastMeterValueTime: now,
        meterStart,
        meterValuesCount: 0,
      });

      responsePayload = {
        transactionId,
        idTagInfo: {
          status: 'Accepted',
        },
      };

      broadcastToUI({
        type: 'session:started',
        stationId,
        connectorId,
        transactionId,
        idTag,
        meterStart,
        meterValuesCount: 0,
        ocppVersion: charger.ocppVersion || '1.6-J',
        timestamp: new Date().toISOString(),
      });

      // OCPP 1.6-J Rule: until see the 2nd MeterValues, keep state as "Preparing"!
      const initialStatus = isOcpp16 ? 'Preparing' : 'Charging';

      broadcastToUI({
        type: 'connector:status',
        stationId,
        connectorId,
        status: initialStatus,
        errorCode: 'NoError',
        info: isOcpp16 ? 'OCPP 1.6-J session started; state is Preparing until 2nd MeterValues' : undefined,
      });
      break;
    }

    case 'MeterValues': {
      responsePayload = {};

      const connectorId =
        payload.connectorId !== undefined && Number(payload.connectorId) > 0
          ? Number(payload.connectorId)
          : payload.evseId !== undefined && Number(payload.evseId) > 0
            ? Number(payload.evseId)
            : 1;
      const transactionId = payload.transactionId ? Number(payload.transactionId) : undefined;
      const meterValues = payload.meterValue || payload.meterValues;
      const now = Date.now();

      const isOcpp16 = !charger.ocppVersion || charger.ocppVersion.includes('1.6');

      // Reset transaction timeout timer and increment MeterValues count
      let matchedTx:
        | {
            connectorId: number;
            idTag: string;
            startTime: string;
            lastMeterValueTime: number;
            meterStart?: number;
            meterValuesCount?: number;
          }
        | undefined;

      if (transactionId && charger.activeTransactions.has(transactionId)) {
        matchedTx = charger.activeTransactions.get(transactionId)!;
        matchedTx.lastMeterValueTime = now;
        matchedTx.meterValuesCount = (matchedTx.meterValuesCount || 0) + 1;
      } else {
        charger.activeTransactions.forEach((tx) => {
          if (tx.connectorId === connectorId) {
            tx.lastMeterValueTime = now;
            tx.meterValuesCount = (tx.meterValuesCount || 0) + 1;
            matchedTx = tx;
          }
        });
      }

      const count = matchedTx ? (matchedTx.meterValuesCount || 1) : 1;

      broadcastToUI({
        type: 'telemetry:meter_values',
        stationId,
        connectorId,
        transactionId,
        meterValues,
        meterValuesCount: count,
        ocppVersion: charger.ocppVersion || '1.6-J',
      });

      // OCPP 1.6-J Rule: until see the 2nd MeterValues then change the state to "Charging"
      if (isOcpp16) {
        if (count === 1) {
          console.log(
            `[OCPP 1.6-J] Station ${stationId} connector ${connectorId}: 1st MeterValues received (Tx ${transactionId}). Holding state in 'Preparing'.`
          );
          broadcastToUI({
            type: 'connector:status',
            stationId,
            connectorId,
            status: 'Preparing',
            errorCode: 'NoError',
            info: 'OCPP 1.6-J: 1st MeterValues received (1/2); awaiting 2nd MeterValues before transitioning to Charging',
          });
        } else if (count >= 2) {
          console.log(
            `[OCPP 1.6-J] Station ${stationId} connector ${connectorId}: 2nd MeterValues received (Tx ${transactionId}, count: ${count}). State transitioning to 'Charging'! ⚡`
          );
          broadcastToUI({
            type: 'connector:status',
            stationId,
            connectorId,
            status: 'Charging',
            errorCode: 'NoError',
            info: 'OCPP 1.6-J: 2nd MeterValues confirmed! State changed to Charging',
          });
        }
      }
      break;
    }

    case 'RequestStartTransaction': {
      responsePayload = { status: 'Accepted' };
      break;
    }

    case 'RequestStopTransaction': {
      responsePayload = { status: 'Accepted' };
      break;
    }

    case 'NotifyEvent': {
      responsePayload = {};
      break;
    }

    case 'NotifyReport': {
      responsePayload = {};
      break;
    }

    case 'StopTransaction': {
      const transactionId = Number(payload.transactionId || 0);
      const activeTx = charger.activeTransactions.get(transactionId);
      const connectorId = activeTx ? activeTx.connectorId : 1;
      charger.activeTransactions.delete(transactionId);

      responsePayload = {
        idTagInfo: {
          status: 'Accepted',
        },
      };

      broadcastToUI({
        type: 'session:stopped',
        stationId,
        transactionId,
        meterStop: payload.meterStop,
        reason: payload.reason || 'Local',
        timestamp: new Date().toISOString(),
      });

      broadcastToUI({
        type: 'connector:status',
        stationId,
        connectorId,
        status: 'Available',
        errorCode: 'NoError',
      });
      break;
    }

    case 'DataTransfer': {
      responsePayload = {
        status: 'Accepted',
        data: 'CPMS_OK',
      };
      break;
    }

    default: {
      // Default accepted response for any unhandled standard actions
      responsePayload = {};
      break;
    }
  }

  // Send CALLRESULT [3, "<uniqueId>", {responsePayload}]
  const callResultFrame = JSON.stringify([3, uniqueId, responsePayload]);
  try {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(callResultFrame);

      // Record server response
      recordAndBroadcastMessage({
        id: uniqueId,
        timestamp: timeStr,
        stationId,
        direction: 'CS_TO_CP',
        action: `${action}Response`,
        messageTypeId: 3,
        payload: responsePayload,
      });
    }
  } catch (err) {
    console.error(`[OCPP WS] Failed sending CallResult to ${stationId}:`, err);
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

// --------------------------------------------------------------------------
// Active Charging Session Timeout Monitor (1 min timeout without MeterValues)
// --------------------------------------------------------------------------
setInterval(() => {
  const now = Date.now();
  connectedChargers.forEach((charger) => {
    charger.activeTransactions.forEach((tx, txId) => {
      const msSinceLastMeter = now - tx.lastMeterValueTime;
      // 1 minute timeout (60,000 ms) without any MeterValue message
      if (msSinceLastMeter >= 60000) {
        console.log(
          `[OCPP WS] Transaction ${txId} on station ${charger.stationId} timed out (${Math.round(
            msSinceLastMeter / 1000
          )}s without MeterValues). Ending session.`
        );

        charger.activeTransactions.delete(txId);

        broadcastToUI({
          type: 'session:stopped',
          stationId: charger.stationId,
          transactionId: txId,
          reason: 'Timeout',
          timestamp: new Date().toISOString(),
        });

        broadcastToUI({
          type: 'connector:status',
          stationId: charger.stationId,
          connectorId: tx.connectorId,
          status: 'Available',
          errorCode: 'NoError',
        });

        recordAndBroadcastMessage({
          id: `timeout-${txId}-${Date.now().toString().slice(-4)}`,
          timestamp: new Date().toISOString(),
          stationId: charger.stationId,
          direction: 'CS_TO_CP',
          action: 'TransactionTimeout',
          messageTypeId: 2,
          payload: {
            transactionId: txId,
            connectorId: tx.connectorId,
            reason: 'Timeout: No MeterValue received for 1 min',
          },
        });
      }
    });
  });
}, 3000);

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
    wsUrlTemplate: `${wsProto}://${host}/ocpp/ws/:chargerId`,
    exampleWsUrl: `${wsProto}://${host}/ocpp/ws/CHG-101`,
    webhookUrlTemplate: `${httpProto}://${host}/api/webhook/ocpp/:chargerId`,
    exampleWebhookUrl: `${httpProto}://${host}/api/webhook/ocpp/CHG-101`,
    supportedProtocols: ['ocpp1.6', 'ocpp2.0.1'],
    onlineCount: connectedChargers.size,
    isOcppServerActive,
  });
});

// --------------------------------------------------------------------------
// Real Webhook Ingestion Route for Hardware Event Pushes (HTTP/HTTPS)
// --------------------------------------------------------------------------
app.post('/api/webhook/ocpp/:stationId', async (req, res) => {
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
    } else if (parts.length === 2 && parts[1] !== 'ws' && parts[1] !== 'ui') {
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
