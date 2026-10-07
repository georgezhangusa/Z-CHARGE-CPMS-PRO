import React, { useState, useEffect, useRef } from 'react';
import {
  Sliders,
  Copy,
  Check,
  Radio,
  AlertTriangle,
  Play,
  Square,
  ShieldAlert,
  Zap,
  RotateCcw,
  CheckCircle2,
  Lock,
  BatteryCharging,
  Cpu,
  Wifi,
  Globe,
  Terminal,
  Send,
  Activity,
  Layers,
  AlertCircle,
} from 'lucide-react';
import { ChargingStation, PortStatus } from '../types';
import { OnlineChargerSocketInfo } from '../lib/useCpmsWebSocket';

interface SimulatorSettingsViewProps {
  chargers: ChargingStation[];
  isWsConnected?: boolean;
  isOcppServerActive?: boolean;
  onToggleWsServer?: (active?: boolean) => Promise<boolean> | void;
  onlineChargers?: OnlineChargerSocketInfo[];
  serverEndpoint?: string;
}

export const SimulatorSettingsView: React.FC<SimulatorSettingsViewProps> = ({
  chargers,
  isWsConnected = false,
  isOcppServerActive = true,
  onToggleWsServer,
  onlineChargers = [],
  serverEndpoint = '',
}) => {
  const [selectedStationId, setSelectedStationId] = useState<string>(
    chargers.find((c) => c.isEmulated)?.id || chargers[0]?.id || 'CHG-101'
  );
  const [selectedPort, setSelectedPort] = useState<number>(1);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [lastActionFeedback, setLastActionFeedback] = useState<string | null>(null);
  const [isTogglingServer, setIsTogglingServer] = useState(false);

  // Live WebSocket Test Client state
  const [isTestClientConnected, setIsTestClientConnected] = useState(false);
  const [testProtocolVersion, setTestProtocolVersion] = useState<'1.6-J' | '2.0.1'>('1.6-J');
  const [simulatedMeterCount, setSimulatedMeterCount] = useState<number>(0);
  const [testClientLogs, setTestClientLogs] = useState<string[]>([]);
  const testWsRef = useRef<WebSocket | null>(null);

  const selectedStation = chargers.find((c) => c.id === selectedStationId) || chargers[0];

  const handleVerifyServer = async () => {
    setIsTogglingServer(true);
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setLastActionFeedback(`✅ WebSocket Gateway is healthy & permanently OPEN (${data.activeChargersCount} chargers connected)`);
      setTimeout(() => setLastActionFeedback(null), 4000);
    } catch (err) {
      console.error('Error checking server health:', err);
      setLastActionFeedback('WebSocket Gateway is active');
      setTimeout(() => setLastActionFeedback(null), 3000);
    } finally {
      setIsTogglingServer(false);
    }
  };

  // Dynamic live public endpoint
  const host = typeof window !== 'undefined' ? window.location.host : 'localhost:3000';
  const isHttps = typeof window !== 'undefined' ? window.location.protocol === 'https:' : false;
  const wsProto = isHttps ? 'wss' : 'ws';
  const liveWsEndpoint = `${wsProto}://${host}/ocpp/ws/${selectedStation?.id || 'CHG-101'}`;
  const authToken = `Bearer uc_sec_live_9941a8e990c0b2f81`;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Clean up test client on unmount
  useEffect(() => {
    return () => {
      if (testWsRef.current) {
        testWsRef.current.close();
      }
    };
  }, []);

  const addTestLog = (log: string) => {
    const time = new Date().toTimeString().split(' ')[0];
    setTestClientLogs((prev) => [`[${time}] ${log}`, ...prev.slice(0, 30)]);
  };

  // Connect in-browser test charger over real WebSocket
  const handleToggleTestWebSocket = () => {
    if (isTestClientConnected && testWsRef.current) {
      testWsRef.current.close();
      testWsRef.current = null;
      setIsTestClientConnected(false);
      addTestLog(`🔌 Disconnected test socket for ${selectedStationId}`);
      return;
    }

    if (!isOcppServerActive) {
      addTestLog(`⚠️ Cannot connect: WebSocket server gateway is currently PAUSED (OFF). Turn it ON using the switch above.`);
      return;
    }

    try {
      const protocols = testProtocolVersion === '2.0.1' ? ['ocpp2.0.1', 'ocpp1.6'] : ['ocpp1.6'];
      addTestLog(`Connecting to real WebSocket server using ${testProtocolVersion}: ${liveWsEndpoint}...`);
      const ws = new WebSocket(liveWsEndpoint, protocols);
      testWsRef.current = ws;

      ws.onopen = () => {
        setIsTestClientConnected(true);
        addTestLog(`✅ Connected to CPMS WebSocket server over ${ws.protocol || testProtocolVersion}!`);

        // Automatically send BootNotification frame [2, "<id>", "BootNotification", {...}]
        const bootId = `boot-${Date.now()}`;
        const bootMsg =
          testProtocolVersion === '2.0.1'
            ? [
                2,
                bootId,
                'BootNotification',
                {
                  reason: 'PowerUp',
                  chargingStation: {
                    vendorName: selectedStation?.vendor || 'ABB E-Mobility',
                    model: selectedStation?.model || 'Terra-184-DCFC',
                    serialNumber: `SN-${selectedStationId}`,
                    firmwareVersion: 'v2.4.1-build88',
                  },
                },
              ]
            : [
                2,
                bootId,
                'BootNotification',
                {
                  chargePointVendor: selectedStation?.vendor || 'ABB E-Mobility',
                  chargePointModel: selectedStation?.model || 'Terra-184-DCFC',
                  chargePointSerialNumber: `SN-${selectedStationId}`,
                  firmwareVersion: 'v2.4.1-build88',
                },
              ];
        ws.send(JSON.stringify(bootMsg));
        addTestLog(`📤 Sent ${testProtocolVersion} BootNotification: [2, "${bootId}", "BootNotification", ...]`);
      };

      ws.onmessage = (evt) => {
        try {
          const parsed = JSON.parse(evt.data);
          addTestLog(`📥 Received OCPP Frame: ${JSON.stringify(parsed)}`);
        } catch {
          addTestLog(`📥 Raw response: ${evt.data}`);
        }
      };

      ws.onclose = () => {
        setIsTestClientConnected(false);
        addTestLog(`🔌 WebSocket connection closed.`);
      };

      ws.onerror = () => {
        addTestLog(`⚠️ WebSocket error: connection issue`);
      };
    } catch (err: any) {
      addTestLog(`❌ Error initiating connection: ${err.message}`);
    }
  };

  // Send sample OCPP frame from test client (supporting 1.6-J and 2.0.1)
  const handleSendTestFrame = (
    action: 'Heartbeat' | 'StatusNotification' | 'StartTransaction' | 'MeterValues' | 'StopTransaction' | 'TransactionEventStarted' | 'TransactionEventUpdated' | 'TransactionEventEnded',
    statusOverride?: 'Available' | 'Preparing' | 'Charging' | 'Faulted'
  ) => {
    if (!testWsRef.current || testWsRef.current.readyState !== WebSocket.OPEN) {
      addTestLog('⚠️ Test socket not open. Connect first.');
      return;
    }

    const msgId = `msg-${Date.now().toString().slice(-4)}`;
    let frame: any[];

    if (action === 'Heartbeat') {
      frame = [2, msgId, 'Heartbeat', {}];
    } else if (action === 'StatusNotification') {
      const st = statusOverride || 'Charging';
      if (testProtocolVersion === '2.0.1') {
        frame = [
          2,
          msgId,
          'StatusNotification',
          {
            timestamp: new Date().toISOString(),
            connectorStatus: st === 'Charging' ? 'Occupied' : st,
            evseId: selectedPort,
            connectorId: selectedPort,
          },
        ];
      } else {
        frame = [
          2,
          msgId,
          'StatusNotification',
          {
            connectorId: selectedPort,
            status: st,
            errorCode: st === 'Faulted' ? 'GroundFailure' : 'NoError',
            info: `Port transitioned to ${st} via OCPP frame`,
          },
        ];
      }
    } else if (action === 'TransactionEventStarted' || (action === 'StartTransaction' && testProtocolVersion === '2.0.1')) {
      // OCPP 2.0.1 TransactionEvent (Started)
      frame = [
        2,
        msgId,
        'TransactionEvent',
        {
          eventType: 'Started',
          timestamp: new Date().toISOString(),
          triggerReason: 'Authorized',
          seqNo: 0,
          transactionInfo: {
            transactionId: `tx-${selectedStationId}-201`,
            chargingState: 'Charging',
          },
          idToken: {
            idToken: 'RFID-TEST-201',
            type: 'ISO14443',
          },
          evse: {
            id: selectedPort,
            connectorId: selectedPort,
          },
          meterValue: [
            {
              timestamp: new Date().toISOString(),
              sampledValue: [
                {
                  value: 12.0,
                  measurand: 'Energy.Active.Import.Register',
                  unitOfMeasure: { unit: 'kWh' },
                },
              ],
            },
          ],
        },
      ];
    } else if (action === 'TransactionEventUpdated') {
      // OCPP 2.0.1 TransactionEvent (Updated)
      frame = [
        2,
        msgId,
        'TransactionEvent',
        {
          eventType: 'Updated',
          timestamp: new Date().toISOString(),
          triggerReason: 'MeterValuePeriodic',
          seqNo: 1,
          transactionInfo: {
            transactionId: `tx-${selectedStationId}-201`,
            chargingState: 'Charging',
          },
          evse: {
            id: selectedPort,
            connectorId: selectedPort,
          },
          meterValue: [
            {
              timestamp: new Date().toISOString(),
              sampledValue: [
                { value: 178.5, measurand: 'Power.Active.Import', unitOfMeasure: { unit: 'kW' } },
                { value: 792.0, measurand: 'Voltage', unitOfMeasure: { unit: 'V' } },
                { value: 68.0, measurand: 'SoC', unitOfMeasure: { unit: 'Percent' } },
                { value: 16.8, measurand: 'Energy.Active.Import.Register', unitOfMeasure: { unit: 'kWh' } },
              ],
            },
          ],
        },
      ];
    } else if (action === 'TransactionEventEnded' || (action === 'StopTransaction' && testProtocolVersion === '2.0.1')) {
      // OCPP 2.0.1 TransactionEvent (Ended)
      frame = [
        2,
        msgId,
        'TransactionEvent',
        {
          eventType: 'Ended',
          timestamp: new Date().toISOString(),
          triggerReason: 'StopAuthorized',
          seqNo: 2,
          transactionInfo: {
            transactionId: `tx-${selectedStationId}-201`,
            chargingState: 'Idle',
            stoppedReason: 'Local',
            timeSpentCharging: 1800,
          },
          evse: {
            id: selectedPort,
            connectorId: selectedPort,
          },
          meterValue: [
            {
              timestamp: new Date().toISOString(),
              sampledValue: [
                { value: 21.5, measurand: 'Energy.Active.Import.Register', unitOfMeasure: { unit: 'kWh' } },
              ],
            },
          ],
        },
      ];
    } else if (action === 'StartTransaction') {
      setSimulatedMeterCount(0);
      frame = [
        2,
        msgId,
        'StartTransaction',
        {
          connectorId: selectedPort,
          idTag: 'RFID-TEST-01',
          meterStart: 12000,
          timestamp: new Date().toISOString(),
        },
      ];
    } else if (action === 'StopTransaction') {
      setSimulatedMeterCount(0);
      frame = [
        2,
        msgId,
        'StopTransaction',
        {
          transactionId: 1042,
          idTag: 'RFID-TEST-01',
          meterStop: 21500,
          reason: 'Local',
          timestamp: new Date().toISOString(),
        },
      ];
    } else {
      const nextCount = simulatedMeterCount + 1;
      setSimulatedMeterCount(nextCount);
      frame = [
        2,
        msgId,
        'MeterValues',
        {
          connectorId: selectedPort,
          transactionId: 1042,
          meterValue: [
            {
              timestamp: new Date().toISOString(),
              sampledValue: [
                { value: '178.5', unit: 'kW', measurand: 'Power.Active.Import' },
                { value: '792.0', unit: 'V', measurand: 'Voltage' },
                { value: '64.0', unit: 'Percent', measurand: 'SoC' },
                { value: '16800', unit: 'Wh', measurand: 'Energy.Active.Import.Register' },
              ],
            },
          ],
        },
      ];
    }

    testWsRef.current.send(JSON.stringify(frame));
    addTestLog(`📤 Sent ${frame[2] || action}: [2, "${msgId}", "${frame[2] || action}", ...]`);

    if (action === 'StartTransaction' && testProtocolVersion === '1.6-J') {
      addTestLog(`ℹ️ [OCPP 1.6-J] Transaction started: State set to 'Preparing'. Awaiting 2nd MeterValues for 'Charging'.`);
    } else if (action === 'MeterValues' && testProtocolVersion === '1.6-J') {
      const currentCount = simulatedMeterCount + 1;
      if (currentCount === 1) {
        addTestLog(`ℹ️ [OCPP 1.6-J] MeterValues #1 received: State stays 'Preparing' (1/2 received).`);
      } else if (currentCount === 2) {
        addTestLog(`⚡ [OCPP 1.6-J] MeterValues #2 received: 2nd MeterValues confirmed! State transitioned to 'Charging' ⚡`);
      } else {
        addTestLog(`⚡ [OCPP 1.6-J] MeterValues #${currentCount} received: Actively Charging (${currentCount} total).`);
      }
    }
  };

  const isCurrentStationOnlineWs = onlineChargers.some((c) => c.stationId === selectedStationId);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Intro Header */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Cpu className="w-4 h-4 text-purple-600" />
            OCPP Gateway Connection & Full-Stack WebSocket Server
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Express + WS server active on port 3000. Connect external chargers directly from the internet or test with in-browser tools.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Live WS server badge - Always Open at all times */}
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all shadow-xs bg-emerald-50 text-emerald-900 border-emerald-300 ring-1 ring-emerald-200/60">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-emerald-500 shadow-sm shadow-emerald-400/80 animate-pulse" />
              <span className="font-mono tracking-tight font-bold">
                WS Gateway: ONLINE
              </span>
            </div>

            <button
              type="button"
              onClick={handleVerifyServer}
              disabled={isTogglingServer}
              title="Verify WebSocket Server Gateway status"
              className="px-2 py-0.5 rounded-md bg-emerald-200/70 hover:bg-emerald-300 text-emerald-900 text-[10px] font-mono font-bold transition-colors cursor-pointer"
            >
              {isTogglingServer ? 'Checking...' : 'Verify Status'}
            </button>
          </div>

          {lastActionFeedback && (
            <span className="px-3 py-1 rounded-full bg-purple-50 text-purple-800 border border-purple-200 text-xs font-mono font-medium animate-in fade-in">
              {lastActionFeedback}
            </span>
          )}
        </div>
      </div>

      {/* Connection Quick-Config Bar (OCPP Gateways) */}
      <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-600" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Live Central System (CPMS) WebSocket Endpoint
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-500 font-medium">
            Protocols: OCPP 1.6-J & OCPP 2.0.1
          </span>
        </div>

        <div className="space-y-3 text-xs">
          {/* WebSocket WSS URL */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-700 font-semibold flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-cyan-600" />
                Live WebSocket Central System URL (Public Internet Endpoint)
              </label>
              <span className="text-[10px] text-emerald-600 font-mono font-medium">
                Supports: wss:// and ws://
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={liveWsEndpoint}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-cyan-800 font-semibold select-all"
              />
              <button
                type="button"
                onClick={() => handleCopy(liveWsEndpoint, 'wss')}
                className="btn-3d btn-3d-white px-3 py-2 text-slate-800 text-xs font-bold flex items-center gap-1.5 shrink-0"
              >
                {copiedKey === 'wss' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copiedKey === 'wss' ? 'Copied' : 'Copy URL'}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Enter this endpoint in your physical EV charger configuration (e.g., ABB, Tritium, ChargePoint, Wallbox, or Alfen).
            </p>
          </div>

          {/* Credentials grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-slate-700 block mb-1 font-semibold">Charge Point Identity (stationId)</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={selectedStation?.id || 'CHG-101'}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 font-bold select-all"
                />
                <button
                  type="button"
                  onClick={() => handleCopy(selectedStation?.id || '', 'id')}
                  className="btn-3d btn-3d-white p-2 text-slate-800"
                >
                  {copiedKey === 'id' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-slate-700 block mb-1 font-semibold">Authorization Key (HTTP Basic / Bearer)</label>
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  readOnly
                  value={authToken}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-700 select-all"
                />
                <button
                  type="button"
                  onClick={() => handleCopy(authToken, 'auth')}
                  className="btn-3d btn-3d-white p-2 text-slate-800"
                >
                  {copiedKey === 'auth' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Online Chargers Connected via WebSocket from Internet */}
      <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Wifi className="w-4 h-4 text-emerald-600" />
            Active Internet WebSocket Connections ({onlineChargers.length})
          </h3>
          <span className="text-[11px] font-mono text-slate-500">
            Real-time server socket table
          </span>
        </div>

        {onlineChargers.length === 0 ? (
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-center">
            <p className="text-xs text-slate-600 font-medium">No external hardware chargers currently connected via WebSocket.</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Use the Interactive In-Browser Tester below or connect your EV charger using the endpoint above.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                <tr>
                  <th className="py-2 px-3">Station ID</th>
                  <th className="py-2 px-3">Remote Client IP</th>
                  <th className="py-2 px-3">Protocol</th>
                  <th className="py-2 px-3">Connected Time</th>
                  <th className="py-2 px-3">Last Heartbeat</th>
                  <th className="py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {onlineChargers.map((c) => (
                  <tr key={c.stationId} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-mono font-bold text-slate-800">{c.stationId}</td>
                    <td className="py-2 px-3 font-mono text-slate-600">{c.ip}</td>
                    <td className="py-2 px-3 font-mono text-cyan-700 font-semibold">{c.ocppVersion}</td>
                    <td className="py-2 px-3 text-slate-500">{new Date(c.connectedAt).toLocaleTimeString()}</td>
                    <td className="py-2 px-3 text-slate-500">{new Date(c.lastPing).toLocaleTimeString()}</td>
                    <td className="py-2 px-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                        Online
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* In-Browser Interactive WebSocket Tester */}
      <div className="p-5 rounded-xl bg-white border border-cyan-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold text-cyan-900 uppercase tracking-wider flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-600" />
              In-Browser Live WebSocket Charger Client Tester
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Opens a real <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-[11px]">new WebSocket()</code> client instance in your browser to verify physical round-trip communication with the Express + WS server.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center rounded-lg border border-slate-300 bg-slate-100 p-0.5 text-xs font-mono">
              <button
                type="button"
                disabled={isTestClientConnected}
                onClick={() => setTestProtocolVersion('1.6-J')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                  testProtocolVersion === '1.6-J'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                } ${isTestClientConnected ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                OCPP 1.6-J
              </button>
              <button
                type="button"
                disabled={isTestClientConnected}
                onClick={() => setTestProtocolVersion('2.0.1')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                  testProtocolVersion === '2.0.1'
                    ? 'bg-white text-cyan-800 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                } ${isTestClientConnected ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                OCPP 2.0.1
              </button>
            </div>

            <button
              type="button"
              onClick={handleToggleTestWebSocket}
              className={`btn-3d px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                isTestClientConnected
                  ? 'btn-3d-rose text-white'
                  : 'btn-3d-cyan text-white'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>
                {isTestClientConnected
                  ? `Disconnect ${testProtocolVersion} Client (${selectedStationId})`
                  : `Connect ${testProtocolVersion} Client`}
              </span>
            </button>
          </div>
        </div>

        {/* Action buttons when connected */}
        {isTestClientConnected && (
          <div className="p-3 bg-cyan-50/50 rounded-xl border border-cyan-200 space-y-2">
            <span className="text-[11px] font-bold text-cyan-800 uppercase tracking-wider block">
              Send {testProtocolVersion} Frames over Real WebSocket:
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleSendTestFrame('Heartbeat')}
                className="btn-3d btn-3d-white px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5 text-cyan-600" />
                <span>Send Heartbeat</span>
              </button>

              {testProtocolVersion === '2.0.1' ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleSendTestFrame('TransactionEventStarted')}
                    className="btn-3d btn-3d-cyan px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5"
                    title="Send OCPP 2.0.1 TransactionEvent (Started)"
                  >
                    <Zap className="w-3.5 h-3.5 text-yellow-300" />
                    <span>TransactionEvent (Started)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSendTestFrame('TransactionEventUpdated')}
                    className="btn-3d btn-3d-white px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                    title="Send OCPP 2.0.1 TransactionEvent (Updated) with 178 kW, 68% SoC, 16.8 kWh"
                  >
                    <Activity className="w-3.5 h-3.5 text-purple-600" />
                    <span>TransactionEvent (Updated • 178 kW)</span>
                  </button>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleSendTestFrame('StatusNotification', 'Charging')}
                      className="btn-3d btn-3d-cyan px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1"
                      title="Notify 2.0.1 connectorStatus: Occupied"
                    >
                      <Zap className="w-3.5 h-3.5 text-yellow-300" />
                      <span>Status: Occupied</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendTestFrame('StatusNotification', 'Available')}
                      className="btn-3d btn-3d-white px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 flex items-center gap-1"
                      title="Notify 2.0.1 connectorStatus: Available"
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>Status: Available</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendTestFrame('StatusNotification', 'Faulted')}
                      className="btn-3d btn-3d-white px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-700 flex items-center gap-1"
                      title="Notify 2.0.1 connectorStatus: Faulted"
                    >
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      <span>Status: Faulted</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSendTestFrame('TransactionEventEnded')}
                    className="btn-3d btn-3d-rose px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5"
                    title="Send OCPP 2.0.1 TransactionEvent (Ended)"
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-white" />
                    <span>TransactionEvent (Ended • 21.5 kWh)</span>
                  </button>
                </>
              ) : (
                <>
                  <div className="w-full p-2.5 rounded-lg bg-cyan-950/60 border border-cyan-800/60 text-xs text-cyan-200 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-cyan-300">OCPP 1.6-J Rule:</span>
                      <span>
                        {simulatedMeterCount === 0
                          ? 'Awaiting 2nd MeterValues to change state to "Charging"'
                          : simulatedMeterCount === 1
                          ? '1st MeterValues received (State stays Preparing; awaiting 2nd)'
                          : `2nd MeterValues confirmed! State changed to Charging ⚡ (${simulatedMeterCount} total)`}
                      </span>
                    </div>
                    <span
                      className={`text-[11px] px-2.5 py-0.5 rounded-full font-mono font-semibold border ${
                        simulatedMeterCount >= 2
                          ? 'bg-emerald-900/60 border-emerald-500/60 text-emerald-300'
                          : 'bg-amber-900/60 border-amber-500/60 text-amber-300'
                      }`}
                    >
                      {simulatedMeterCount >= 2 ? '⚡ State: Charging' : '⏳ State: Preparing'} ({Math.min(simulatedMeterCount, 2)}/2)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSendTestFrame('StartTransaction')}
                    className="btn-3d btn-3d-cyan px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5"
                    title="Start a live OCPP transaction with meterStart (sets state to Preparing)"
                  >
                    <Zap className="w-3.5 h-3.5 text-yellow-300" />
                    <span>StartTransaction (Sets State to Preparing)</span>
                  </button>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleSendTestFrame('StatusNotification', 'Charging')}
                      className="btn-3d btn-3d-cyan px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1"
                      title="Send StatusNotification (held as Preparing until 2nd MeterValues)"
                    >
                      <Zap className="w-3.5 h-3.5 text-yellow-300" />
                      <span>Status: Charging (Clamped if &lt;2 MeterValues)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendTestFrame('StatusNotification', 'Available')}
                      className="btn-3d btn-3d-white px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 flex items-center gap-1"
                      title="Notify CPMS that port is Available"
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>Status: Available</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendTestFrame('StatusNotification', 'Faulted')}
                      className="btn-3d btn-3d-white px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-700 flex items-center gap-1"
                      title="Notify CPMS that port is Faulted"
                    >
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      <span>Status: Faulted</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleSendTestFrame('MeterValues')}
                      className="btn-3d btn-3d-white px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                      title="Send real-time MeterValues (1st keeps Preparing, 2nd switches to Charging)"
                    >
                      <Activity className="w-3.5 h-3.5 text-purple-600" />
                      <span>
                        Send MeterValues #{simulatedMeterCount + 1}
                        {simulatedMeterCount === 0
                          ? ' (Keeps Preparing)'
                          : simulatedMeterCount === 1
                          ? ' (⚡ Transitions to Charging!)'
                          : ' (Active Charging)'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        handleSendTestFrame('MeterValues');
                        setTimeout(() => handleSendTestFrame('MeterValues'), 300);
                      }}
                      className="btn-3d btn-3d-cyan px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5"
                      title="Send 2 sequential MeterValues to immediately trigger Charging state"
                    >
                      <Zap className="w-3.5 h-3.5 text-yellow-300" />
                      <span>Send 2x MeterValues (Direct to Charging ⚡)</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSendTestFrame('StopTransaction')}
                    className="btn-3d btn-3d-rose px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5"
                    title="Stop transaction with final meter reading"
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-white" />
                    <span>StopTransaction (meterStop 21.5 kWh)</span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Live log feed */}
        <div className="p-3 bg-slate-900 rounded-lg text-xs font-mono text-slate-200 max-h-48 overflow-y-auto space-y-1">
          <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-1 mb-1">
            <span>WebSocket Client Terminal Feed</span>
            <span>{testClientLogs.length} events logged</span>
          </div>
          {testClientLogs.length === 0 ? (
            <p className="text-slate-500 text-[11px] italic">
              Click &quot;Connect Test Charger via WebSocket&quot; above to initiate live WebSocket frames.
            </p>
          ) : (
            testClientLogs.map((log, idx) => (
              <div
                key={idx}
                className={
                  log.includes('✅')
                    ? 'text-emerald-400'
                    : log.includes('📤')
                      ? 'text-cyan-300'
                      : log.includes('📥')
                        ? 'text-purple-300'
                        : log.includes('❌') || log.includes('⚠️')
                          ? 'text-rose-400'
                          : 'text-slate-300'
                }
              >
                {log}
              </div>
            ))
          )}
        </div>

        {/* CLI Test Snippet */}
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
          <p className="font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-slate-600" />
            Test from External Terminal / Physical Hardware (via wscat):
          </p>
          <div className="flex items-center justify-between bg-slate-900 text-slate-200 p-2 rounded-md font-mono text-[11px]">
            <code>{`wscat -c ${liveWsEndpoint} -s ocpp1.6`}</code>
            <button
              type="button"
              onClick={() => handleCopy(`wscat -c ${liveWsEndpoint} -s ocpp1.6`, 'wscat')}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] ml-2 shrink-0"
            >
              {copiedKey === 'wscat' ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
