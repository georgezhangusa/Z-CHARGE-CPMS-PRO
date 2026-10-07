import React, { useState, useEffect } from 'react';
import {
  X,
  Zap,
  Activity,
  ShieldCheck,
  RotateCcw,
  Power,
  Play,
  Square,
  Unlock,
  Wrench,
  ChevronDown,
  ChevronUp,
  Clock,
  BatteryCharging,
  Cpu,
  Thermometer,
  ShieldAlert,
  Copy,
  Check,
  Radio,
  Sparkles,
  ArrowRight,
  Database,
  Globe,
  Key,
  Trash2,
  Lock,
  Sliders,
} from 'lucide-react';
import { ChargingStation, OcppMessage, Session } from '../types';
import { getStatusColor, formatKw, formatOcppWsUrl, formatPortStatus } from '../utils';
import { ChargingTimeline } from './ChargingTimeline';
import { useAuth } from '../lib/AuthContext';

interface ChargerDetailDrawerProps {
  station: ChargingStation | null;
  isOpen: boolean;
  onClose: () => void;
  ocppMessages: OcppMessage[];
  sessions?: Session[];
  onTriggerAction: (
    action: 'SoftReset' | 'HardReset' | 'StopCharging' | 'StartCharging' | 'UnlockCable' | 'ToggleMaintenance',
    portNumber?: number
  ) => void;
  onOpenSession?: (sessionId: string) => void;
  onEditCharger?: (station: ChargingStation) => void;
  onDeleteCharger?: (stationId: string) => Promise<void>;
  onRequestDelete?: (station: ChargingStation) => void;
}

