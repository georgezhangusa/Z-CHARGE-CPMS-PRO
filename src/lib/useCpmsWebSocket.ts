import { useState, useEffect, useRef, useCallback } from 'react';
import { OcppMessage, PortStatus } from '../types';

export interface OnlineChargerSocketInfo {
  stationId: string;
  siteId?: string;
  ip: string;
  connectedAt: string;
  lastPing: string;
  ocppVersion: string;
  model?: string;
  vendor?: string;
  firmwareVersion?: string;
}

interface UseCpmsWebSocketProps {
  onOcppMessageReceived?: (msg: OcppMessage) => void;
  onChargerConnected?: (info: { stationId: string; ip: string; ocppVersion: string }) => void;
  onChargerDisconnected?: (stationId: string) => void;
  onChargerUpdated?: (info: { stationId: string; vendor?: string; model?: string; firmwareVersion?: string }) => void;
  onConnectorStatusChanged?: (info: { stationId: string; connectorId: number; status: PortStatus; errorCode: string; info?: string }) => void;
  onTelemetryReceived?: (info: { stationId: string; connectorId: number; transactionId?: number; meterValues: any; meterValuesCount?: number; ocppVersion?: string }) => void;
  onSessionStarted?: (info: { stationId: string; connectorId: number; transactionId: number; idTag: string; meterStart?: number; meterValuesCount?: number; ocppVersion?: string }) => void;
  onSessionStopped?: (info: { stationId: string; connectorId?: number; transactionId: number; meterStop?: number; reason: string }) => void;
  onHeartbeatReceived?: (info: { stationId: string; timestamp: string }) => void;
}