export const ChargerDetailDrawer: React.FC<ChargerDetailDrawerProps> = ({
  station,
  isOpen,
  onClose,
  ocppMessages,
  sessions,
  onTriggerAction,
  onOpenSession,
  onEditCharger,
  onDeleteCharger,
  onRequestDelete,
}) => {
  const { permissions, role } = useAuth();
  const [drawerTab, setDrawerTab] = useState<'timeline' | 'overview' | 'trace'>('timeline');
  const [showOcppTrace, setShowOcppTrace] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<OcppMessage | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [tickerTime, setTickerTime] = useState(Date.now());

  // 1-second ticker to update real-time seconds during the 1-min MeterValue interval window
  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => setTickerTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  if (!isOpen || !station) return null;

  const stationMessages = ocppMessages.filter((m) => m.stationId === station.id);

  // Check active session for this station
  const activeSession = sessions?.find(
    (s) => s.stationId === station.id && s.status === 'active'
  );

  // Check recent OCPP messages for MeterValues, StartTransaction, or OCPP 2.0.1 TransactionEvent
  const recentMeterOrStartMsg = stationMessages.find((m) => {
    const act = m.action.toLowerCase();
    if (act.includes('metervalues') || act.includes('starttransaction') || act.includes('requeststarttransaction')) return true;
    if (act.includes('transactionevent')) {
      const eventType = String(m.payload?.eventType || '').toLowerCase();
      return eventType === 'started' || eventType === 'updated';
    }
    return false;
  });

  // Calculate elapsed seconds since last MeterValue or start of active session
  let secondsSinceMeterActivity = 999;
  if (activeSession && activeSession.status === 'active') {
    const lastMv = activeSession.lastMeterValueTimestamp || new Date(activeSession.startTime).getTime();
    secondsSinceMeterActivity = Math.max(0, Math.floor((tickerTime - lastMv) / 1000));
  } else if (recentMeterOrStartMsg) {
    const recentStop = stationMessages.find((m) => {
      const act = m.action.toLowerCase();
      if (act.includes('stoptransaction') || act.includes('requeststoptransaction')) return true;
      if (act.includes('transactionevent')) {
        return String(m.payload?.eventType || '').toLowerCase() === 'ended';
      }
      return false;
    });
    const stopTime = recentStop ? new Date(recentStop.timestamp).getTime() : 0;
    const meterTime = new Date(recentMeterOrStartMsg.timestamp).getTime();
    if (meterTime >= stopTime) {
      secondsSinceMeterActivity = Math.max(0, Math.floor((tickerTime - meterTime) / 1000));
    }
  }

  // Keep charging state for 1 min (60s) to accommodate the MeterValue interval
  const isWithinMeterValueInterval = secondsSinceMeterActivity < 60;
  const remainingIntervalSeconds = Math.max(0, 60 - secondsSinceMeterActivity);

  // Calculate live active charging duration
  const chargingStartMs = (() => {
    if (activeSession?.startTime) {
      const t = new Date(activeSession.startTime).getTime();
      if (!isNaN(t) && t > 0) return t;
    }
    const startMsg = stationMessages.find((m) => {
      const act = m.action.toLowerCase();
      return (
        act.includes('starttransaction') ||
        (act.includes('transactionevent') && String(m.payload?.eventType || '').toLowerCase() === 'started')
      );
    });
    if (startMsg) {
      const t = new Date(startMsg.timestamp).getTime();
      if (!isNaN(t) && t > 0) return t;
    }
    if (recentMeterOrStartMsg) {
      const t = new Date(recentMeterOrStartMsg.timestamp).getTime();
      if (!isNaN(t) && t > 0) return t;
    }
    return null;
  })();

  const chargingDurationSeconds = chargingStartMs
    ? Math.max(0, Math.floor((tickerTime - chargingStartMs) / 1000))
    : activeSession?.durationMinutes
      ? activeSession.durationMinutes * 60
      : 0;

  const formatChargingDuration = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
    }
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  const formattedChargingDuration = formatChargingDuration(chargingDurationSeconds);

  const allConnectors = station.evses.flatMap((e) => e.connectors || []);
  const hasActiveConnectorCharging = allConnectors.some((c) => c.status === 'Charging');

  const isCharging =
    hasActiveConnectorCharging ||
    station.currentLoadKw > 0 ||
    isWithinMeterValueInterval ||
    (!!activeSession && activeSession.status === 'active');

  const effectivePowerKw =
    station.currentLoadKw > 0
      ? station.currentLoadKw
      : activeSession?.currentKw && activeSession.currentKw > 0
        ? activeSession.currentKw
        : 0;

  const headroomKw = Math.max(0, station.totalCapacityKw - effectivePowerKw);
  const loadPercent = Math.min(100, Math.round((effectivePowerKw / station.totalCapacityKw) * 100));

  const isFaulted = allConnectors.some((c) => c.status === 'Faulted');
  const isPreparing = allConnectors.some((c) => c.status === 'Preparing' || c.status === 'Occupied');
  const isSuspended = allConnectors.some((c) => c.status === 'SuspendedEV' || c.status === 'SuspendedEVSE');
  const isFinishing = allConnectors.some((c) => c.status === 'Finishing');
  const isOffline = station.wsStatus === 'disconnected';

  const chargerStateLabel: 'Charging' | 'Occupied' | 'Finishing' | 'Suspended' | 'Faulted' | 'Available' | 'Offline' =
    isFaulted
      ? 'Faulted'
      : isCharging
        ? 'Charging'
        : isFinishing
          ? 'Finishing'
          : isPreparing
            ? 'Occupied'
            : isSuspended
              ? 'Suspended'
              : isOffline
                ? 'Offline'
                : 'Available';

  const handleCopyPayload = (msg: OcppMessage) => {
    navigator.clipboard.writeText(JSON.stringify(msg.payload, null, 2));
    setCopiedId(msg.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/50 backdrop-blur-xs transition-opacity">
      <div
        id="charger-detail-drawer"
        className="w-full max-w-2xl bg-white border-l border-slate-200 text-slate-800 h-full flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-right duration-300"
      >
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-base font-bold text-slate-900 tracking-wider">
                  {station.id}
                </span>
                <span className="text-slate-500 text-sm">/ {station.name}</span>
                <span className="px-2 py-0.5 rounded-sm bg-slate-200 text-slate-700 border border-slate-300 text-[10px] font-mono">
                  {station.ocppVersion}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span>{station.siteName}</span>
                <span>•</span>
                <span>{station.model}</span>
                <span>•</span>
                <span className="font-mono">{station.ipAddress}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Freshness Badge */}
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                  station.wsStatus === 'connected'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : station.wsStatus === 'lag'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    station.wsStatus === 'connected'
                      ? 'bg-emerald-500 animate-pulse'
                      : station.wsStatus === 'lag'
                        ? 'bg-amber-500 animate-ping'
                        : 'bg-rose-500'
                  }`}
                />
                <span>
                  {station.wsStatus === 'connected'
                    ? 'Online'
                    : station.wsStatus === 'lag'
                      ? 'Lag'
                      : 'Offline'}
                </span>
              </div>

              {onEditCharger && (
                <button
                  type="button"
                  id="drawer-header-edit-btn"
                  onClick={() => onEditCharger(station)}
                  className="btn-3d btn-3d-white px-2.5 py-1 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 hover:text-cyan-700 cursor-pointer"
                  title="Edit charger configuration"
                >
                  <Sliders className="w-3.5 h-3.5 text-cyan-600" />
                  <span>Edit</span>
                </button>
              )}

              <button
                id="close-charger-drawer-btn"
                onClick={onClose}
                className="btn-3d btn-3d-white p-1.5 rounded-lg text-slate-500 hover:text-slate-800"
                aria-label="Close drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Station Power & Capacity Headroom Bar */}
          <div className="mt-4 p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2.5">
            <div className="flex flex-wrap justify-between items-center gap-2 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Zap className={`w-4 h-4 ${isCharging ? 'text-cyan-600 animate-bounce' : 'text-slate-500'}`} />
                  <span className="text-slate-800 font-bold text-xs">State:</span>
                </div>
                {/* Prominent Charger State Badge */}
                <span
                  id="charger-current-state-badge"
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border transition-all ${
                    chargerStateLabel === 'Charging'
                      ? 'bg-cyan-50 text-cyan-800 border-cyan-300 ring-2 ring-cyan-400/20 shadow-xs shadow-cyan-500/10'
                      : chargerStateLabel === 'Available'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : chargerStateLabel === 'Occupied'
                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                          : chargerStateLabel === 'Finishing'
                            ? 'bg-violet-50 text-violet-800 border-violet-300'
                            : chargerStateLabel === 'Faulted'
                              ? 'bg-rose-50 text-rose-800 border-rose-300'
                              : 'bg-slate-100 text-slate-700 border-slate-300'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      chargerStateLabel === 'Charging'
                        ? 'bg-cyan-500 shadow-xs shadow-cyan-400/80 animate-ping'
                        : chargerStateLabel === 'Available'
                          ? 'bg-emerald-500'
                          : chargerStateLabel === 'Occupied'
                            ? 'bg-amber-500 animate-pulse'
                            : chargerStateLabel === 'Finishing'
                              ? 'bg-violet-500'
                              : chargerStateLabel === 'Faulted'
                                ? 'bg-rose-500 animate-pulse'
                                : 'bg-slate-400'
                    }`}
                  />
                  <span>{chargerStateLabel}</span>
                  {isCharging && effectivePowerKw > 0 && (
                    <span className="font-mono text-[11px] font-bold text-cyan-900">
                      ({formatKw(effectivePowerKw)})
                    </span>
                  )}
                                    
                  {isCharging && activeSession && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenSession?.(activeSession.id);
                      }}
                      className="text-[10px] font-mono font-bold text-cyan-900 ml-1 bg-cyan-100/90 border border-cyan-300/80 px-1.5 py-0.2 rounded cursor-pointer hover:bg-cyan-200 transition-colors"
                      title={`Active Charging Session ID: ${activeSession.id}. Click to view details.`}
                    >
                      SID: {activeSession.id}
                    </span>
                  )}
                  
                  {isCharging && (
                    <span
                      id="charger-charging-duration-badge"
                      className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-cyan-900 ml-1 bg-cyan-100/90 border border-cyan-300/80 px-1.5 py-0.2 rounded"
                      title={`Active Charging Duration: ${formattedChargingDuration}`}
                    >
                      <Clock className="w-3 h-3 text-cyan-700 shrink-0" />
                      <span>{formattedChargingDuration}</span>
                    </span>
                  )}
                </span>
                <span className="text-slate-400 text-[11px] hidden sm:inline">
                  • {station.isSimultaneous ? 'Dynamic Power Sharing' : 'Mutually Exclusive EVSE'}
                </span>
              </div>
              <div className="font-mono text-slate-800 text-xs">
                <span className="font-bold text-cyan-700">{formatKw(effectivePowerKw)}</span>
                <span className="text-slate-500"> / {formatKw(station.totalCapacityKw)} Max</span>
              </div>
            </div>

            {/* Visual meter with charging animation */}
            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden flex border border-slate-200/80 p-0.5 relative">
              <div
                className={`h-full rounded-full transition-all duration-500 relative overflow-hidden ${
                  isCharging
                    ? 'charging-animated-bar shadow-sm shadow-cyan-400/40'
                    : loadPercent > 85
                      ? 'bg-amber-500'
                      : loadPercent > 0
                        ? 'bg-cyan-600'
                        : 'bg-slate-200'
                }`}
                style={{ width: `${Math.max(isCharging ? 15 : 0, loadPercent)}%` }}
              >
                {/* Charging striped animation overlay */}
                {isCharging && (
                  <div className="absolute inset-0 w-full h-full charging-stripe-overlay opacity-60" />
                )}
              </div>
            </div>

            <div className="flex justify-between items-center text-[11px] text-slate-500 font-mono">
              <span className="flex items-center gap-1.5 flex-wrap">
                <span>Load: {loadPercent}%</span>
                {isCharging && (
                  <span className="text-cyan-700 font-semibold flex items-center gap-1.5">
                    <span className="font-bold flex items-center gap-1 animate-pulse">
                      ⚡ Active Power Transfer
                    </span>
                  </span>
                )}
              </span>
              <span className="text-emerald-700 font-semibold">Headroom: {formatKw(headroomKw)} Available</span>
            </div>
          </div>
        </div>

        {/* Drawer Section Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-100/80 p-1.5 gap-1.5 shrink-0 px-6">
          <button
            type="button"
            id="drawer-tab-timeline-btn"
            onClick={() => setDrawerTab('timeline')}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
              drawerTab === 'timeline'
                ? 'bg-white text-cyan-800 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-cyan-600" />
            <span>Charging Timeline</span>
            <span className="px-1.5 py-0.5 rounded-full bg-cyan-100 text-cyan-800 text-[10px] font-mono font-bold">
              {stationMessages.length}
            </span>
          </button>

          <button
            type="button"
            id="drawer-tab-overview-btn"
            onClick={() => setDrawerTab('overview')}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
              drawerTab === 'overview'
                ? 'bg-white text-slate-800 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-600" />
            <span>Ports & Controls</span>
          </button>

          <button
            type="button"
            id="drawer-tab-trace-btn"
            onClick={() => setDrawerTab('trace')}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
              drawerTab === 'trace'
                ? 'bg-white text-slate-800 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-purple-600" />
            <span>Raw OCPP</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: VISUAL CHARGING TIMELINE */}
          {drawerTab === 'timeline' && (
            <ChargingTimeline
              station={station}
              ocppMessages={ocppMessages}
              sessions={sessions}
              activeSession={activeSession}
              onTriggerAction={onTriggerAction}
              onOpenSession={onOpenSession}
            />
          )}

          {/* TAB 2: OVERVIEW & PORTS */}
          {drawerTab === 'overview' && (
            <>
              {/* Quick glance jump banner to timeline */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-cyan-600 text-white flex items-center justify-center shadow-xs">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800">
                      Chronological Charging Timeline Active
                    </div>
                    <div className="text-[11px] text-slate-600">
                      {stationMessages.length} OCPP events recorded (Starts, Status, MeterValues)
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setDrawerTab('timeline')}
                  className="btn-3d btn-3d-cyan px-3 py-1.5 text-xs rounded-lg font-bold flex items-center gap-1"
                >
                  <span>View Timeline</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* EVSE & Connector Statuses */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    EVSE & Connector Ports
                  </h4>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {station.evses.length} EVSE Circuit{station.evses.length > 1 ? 's' : ''}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {station.evses.map((evse) =>
                    evse.connectors.map((conn) => {
                      const statusStyle = getStatusColor(conn.status);
                      return (
                        <div
                          key={conn.id}
                          className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 relative overflow-hidden"
                        >
                          {/* Port banner */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-sm bg-slate-200 font-mono font-bold text-xs text-slate-800">
                                Port {conn.portNumber}
                              </span>
                              <span className="font-mono text-xs font-bold text-slate-800">
                                {conn.type}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                (Max {conn.maxPowerKw} kW)
                              </span>
                            </div>
                            <div
                              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                              <span>{formatPortStatus(conn.status)}</span>
                            </div>
                          </div>

                          {/* Lockout notice if mutually exclusive */}
                          {conn.lockoutReason && (
                            <div className="p-2 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-center gap-1.5">
                              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                              <span>{conn.lockoutReason}</span>
                            </div>
                          )}

                          {/* SoC / Progress if vehicle attached */}
                          {conn.currentSoc !== undefined && (
                            <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-2">
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-600 flex items-center gap-1.5 font-medium">
                                  <BatteryCharging className="w-4 h-4 text-cyan-600" />
                                  Vehicle Battery SoC
                                </span>
                                <span className="font-mono font-bold text-cyan-700 text-sm">
                                  {conn.currentSoc}%
                                  {conn.targetSoc && (
                                    <span className="text-slate-400 text-xs font-normal">
                                      {' '}
                                      → {conn.targetSoc}% Target
                                    </span>
                                  )}
                                </span>
                              </div>

                              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-cyan-600 transition-all duration-300"
                                  style={{ width: `${conn.currentSoc}%` }}
                                />
                              </div>

                              <div className="flex justify-between text-[10px] text-slate-500 font-mono pt-0.5">
                                <span>ETA to 80%: {conn.timeTo80Min !== undefined ? `${conn.timeTo80Min} mins` : '—'}</span>
                                <span>Full: {conn.etaFullMin !== undefined ? `${conn.etaFullMin} mins` : '—'}</span>
                              </div>
                            </div>
                          )}

                          {/* Live electrical telemetry */}
                          <div className="grid grid-cols-3 gap-2 text-center p-2.5 rounded-lg bg-white border border-slate-200">
                            <div>
                              <div className="text-[10px] text-slate-500 uppercase font-mono">Live Power</div>
                              <div className="text-xs font-mono font-bold text-cyan-700">
                                {conn.currentPowerKw.toFixed(1)} kW
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-500 uppercase font-mono">Voltage</div>
                              <div className="text-xs font-mono font-bold text-slate-800">
                                {conn.voltageV} V
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-500 uppercase font-mono">Current</div>
                              <div className="text-xs font-mono font-bold text-slate-800">
                                {conn.currentA} A
                              </div>
                            </div>
                          </div>

                          {/* Cable Lock & Active Session Link */}
                          <div className="flex items-center justify-between text-[11px] pt-1">
                            <div className="flex items-center gap-1.5 text-slate-600">
                              <Unlock className="w-3.5 h-3.5" />
                              <span>Cable Lock: </span>
                              <span
                                className={
                                  conn.cableLocked ? 'text-amber-700 font-semibold' : 'text-slate-500'
                                }
                              >
                                {conn.cableLocked ? 'Engaged' : 'Unlocked'}
                              </span>
                            </div>

                            {(() => {
                              const sId =
                                conn.activeSessionId ||
                                sessions?.find(
                                  (s) =>
                                    s.stationId === station.id &&
                                    s.portNumber === conn.portNumber &&
                                    s.status === 'active'
                                )?.id;
                              if (!sId) return null;
                              return (
                                <button
                                  type="button"
                                  onClick={() => onOpenSession?.(sId)}
                                  className="text-cyan-700 hover:text-cyan-800 underline font-mono text-[11px] font-semibold cursor-pointer"
                                  title="View active charging session details"
                                >
                                  Session: {sId} →
                                </button>
                              );
                            })()}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Operational Health & Diagnostics Widget (Human-Readable) */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Operational Health & Diagnostics
                </h4>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {/* Contactor */}
                    <div className="p-3 rounded-lg bg-white border border-slate-200">
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mb-1">
                        <Power className="w-3.5 h-3.5 text-slate-400" />
                        DC Contactors
                      </div>
                      <div
                        className={`font-mono text-xs font-bold ${
                          station.health.contactor === 'Closed' ? 'text-cyan-700' : 'text-slate-500'
                        }`}
                      >
                        {station.health.contactor}
                      </div>
                    </div>

                    {/* Cabinet Temp */}
                    <div className="p-3 rounded-lg bg-white border border-slate-200">
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mb-1">
                        <Thermometer className="w-3.5 h-3.5 text-slate-400" />
                        Cabinet Temp
                      </div>
                      <div
                        className={`font-mono text-xs font-bold ${
                          station.health.cabinetTempC > 50
                            ? 'text-rose-600'
                            : station.health.cabinetTempC > 40
                              ? 'text-amber-700'
                              : 'text-emerald-700'
                        }`}
                      >
                        {station.health.cabinetTempC}°C
                      </div>
                    </div>

                    {/* E-Stop */}
                    <div className="p-3 rounded-lg bg-white border border-slate-200">
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mb-1">
                        <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
                        Emergency Stop
                      </div>
                      <div
                        className={`font-mono text-xs font-bold ${
                          station.health.eStop === 'OK' ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        {station.health.eStop}
                      </div>
                    </div>

                    {/* Ground Fault */}
                    <div className="p-3 rounded-lg bg-white border border-slate-200">
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mb-1">
                        <Activity className="w-3.5 h-3.5 text-slate-400" />
                        Ground Isolation
                      </div>
                      <div
                        className={`font-mono text-xs font-bold ${
                          station.health.groundFault === 'Clear' ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        {station.health.groundFault}
                      </div>
                    </div>

                    {/* Gun Lock */}
                    <div className="p-3 rounded-lg bg-white border border-slate-200">
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mb-1">
                        <Unlock className="w-3.5 h-3.5 text-slate-400" />
                        Connector Solenoid
                      </div>
                      <div className="font-mono text-xs font-bold text-slate-800">
                        {station.health.gunLock}
                      </div>
                    </div>

                    {/* Firmware */}
                    <div className="p-3 rounded-lg bg-white border border-slate-200">
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mb-1">
                        <Cpu className="w-3.5 h-3.5 text-slate-400" />
                        Firmware
                      </div>
                      <div className="font-mono text-xs text-slate-800 truncate">
                        {station.health.firmwareVersion}
                      </div>
                    </div>
                  </div>

                  {/* Error code readout */}
                  <div className="p-3 rounded-lg bg-white border border-slate-200 text-xs flex items-start gap-2.5">
                    <span className="font-mono text-slate-500 shrink-0 font-semibold">DIAGNOSTIC:</span>
                    <div>
                      <span
                        className={`font-semibold ${
                          station.health.lastErrorCode === '0x00' ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        [{station.health.lastErrorCode}] {station.health.lastError}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Remote Controls with Safety Interlocks */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Remote Controls & Dispatch Actions
                  </h4>
                  <span className="text-[10px] text-rose-600 font-semibold">Interlock Protected</span>
                </div>

                {!permissions.canTriggerRemoteCommands && (
                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                    <Lock className="w-4 h-4 shrink-0 text-amber-700" />
                    <span>Controls disabled for your role ({role.toUpperCase()}). Elevation required.</span>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    id="drawer-start-charging-btn"
                    disabled={!permissions.canTriggerRemoteCommands}
                    onClick={() => onTriggerAction('StartCharging')}
                    className={`btn-3d btn-3d-cyan p-3 rounded-xl flex items-center gap-2 text-xs font-bold ${
                      !permissions.canTriggerRemoteCommands ? 'opacity-40 cursor-not-allowed' : ''
                    }`}
                  >
                    <Play className="w-4 h-4 fill-current shrink-0 text-white" />
                    <span>Start Charging</span>
                  </button>

                  <button
                    type="button"
                    id="drawer-stop-charging-btn"
                    disabled={!permissions.canTriggerRemoteCommands}
                    onClick={() => onTriggerAction('StopCharging')}
                    className={`btn-3d btn-3d-rose p-3 rounded-xl flex items-center gap-2 text-xs font-bold ${
                      !permissions.canTriggerRemoteCommands ? 'opacity-40 cursor-not-allowed' : ''
                    }`}
                  >
                    <Square className="w-4 h-4 fill-current shrink-0 text-white" />
                    <span>Stop Charging</span>
                  </button>

                  <button
                    type="button"
                    id="drawer-unlock-cable-btn"
                    disabled={!permissions.canTriggerRemoteCommands}
                    onClick={() => onTriggerAction('UnlockCable')}
                    className={`btn-3d btn-3d-white p-3 rounded-xl text-slate-800 flex items-center gap-2 text-xs font-bold ${
                      !permissions.canTriggerRemoteCommands ? 'opacity-40 cursor-not-allowed' : ''
                    }`}
                  >
                    <Unlock className="w-4 h-4 shrink-0 text-slate-600" />
                    <span>Unlock Cable</span>
                  </button>

                  <button
                    type="button"
                    id="drawer-soft-reset-btn"
                    disabled={!permissions.canTriggerRemoteCommands}
                    onClick={() => onTriggerAction('SoftReset')}
                    className={`btn-3d btn-3d-white p-3 rounded-xl text-slate-800 flex items-center gap-2 text-xs font-bold ${
                      !permissions.canTriggerRemoteCommands ? 'opacity-40 cursor-not-allowed' : ''
                    }`}
                  >
                    <RotateCcw className="w-4 h-4 shrink-0 text-slate-600" />
                    <span>Soft Reset</span>
                  </button>

                  <button
                    type="button"
                    id="drawer-hard-reset-btn"
                    disabled={!permissions.canTriggerRemoteCommands}
                    onClick={() => onTriggerAction('HardReset')}
                    className={`btn-3d btn-3d-rose p-3 rounded-xl flex items-center gap-2 text-xs font-bold ${
                      !permissions.canTriggerRemoteCommands ? 'opacity-40 cursor-not-allowed' : ''
                    }`}
                  >
                    <ShieldAlert className="w-4 h-4 shrink-0 text-white" />
                    <span>Hard Reset</span>
                  </button>

                  <button
                    type="button"
                    id="drawer-maintenance-btn"
                    disabled={!permissions.canTriggerRemoteCommands}
                    onClick={() => onTriggerAction('ToggleMaintenance')}
                    className={`btn-3d btn-3d-amber p-3 rounded-xl flex items-center gap-2 text-xs font-bold ${
                      !permissions.canTriggerRemoteCommands ? 'opacity-40 cursor-not-allowed' : ''
                    }`}
                  >
                    <Wrench className="w-4 h-4 shrink-0 text-white" />
                    <span>Maintenance</span>
                  </button>
                </div>
              </div>

              {/* Cloud Webhook & Database Record Card */}
              <div className="p-4 rounded-xl bg-slate-900 text-white space-y-3 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold font-mono text-cyan-300">
                      Cloud Webhook & Internet Connection
                    </span>
                  </div>
                  {station.isDatabasePersisted && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30 flex items-center gap-1">
                      <Database className="w-3 h-3" />
                      Firestore Database
                    </span>
                  )}
                </div>

                <div className="space-y-2 text-xs font-mono">
                  <div>
                    <span className="text-slate-400 text-[11px] block">Webhook Target Endpoint:</span>
                    <div className="p-2 rounded bg-slate-950 border border-slate-800 text-cyan-300 text-[11px] break-all select-all">
                      {formatOcppWsUrl(station.id, station.webhookUrl)}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-400">Connection Mode:</span>
                      <div className="text-slate-200">{station.cloudConnectionMode || 'webhook_bridge'}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Station IP:</span>
                      <div className="text-slate-200">{station.ipAddress}</div>
                    </div>
                  </div>
                </div>

                {/* Configuration & Decommission Actions if permitted */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                  {onEditCharger && (
                    <button
                      type="button"
                      onClick={() => onEditCharger(station)}
                      className="btn-3d btn-3d-white px-3 py-1.5 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:text-cyan-700"
                    >
                      <Sliders className="w-3.5 h-3.5 text-cyan-600" />
                      <span>Edit Configuration</span>
                    </button>
                  )}
                  {permissions.canDeleteCharger && (onRequestDelete || onDeleteCharger) && (
                    <button
                      type="button"
                      id="drawer-delete-charger-btn"
                      onClick={() => {
                        if (onRequestDelete) {
                          onRequestDelete(station);
                        } else if (onDeleteCharger) {
                          onDeleteCharger(station.id);
                        }
                      }}
                      className="btn-3d btn-3d-rose px-3 py-1.5 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs ml-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Decommission Charger Record</span>
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {/* TAB 3: RAW OCPP TRACE */}
          {drawerTab === 'trace' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-cyan-600" />
                  <span className="text-xs font-bold text-slate-800">Raw OCPP Packet Trace</span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-mono">
                    {stationMessages.length} Messages
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setDrawerTab('timeline')}
                  className="text-xs text-cyan-700 hover:text-cyan-800 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Switch to Timeline View →</span>
                </button>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="text-[11px] text-slate-500 font-semibold flex justify-between pb-1 border-b border-slate-200">
                  <span>Timestamp & Direction</span>
                  <span>Action / Payload Inspector</span>
                </div>

                {stationMessages.length === 0 ? (
                  <p className="text-xs text-slate-500 py-3 text-center">No recent OCPP messages logged for this station.</p>
                ) : (
                  stationMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className="p-2.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-xs font-mono flex flex-col gap-1.5 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 text-[11px]">{msg.timestamp}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded-sm text-[10px] font-bold ${
                              msg.direction === 'CP_TO_CS'
                                ? 'bg-cyan-100 text-cyan-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}
                          >
                            {msg.direction === 'CP_TO_CS' ? 'CP → CS' : 'CS → CP'}
                          </span>
                          <span className="font-bold text-slate-800">{msg.action}</span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleCopyPayload(msg)}
                            className="p-1 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-md transition-colors cursor-pointer"
                            title="Copy JSON Payload"
                          >
                            {copiedId === msg.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedMessage(msg)}
                            className="text-[11px] text-cyan-700 hover:text-cyan-900 font-bold hover:underline px-1.5 py-0.5 cursor-pointer"
                          >
                            Inspect
                          </button>
                        </div>
                      </div>

                      {/* Snippet preview */}
                      <pre className="text-[11px] text-slate-600 truncate overflow-hidden bg-slate-50 p-1.5 rounded-sm border border-slate-200">
                        {JSON.stringify(msg.payload)}
                      </pre>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal for Raw JSON Payload Inspection */}
        {selectedMessage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl p-5 space-y-3 text-slate-800">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="text-cyan-700 font-bold">{selectedMessage.action}</span>
                  <span className="text-slate-500">• {selectedMessage.timestamp}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedMessage(null)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 overflow-x-auto max-h-80">
                <pre className="text-xs font-mono text-slate-100">
                  {JSON.stringify(selectedMessage.payload, null, 2)}
                </pre>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleCopyPayload(selectedMessage)}
                  className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-medium rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy JSON</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMessage(null)}
                  className="px-3 py-1.5 text-xs bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-lg cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