export function useCpmsWebSocket(props: UseCpmsWebSocketProps = {}) {
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [isOcppServerActive, setIsOcppServerActive] = useState<boolean>(true);
  const [onlineChargers, setOnlineChargers] = useState<OnlineChargerSocketInfo[]>([]);
  const [serverEndpoint, setServerEndpoint] = useState<string>('');
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const watchdogIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Store latest callbacks in ref so connect() function is 100% stable
  const callbacksRef = useRef<UseCpmsWebSocketProps>(props);
  useEffect(() => {
    callbacksRef.current = props;
  });

  // Compute public WS URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isHttps = window.location.protocol === 'https:';
      const wsProto = isHttps ? 'wss:' : 'ws:';
      const host = window.location.host;
      setServerEndpoint(`${wsProto}//${host}/ocpp/ws`);
    }
  }, []);

  const connect = useCallback(() => {
    if (typeof window === 'undefined' || !isMountedRef.current) return;

    // If socket is already OPEN or CONNECTING, maintain it
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        return;
      }
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }

    try {
      const isHttps = window.location.protocol === 'https:';
      const wsProto = isHttps ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${wsProto}//${host}/ws/ui`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) {
          ws.close();
          return;
        }
        console.log('[CPMS UI WS] Connected to backend WebSocket stream (Always Open)');
        setIsWsConnected(true);
        setIsOcppServerActive(true);
      };

      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;
        try {
          const data = JSON.parse(event.data);
          const cb = callbacksRef.current;
          
          if (data.type === 'init') {
            setIsOcppServerActive(true);
            if (Array.isArray(data.onlineChargers)) {
              setOnlineChargers(data.onlineChargers);
            }
            if (Array.isArray(data.recentMessages) && cb.onOcppMessageReceived) {
              for (const m of data.recentMessages) {
                cb.onOcppMessageReceived(m);
              }
            }
          } else if (data.type === 'server:ws_status') {
            setIsOcppServerActive(true);
          } else if (data.type === 'pong') {
            // Heartbeat response from server, socket is verified active and open
            setIsWsConnected(true);
          } else if (data.type === 'charger:connected') {
            setOnlineChargers((prev) => {
              const filtered = prev.filter((c) => c.stationId !== data.stationId);
              return [
                ...filtered,
                {
                  stationId: data.stationId,
                  siteId: data.siteId,
                  ip: data.ip,
                  connectedAt: data.timestamp,
                  lastPing: data.timestamp,
                  ocppVersion: data.ocppVersion,
                },
              ];
            });
            cb.onChargerConnected?.(data);
          } else if (data.type === 'charger:disconnected') {
            setOnlineChargers((prev) => prev.filter((c) => c.stationId !== data.stationId));
            cb.onChargerDisconnected?.(data.stationId);
          }

          // Any incoming message from an online charger resets the countdown timer and updates lastPing
          const activeStationId = data.stationId || data.message?.stationId;
          if (activeStationId && data.type !== 'charger:disconnected') {
            const pingTime = data.timestamp || new Date().toISOString();
            setOnlineChargers((prev) =>
              prev.map((c) =>
                c.stationId === activeStationId ? { ...c, lastPing: pingTime } : c
              )
            );
          }

          if (data.type === 'charger:activity') {
            const ts = data.timestamp || new Date().toISOString();
            cb.onHeartbeatReceived?.({
              stationId: data.stationId,
              timestamp: ts,
            });
          } else if (data.type === 'charger:updated') {
            setOnlineChargers((prev) =>
              prev.map((c) =>
                c.stationId === data.stationId
                  ? {
                      ...c,
                      vendor: data.vendor || c.vendor,
                      model: data.model || c.model,
                      firmwareVersion: data.firmwareVersion || c.firmwareVersion,
                    }
                  : c
              )
            );
            cb.onChargerUpdated?.(data);
          } else if (data.type === 'charger:heartbeat') {
            setOnlineChargers((prev) =>
              prev.map((c) =>
                c.stationId === data.stationId ? { ...c, lastPing: data.timestamp } : c
              )
            );
            cb.onHeartbeatReceived?.({
              stationId: data.stationId,
              timestamp: data.timestamp,
            });
          } else if (data.type === 'connector:status') {
            cb.onConnectorStatusChanged?.({
              stationId: data.stationId,
              connectorId: data.connectorId,
              status: data.status as PortStatus,
              errorCode: data.errorCode,
              info: data.info,
            });
          } else if (data.type === 'telemetry:meter_values') {
            cb.onTelemetryReceived?.(data);
          } else if (data.type === 'session:started') {
            cb.onSessionStarted?.(data);
          } else if (data.type === 'session:stopped') {
            cb.onSessionStopped?.(data);
          } else if (data.type === 'ocpp:message') {
            if (data.message) {
              cb.onOcppMessageReceived?.(data.message);
            }
          }
        } catch (err) {
          console.error('[CPMS UI WS] Error parsing incoming WS payload:', err);
        }
      };

      ws.onclose = () => {
        if (!isMountedRef.current) return;
        setIsWsConnected(false);
        wsRef.current = null;
        console.log('[CPMS UI WS] Socket closed. Reconnecting immediately to stay open...');
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
            connect();
          }, 1000);
        }
      };

      ws.onerror = (err) => {
        console.warn('[CPMS UI WS] Socket notice:', err);
      };
    } catch (err) {
      console.warn('[CPMS UI WS] Could not instantiate WebSocket:', err);
      if (!reconnectTimeoutRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectTimeoutRef.current = null;
          connect();
        }, 1000);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    connect();

    // 1. Periodic Ping Keepalive: every 15s to keep WebSocket connection open against proxy timeouts
    pingIntervalRef.current = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        } catch {}
      }
    }, 15000);

    // 2. Continuous Watchdog Timer: every 4s, ensure socket is open or connecting at all times
    watchdogIntervalRef.current = setInterval(() => {
      if (!isMountedRef.current) return;
      if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED || wsRef.current.readyState === WebSocket.CLOSING) {
        connect();
      }
    }, 4000);

    // 3. Reconnect on tab focus / visibility / network restore
    const handleVisibilityOrNetwork = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        connect();
      }
    };
    const handleOnline = () => {
      console.log('[CPMS UI WS] Network online event detected. Ensuring WebSocket is open...');
      connect();
    };

    window.addEventListener('visibilitychange', handleVisibilityOrNetwork);
    window.addEventListener('focus', handleVisibilityOrNetwork);
    window.addEventListener('online', handleOnline);

    return () => {
      isMountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      if (watchdogIntervalRef.current) {
        clearInterval(watchdogIntervalRef.current);
        watchdogIntervalRef.current = null;
      }
      window.removeEventListener('visibilitychange', handleVisibilityOrNetwork);
      window.removeEventListener('focus', handleVisibilityOrNetwork);
      window.removeEventListener('online', handleOnline);

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  // Send a remote OCPP command to the charger via backend WebSocket
  const sendRemoteCommand = useCallback(
    async (stationId: string, action: string, payload: Record<string, unknown> = {}) => {
      // First try via UI WebSocket if open
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'remote:command',
            stationId,
            action,
            payload,
          })
        );
      }

      // Also call REST API proxy for guaranteed delivery and server-side logging
      try {
        const res = await fetch(`/api/chargers/${encodeURIComponent(stationId)}/ocpp-call`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, payload }),
        });
        return await res.json();
      } catch (err) {
        console.error(`Failed to invoke REST ocpp-call for ${stationId}:`, err);
        return { status: 'error', error: String(err) };
      }
    },
    []
  );

  const toggleOcppServer = useCallback(
    async (targetState?: boolean): Promise<boolean> => {
      try {
        const res = await fetch('/api/ws-server/toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: targetState }),
        });
        const data = await res.json();
        if (data && typeof data.isActive === 'boolean') {
          setIsOcppServerActive(data.isActive);
          return data.isActive;
        }
      } catch (err) {
        console.error('Failed to toggle OCPP WS server via API:', err);
      }

      // Fallback over UI WebSocket
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ws:toggle_server', active: targetState }));
      }
      const fallbackVal = typeof targetState === 'boolean' ? targetState : !isOcppServerActive;
      setIsOcppServerActive(fallbackVal);
      return fallbackVal;
    },
    [isOcppServerActive]
  );

  return {
    isWsConnected,
    isOcppServerActive,
    toggleOcppServer,
    onlineChargers,
    serverEndpoint,
    sendRemoteCommand,
  };
}
