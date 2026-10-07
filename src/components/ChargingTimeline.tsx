import React, { useState, useMemo } from 'react';
import {
  Play,
  Square,
  Activity,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Clock,
  BatteryCharging,
  Gauge,
  ArrowDown,
  ArrowUp,
  Filter,
  RefreshCw,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Cpu,
  ShieldCheck,
  Key,
  PowerOff,
  Radio,
  Search,
  RotateCcw,
  Unlock,
  Info,
  Sparkles,
  Layers,
} from 'lucide-react';
import { ChargingStation, OcppMessage, PortStatus, StopReason, Session } from '../types';
import { formatKw, getStatusColor, getStopReasonBadge, formatPortStatus } from '../utils';

interface ChargingTimelineProps {
  station: ChargingStation;
  ocppMessages: OcppMessage[];
  sessions?: Session[];
  activeSession?: Session;
  onTriggerAction?: (
    action: 'SoftReset' | 'HardReset' | 'StopCharging' | 'StartCharging' | 'UnlockCable' | 'ToggleMaintenance',
    portNumber?: number
  ) => void;
  onOpenSession?: (sessionId: string) => void;
}

type EventCategoryFilter = 'all' | 'start_stop' | 'status' | 'meter' | 'commands';

interface ParsedMeterValues {
  powerKw?: number;
  soc?: number;
  voltageV?: number;
  currentA?: number;
  energyKwh?: number;
  timestamp?: string;
  rawSampled?: Array<{ measurand?: string; value: string; unit?: string }>;
}

export const ChargingTimeline: React.FC<ChargingTimelineProps> = ({
  station,
  ocppMessages,
  sessions,
  activeSession,
  onTriggerAction,
  onOpenSession,
}) => {
  // Chronological order: default to true (Oldest -> Newest) as requested
  const [chronologicalAsc, setChronologicalAsc] = useState<boolean>(true);
  const [categoryFilter, setCategoryFilter] = useState<EventCategoryFilter>('all');
  const [portFilter, setPortFilter] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedPayloadIds, setExpandedPayloadIds] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filter messages belonging to this station
  const stationMessages = useMemo(() => {
    return ocppMessages.filter((m) => m.stationId === station.id);
  }, [ocppMessages, station.id]);

  // Parse timestamps helper to safely sort chronologically
  const parseTimestampToSeconds = (ts: string): number => {
    if (!ts) return 0;
    // If full ISO or date string
    if (ts.includes('T') || ts.includes('-')) {
      const parsed = Date.parse(ts);
      if (!isNaN(parsed)) return parsed / 1000;
    }
    // If HH:MM:SS
    const parts = ts.split(':').map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 0;
  };

  // Helper to categorize messages
  const getEventCategory = (action: string, payload?: Record<string, unknown>): EventCategoryFilter => {
    const act = action.toLowerCase();
    if (act.includes('transactionevent')) {
      const eventType = String(payload?.eventType || '').toLowerCase();
      if (eventType === 'started' || eventType === 'ended') return 'start_stop';
      if (eventType === 'updated') return 'meter';
      return 'start_stop';
    }
    if (act.includes('start') || act.includes('stop') || act.includes('requeststart') || act.includes('requeststop')) return 'start_stop';
    if (act.includes('statusnotification') || act.includes('notifyevent')) return 'status';
    if (act.includes('metervalues')) return 'meter';
    return 'commands';
  };

  // Helper to extract port number from message (supports OCPP 1.6 connectorId and OCPP 2.0.1 evse.id / evseId)
  const extractPortNumber = (msg: OcppMessage): number | null => {
    const p = msg.payload;
    if (typeof p.connectorId === 'number' && p.connectorId > 0) return p.connectorId;
    if (typeof p.evseId === 'number' && p.evseId > 0) return p.evseId;
    if (typeof p.portNumber === 'number' && p.portNumber > 0) return p.portNumber;
    if (typeof p.evse === 'object' && p.evse !== null) {
      const evse = p.evse as { id?: number; connectorId?: number };
      if (typeof evse.connectorId === 'number' && evse.connectorId > 0) return evse.connectorId;
      if (typeof evse.id === 'number' && evse.id > 0) return evse.id;
    }
    return null;
  };

  // Helper to extract meter values (supports OCPP 1.6 and 2.0.1 unitOfMeasure, multipliers, and measurands)
  const extractMeterValues = (payload: Record<string, unknown>): ParsedMeterValues => {
    const result: ParsedMeterValues = {};

    const rawMv = payload.meterValue || payload.meterValues;
    const mvList = Array.isArray(rawMv) ? rawMv : rawMv && typeof rawMv === 'object' ? [rawMv] : [];

    for (const mv of mvList) {
      if (mv && typeof mv === 'object') {
        if (mv.timestamp) result.timestamp = String(mv.timestamp);
        const sampled = Array.isArray(mv.sampledValue) ? mv.sampledValue : [];
        if (sampled.length > 0) {
          result.rawSampled = sampled;
          sampled.forEach((item: { measurand?: string; value: string | number; unit?: string; unitOfMeasure?: { unit?: string; multiplier?: number } }) => {
            const meas = String(item.measurand || '').toLowerCase();
            // In OCPP 2.0.1, unit may be inside unitOfMeasure object or directly unit string
            const unit = String(item.unit || item.unitOfMeasure?.unit || '').toLowerCase();
            const multiplier = typeof item.unitOfMeasure?.multiplier === 'number' ? item.unitOfMeasure.multiplier : 0;
            let val = typeof item.value === 'number' ? item.value : parseFloat(String(item.value || ''));
            if (isNaN(val)) return;

            if (multiplier !== 0) {
              val = val * Math.pow(10, multiplier);
            }

            if (meas.includes('power.active') || meas.includes('power.offered') || meas === 'power') {
              const isWatts = unit === 'w' || unit === 'va' || unit === 'var' || (unit !== 'kw' && val > 1000);
              result.powerKw = isWatts ? Number((val / 1000).toFixed(2)) : Number(val.toFixed(2));
            } else if (
              meas.includes('soc') ||
              meas.includes('stateofcharge') ||
              meas === 'percent' ||
              unit.includes('percent') ||
              unit === '%'
            ) {
              result.soc = val;
            } else if (meas.includes('voltage')) {
              result.voltageV = val;
            } else if (meas.includes('current')) {
              result.currentA = val;
            } else if (meas.includes('energy.active') || meas.includes('energy')) {
              result.energyKwh = unit === 'wh' ? val / 1000 : val;
            }
          });
        }
      }
    }

    // Direct fallback attributes
    if (result.powerKw === undefined && typeof payload.powerKw === 'number') result.powerKw = payload.powerKw;
    if (result.soc === undefined && typeof payload.soc === 'number') result.soc = payload.soc;
    if (result.voltageV === undefined && typeof payload.voltageV === 'number') result.voltageV = payload.voltageV;
    if (result.currentA === undefined && typeof payload.currentA === 'number') result.currentA = payload.currentA;
    if (result.energyKwh === undefined && typeof payload.energyKwh === 'number') result.energyKwh = payload.energyKwh;

    return result;
  };

  // Filter and sort messages
  const filteredMessages = useMemo(() => {
    return stationMessages
      .filter((msg) => {
        // Category filter
        if (categoryFilter !== 'all') {
          const cat = getEventCategory(msg.action, msg.payload);
          if (cat !== categoryFilter) return false;
        }

        // Port filter
        if (portFilter !== 'all') {
          const port = extractPortNumber(msg);
          if (port !== null && port !== portFilter) return false;
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchAction = msg.action.toLowerCase().includes(q);
          const matchPayload = JSON.stringify(msg.payload).toLowerCase().includes(q);
          const matchTime = msg.timestamp.toLowerCase().includes(q);
          if (!matchAction && !matchPayload && !matchTime) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const timeA = parseTimestampToSeconds(a.timestamp);
        const timeB = parseTimestampToSeconds(b.timestamp);
        if (timeA !== timeB) {
          return chronologicalAsc ? timeA - timeB : timeB - timeA;
        }
        // Secondary stable sort by ID
        return chronologicalAsc ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id);
      });
  }, [stationMessages, categoryFilter, portFilter, searchQuery, chronologicalAsc]);

  // Timeline Summary Statistics
  const timelineStats = useMemo(() => {
    let peakPowerKw = 0;
    let totalEnergyKwh = 0;
    let startCount = 0;
    let stopCount = 0;
    let meterCount = 0;
    let statusCount = 0;

    // 1. Direct real-time connector SoC from station hardware
    let realTimeConnectorSoc: number | null = null;
    if (station && Array.isArray(station.evses)) {
      if (portFilter !== 'all') {
        const targetConn = station.evses
          .flatMap((e) => e.connectors || [])
          .find((c) => c.portNumber === portFilter);
        if (targetConn && typeof targetConn.currentSoc === 'number' && targetConn.currentSoc > 0) {
          realTimeConnectorSoc = targetConn.currentSoc;
        }
      } else {
        const anyActiveConn = station.evses
          .flatMap((e) => e.connectors || [])
          .find((c) => typeof c.currentSoc === 'number' && c.currentSoc > 0);
        if (anyActiveConn && typeof anyActiveConn.currentSoc === 'number') {
          realTimeConnectorSoc = anyActiveConn.currentSoc;
        }
      }
    }

    // 2. Sort meter messages newest-first to extract the newest MeterValues / TransactionEvent SoC
    const sortedMeterMessages = [...stationMessages]
      .filter((m) => {
        const act = m.action.toLowerCase();
        return act.includes('metervalues') || (act.includes('transactionevent') && (m.payload.meterValue || m.payload.meterValues));
      })
      .sort((a, b) => parseTimestampToSeconds(b.timestamp) - parseTimestampToSeconds(a.timestamp));

    let latestOcppMeterSoc: number | null = null;
    for (const msg of sortedMeterMessages) {
      if (portFilter !== 'all') {
        const port = extractPortNumber(msg);
        if (port !== null && port !== portFilter) continue;
      }
      const mv = extractMeterValues(msg.payload);
      if (mv.soc !== undefined && !isNaN(mv.soc)) {
        latestOcppMeterSoc = mv.soc;
        break; // Stop at newest
      }
    }

    stationMessages.forEach((msg) => {
      const act = msg.action.toLowerCase();
      const eventType = String(msg.payload?.eventType || '').toLowerCase();
      const msgPort = extractPortNumber(msg);
      const isMatchingPort = portFilter === 'all' || msgPort === null || msgPort === portFilter;

      if (
        act.includes('starttransaction') ||
        act.includes('requeststarttransaction') ||
        (act.includes('transactionevent') && eventType === 'started')
      ) {
        if (isMatchingPort) startCount++;
      }
      if (
        act.includes('stoptransaction') ||
        act.includes('requeststoptransaction') ||
        (act.includes('transactionevent') && eventType === 'ended')
      ) {
        if (isMatchingPort) stopCount++;
      }
      if (
        act.includes('metervalues') ||
        (act.includes('transactionevent') && (msg.payload?.meterValue || msg.payload?.meterValues))
      ) {
        if (isMatchingPort) {
          meterCount++;
          const mv = extractMeterValues(msg.payload);
          if (mv.powerKw && mv.powerKw > peakPowerKw) peakPowerKw = mv.powerKw;
          if (mv.energyKwh && mv.energyKwh > totalEnergyKwh) totalEnergyKwh = mv.energyKwh;
        }
      }
      if (act.includes('statusnotification') || act.includes('notifyevent')) {
        if (isMatchingPort) statusCount++;
      }
    });

    // 3. Authoritative Session Peak Power from sessions (guarantees consistency with SessionsView)
    let sessionPeakKw = 0;
    const matchingSessions = (sessions || []).filter((s) => {
      if (s.stationId !== station.id) return false;
      if (portFilter !== 'all' && s.portNumber !== portFilter) return false;
      return true;
    });

    if (activeSession && (portFilter === 'all' || activeSession.portNumber === portFilter)) {
      sessionPeakKw = Math.max(sessionPeakKw, activeSession.peakKw || activeSession.currentKw || 0);
    }

    if (matchingSessions.length > 0) {
      for (const s of matchingSessions) {
        if (typeof s.peakKw === 'number' && s.peakKw > sessionPeakKw) {
          sessionPeakKw = s.peakKw;
        } else if (typeof s.currentKw === 'number' && s.currentKw > sessionPeakKw) {
          sessionPeakKw = s.currentKw;
        }
      }
      if (totalEnergyKwh === 0) {
        const maxSessionEnergy = Math.max(0, ...matchingSessions.map((s) => s.energyKwh || 0));
        if (maxSessionEnergy > 0) totalEnergyKwh = maxSessionEnergy;
      }
    }

    // 4. Hardware connector current power fallback
    const connectorPower = (station.evses || [])
      .flatMap((e) => e.connectors || [])
      .filter((c) => portFilter === 'all' || c.portNumber === portFilter)
      .map((c) => c.currentPowerKw || 0);
    const maxConnectorKw = connectorPower.length > 0 ? Math.max(0, ...connectorPower) : 0;

    const resolvedPeakPower = Math.max(peakPowerKw, sessionPeakKw, maxConnectorKw);

    // Real-time resolved SoC from MeterValues
    const latestSoc = latestOcppMeterSoc !== null ? latestOcppMeterSoc : realTimeConnectorSoc;

    return {
      totalEvents: stationMessages.length,
      peakPowerKw: resolvedPeakPower,
      latestSoc,
      totalEnergyKwh,
      startCount,
      stopCount,
      meterCount,
      statusCount,
    };
  }, [stationMessages, station, portFilter, sessions, activeSession]);

  const togglePayloadExpand = (id: string) => {
    setExpandedPayloadIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Get visually distinctive metadata for each event (supporting both OCPP 1.6-J and OCPP 2.0.1)
  const getEventVisualMeta = (msg: OcppMessage) => {
    const action = msg.action;
    const isResponse = action.endsWith('Response');

    // OCPP 2.0.1 TransactionEvent (Core lifecycle)
    if (action.includes('TransactionEvent')) {
      const eventType = String(msg.payload?.eventType || 'Updated');
      if (eventType.toLowerCase() === 'started') {
        return {
          badgeColor: 'bg-emerald-600 text-white',
          ringColor: 'ring-emerald-200 border-emerald-500',
          lineColor: 'bg-emerald-400',
          bgCard: 'bg-emerald-50/40 border-emerald-200 hover:border-emerald-300',
          icon: <Play className="w-4 h-4 fill-current" />,
          typeLabel: 'OCPP 2.0.1 Session Start',
          isKey: true,
        };
      }
      if (eventType.toLowerCase() === 'ended') {
        return {
          badgeColor: 'bg-rose-600 text-white',
          ringColor: 'ring-rose-200 border-rose-500',
          lineColor: 'bg-rose-400',
          bgCard: 'bg-rose-50/40 border-rose-200 hover:border-rose-300',
          icon: <Square className="w-4 h-4 fill-current" />,
          typeLabel: 'OCPP 2.0.1 Session Stop',
          isKey: true,
        };
      }
      return {
        badgeColor: 'bg-cyan-600 text-white',
        ringColor: 'ring-cyan-200 border-cyan-500',
        lineColor: 'bg-cyan-400',
        bgCard: 'bg-cyan-50/30 border-cyan-200 hover:border-cyan-300',
        icon: <Gauge className="w-4 h-4" />,
        typeLabel: 'OCPP 2.0.1 Telemetry Update',
        isKey: true,
      };
    }

    if (action.includes('StartTransaction') || action.includes('RequestStartTransaction')) {
      return {
        badgeColor: 'bg-emerald-600 text-white',
        ringColor: 'ring-emerald-200 border-emerald-500',
        lineColor: 'bg-emerald-400',
        bgCard: 'bg-emerald-50/40 border-emerald-200 hover:border-emerald-300',
        icon: <Play className="w-4 h-4 fill-current" />,
        typeLabel: action.includes('Request') ? '2.0.1 Request Start' : 'Session Start',
        isKey: true,
      };
    }
    if (action.includes('StopTransaction') || action.includes('RequestStopTransaction')) {
      return {
        badgeColor: 'bg-rose-600 text-white',
        ringColor: 'ring-rose-200 border-rose-500',
        lineColor: 'bg-rose-400',
        bgCard: 'bg-rose-50/40 border-rose-200 hover:border-rose-300',
        icon: <Square className="w-4 h-4 fill-current" />,
        typeLabel: action.includes('Request') ? '2.0.1 Request Stop' : 'Session Stop',
        isKey: true,
      };
    }
    if (action.includes('MeterValues')) {
      return {
        badgeColor: 'bg-cyan-600 text-white',
        ringColor: 'ring-cyan-200 border-cyan-500',
        lineColor: 'bg-cyan-400',
        bgCard: 'bg-cyan-50/30 border-cyan-200 hover:border-cyan-300',
        icon: <Gauge className="w-4 h-4" />,
        typeLabel: 'Meter Values & Power',
        isKey: true,
      };
    }
    if (action.includes('StatusNotification')) {
      // Support both 1.6 status and 2.0.1 connectorStatus
      const raw = String(msg.payload.connectorStatus || msg.payload.status || 'Available');
      const statusMap: Record<string, PortStatus> = {
        available: 'Available',
        occupied: 'Occupied',
        charging: 'Charging',
        preparing: 'Occupied',
        suspendedev: 'SuspendedEV',
        suspendedevse: 'SuspendedSystem',
        finishing: 'Finishing',
        reserved: 'Reserved',
        unavailable: 'Offline',
        faulted: 'Faulted',
      };
      const status: PortStatus = statusMap[raw.toLowerCase()] || (raw as PortStatus) || 'Available';
      return {
        badgeColor:
          status === 'Faulted'
            ? 'bg-rose-600 text-white'
            : status === 'Charging'
              ? 'bg-cyan-600 text-white'
              : status === 'Finishing'
                ? 'bg-violet-600 text-white'
                : 'bg-amber-600 text-white',
        ringColor:
          status === 'Faulted'
            ? 'ring-rose-200 border-rose-500'
            : status === 'Charging'
              ? 'ring-cyan-200 border-cyan-500'
              : status === 'Finishing'
                ? 'ring-violet-200 border-violet-500'
                : 'ring-amber-200 border-amber-500',
        lineColor: status === 'Charging' ? 'bg-cyan-400' : 'bg-amber-400',
        bgCard:
          status === 'Faulted'
            ? 'bg-rose-50/40 border-rose-200'
            : status === 'Charging'
              ? 'bg-cyan-50/30 border-cyan-200'
              : status === 'Finishing'
                ? 'bg-violet-50/30 border-violet-200'
                : 'bg-amber-50/30 border-amber-200',
        icon:
          status === 'Faulted'
            ? <AlertTriangle className="w-4 h-4" />
            : status === 'Charging'
              ? <Zap className="w-4 h-4" />
              : <RefreshCw className="w-4 h-4" />,
        typeLabel: `Status: ${formatPortStatus(status)}`,
        isKey: true,
      };
    }
    if (action.includes('Authorize')) {
      return {
        badgeColor: 'bg-purple-600 text-white',
        ringColor: 'ring-purple-200 border-purple-500',
        lineColor: 'bg-purple-400',
        bgCard: 'bg-purple-50/30 border-purple-200',
        icon: <Key className="w-4 h-4" />,
        typeLabel: 'Authorization',
        isKey: false,
      };
    }
    if (action.includes('BootNotification')) {
      return {
        badgeColor: 'bg-indigo-600 text-white',
        ringColor: 'ring-indigo-200 border-indigo-500',
        lineColor: 'bg-indigo-400',
        bgCard: 'bg-indigo-50/30 border-indigo-200',
        icon: <Cpu className="w-4 h-4" />,
        typeLabel: 'Hardware Boot',
        isKey: false,
      };
    }
    if (action.includes('NotifyEvent')) {
      return {
        badgeColor: 'bg-amber-600 text-white',
        ringColor: 'ring-amber-200 border-amber-500',
        lineColor: 'bg-amber-400',
        bgCard: 'bg-amber-50/30 border-amber-200',
        icon: <AlertTriangle className="w-4 h-4" />,
        typeLabel: '2.0.1 Event Notification',
        isKey: false,
      };
    }
    if (action.includes('NotifyReport')) {
      return {
        badgeColor: 'bg-indigo-600 text-white',
        ringColor: 'ring-indigo-200 border-indigo-500',
        lineColor: 'bg-indigo-400',
        bgCard: 'bg-indigo-50/30 border-indigo-200',
        icon: <Layers className="w-4 h-4" />,
        typeLabel: '2.0.1 Device Report',
        isKey: false,
      };
    }
    if (action.includes('Reset') || action.includes('UnlockConnector')) {
      return {
        badgeColor: 'bg-orange-600 text-white',
        ringColor: 'ring-orange-200 border-orange-500',
        lineColor: 'bg-orange-400',
        bgCard: 'bg-orange-50/30 border-orange-200',
        icon: action.includes('Unlock') ? <Unlock className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />,
        typeLabel: action.includes('Unlock') ? 'Cable Unlock' : 'Reset Command',
        isKey: false,
      };
    }
    if (action.includes('Heartbeat')) {
      return {
        badgeColor: 'bg-slate-600 text-white',
        ringColor: 'ring-slate-200 border-slate-400',
        lineColor: 'bg-slate-300',
        bgCard: 'bg-slate-50 border-slate-200',
        icon: <Radio className="w-4 h-4" />,
        typeLabel: 'Heartbeat Ping',
        isKey: false,
      };
    }

    return {
      badgeColor: isResponse ? 'bg-slate-500 text-white' : 'bg-slate-700 text-white',
      ringColor: 'ring-slate-200 border-slate-300',
      lineColor: 'bg-slate-300',
      bgCard: 'bg-slate-50 border-slate-200',
      icon: <Layers className="w-4 h-4" />,
      typeLabel: action,
      isKey: false,
    };
  };

  return (
    <div className="space-y-4" id="charging-timeline-container">
      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-cyan-600" />
            Peak Session Power
          </div>
          <div className="mt-1 text-base font-bold font-mono text-slate-900">
            {timelineStats.peakPowerKw > 0 ? formatKw(timelineStats.peakPowerKw) : '—'}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
            Rated: {station.totalCapacityKw} kW Max
          </div>
        </div>

        <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="text-[11px] text-slate-500 font-medium flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <BatteryCharging className="w-3.5 h-3.5 text-emerald-600" />
              Battery SoC
            </span>
          </div>
          <div className="mt-1 text-base font-bold font-mono text-emerald-700 flex items-baseline gap-1.5">
            <span>{timelineStats.latestSoc !== null ? `${timelineStats.latestSoc}%` : '—'}</span>
            {timelineStats.latestSoc !== null && (
              <span className="text-[10px] font-sans font-normal text-slate-400">State of Charge</span>
            )}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-blue-600" />
            Energy Metered
          </div>
          <div className="mt-1 text-base font-bold font-mono text-slate-900">
            {timelineStats.totalEnergyKwh > 0 ? `${timelineStats.totalEnergyKwh.toFixed(1)} kWh` : '—'}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Active register total
          </div>
        </div>

        <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
            Timeline Events
          </div>
          <div className="mt-1 text-base font-bold font-mono text-slate-900">
            {stationMessages.length} Total
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {timelineStats.startCount} Starts • {timelineStats.statusCount} Status
          </div>
        </div>
      </div>

      {/* Control Bar: Chronological Order & Filters */}
      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Chronological Sorting Switcher */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              Timeline Order:
            </span>
            <button
              type="button"
              id="timeline-sort-chronological-btn"
              onClick={() => setChronologicalAsc(true)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center gap-1 transition-all cursor-pointer ${
                chronologicalAsc
                  ? 'btn-3d btn-3d-cyan text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <ArrowDown className="w-3 h-3" />
              <span>Chronological (Start → Latest)</span>
            </button>

            <button
              type="button"
              id="timeline-sort-reverse-btn"
              onClick={() => setChronologicalAsc(false)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center gap-1 transition-all cursor-pointer ${
                !chronologicalAsc
                  ? 'btn-3d btn-3d-cyan text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <ArrowUp className="w-3 h-3" />
              <span>Newest First</span>
            </button>
          </div>
        </div>

        {/* Filter Pills & Search */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/80">
          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Filter:
            </span>

            {(
              [
                { id: 'all', label: 'All Events' },
                { id: 'start_stop', label: '⚡ Starts & Stops' },
                { id: 'meter', label: '📊 MeterValues' },
                { id: 'status', label: '🔄 Status Updates' },
                { id: 'commands', label: '🛠 Commands' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setCategoryFilter(item.id)}
                className={`px-2 py-0.5 text-xs rounded-full font-medium transition-colors cursor-pointer ${
                  categoryFilter === item.id
                    ? 'bg-slate-800 text-white shadow-2xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Port Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-slate-500">Port:</span>
            <select
              value={portFilter}
              onChange={(e) => {
                const val = e.target.value;
                setPortFilter(val === 'all' ? 'all' : Number(val));
              }}
              className="px-2 py-1 text-xs bg-white border border-slate-200 rounded-md font-mono text-slate-700 focus:outline-hidden focus:border-cyan-500 cursor-pointer"
            >
              <option value="all">All Ports</option>
              {station.evses.flatMap((evse) =>
                evse.connectors.map((conn) => (
                  <option key={conn.id} value={conn.portNumber}>
                    Port {conn.portNumber} ({conn.type})
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Text Filter Bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search action name, idTag, error code, or payload values..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8.5 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-cyan-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Chronological Flow Indicator Badge */}
      <div className="flex items-center justify-between px-2 text-[11px] text-slate-500 font-medium">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-cyan-500" />
          <span>
            {chronologicalAsc
              ? 'Chronological Order (Earliest event at top ➔ Latest event at bottom)'
              : 'Reverse Chronological Order (Latest event at top ➔ Earliest event at bottom)'}
          </span>
        </div>
        <span className="font-mono">
          Showing {filteredMessages.length} of {stationMessages.length} events
        </span>
      </div>

      {/* Empty State */}
      {filteredMessages.length === 0 && (
        <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-2xl space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-slate-200 text-slate-500 flex items-center justify-center">
            <Radio className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h5 className="text-sm font-bold text-slate-800">No matching timeline events found</h5>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery || categoryFilter !== 'all' || portFilter !== 'all'
                ? 'Try adjusting your filters or search terms.'
                : 'No OCPP messages recorded for this station yet.'}
            </p>
          </div>
        </div>
      )}

      {/* Visual Timeline Spine and Nodes */}
      <div className="relative pl-6 space-y-6 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-gradient-to-b before:from-cyan-400 before:via-slate-300 before:to-slate-200">
        {filteredMessages.map((msg, index) => {
          const visual = getEventVisualMeta(msg);
          const port = extractPortNumber(msg);
          const isExpanded = !!expandedPayloadIds[msg.id];
          const isCopied = copiedId === msg.id;

          // Data extractors supporting both OCPP 1.6-J and OCPP 2.0.1
          const eventType = String(msg.payload?.eventType || '').toLowerCase();
          const isTransactionEvent = msg.action.includes('TransactionEvent');
          const isStartEvent =
            msg.action.includes('StartTransaction') ||
            msg.action.includes('RequestStartTransaction') ||
            (isTransactionEvent && eventType === 'started');
          const isStopEvent =
            msg.action.includes('StopTransaction') ||
            msg.action.includes('RequestStopTransaction') ||
            (isTransactionEvent && eventType === 'ended');
          const isMeterEvent =
            msg.action.includes('MeterValues') ||
            (isTransactionEvent && !!(msg.payload.meterValue || msg.payload.meterValues));

          const meterValues = isMeterEvent ? extractMeterValues(msg.payload) : null;

          // Status extractor
          const rawStatus = String(
            msg.payload.connectorStatus ||
            msg.payload.status ||
            (isTransactionEvent && (msg.payload.transactionInfo as any)?.chargingState) ||
            ''
          );
          const statusMap: Record<string, PortStatus> = {
            available: 'Available',
            occupied: 'Occupied',
            charging: 'Charging',
            preparing: 'Occupied',
            suspendedev: 'SuspendedEV',
            suspendedevse: 'SuspendedSystem',
            finishing: 'Finishing',
            reserved: 'Reserved',
            unavailable: 'Offline',
            faulted: 'Faulted',
            idle: 'Available',
            evconnected: 'Occupied',
          };
          const statusVal: PortStatus | null = rawStatus ? (statusMap[rawStatus.toLowerCase()] || (rawStatus as PortStatus)) : null;
          const statusStyle = statusVal ? getStatusColor(statusVal) : null;

          // Stop reason extractor
          const stopReason = isStopEvent
            ? ((msg.payload.transactionInfo as any)?.stoppedReason as StopReason) ||
              (msg.payload.reason as StopReason) ||
              (msg.payload.stopReason as StopReason)
            : null;
          const stopBadge = stopReason ? getStopReasonBadge(stopReason) : null;

          // Transaction ID extractor
          const resolvedTxId = (msg.payload.transactionInfo as any)?.transactionId || msg.payload.transactionId;

          // Auth Tag / Identity extractor
          const authTag = String(
            (msg.payload.idToken as any)?.idToken ||
            msg.payload.idTag ||
            (msg.payload.transactionInfo as any)?.transactionId ||
            ''
          );

          // Boot Notification extractor
          const bootVendor = String((msg.payload.chargingStation as any)?.vendorName || msg.payload.chargePointVendor || msg.payload.vendor || '');
          const bootModel = String((msg.payload.chargingStation as any)?.model || msg.payload.chargePointModel || msg.payload.model || '');
          const bootFirmware = String((msg.payload.chargingStation as any)?.firmwareVersion || msg.payload.firmwareVersion || '');
          const bootReason = String(msg.payload.reason || '');

          return (
            <div key={msg.id} className="relative group">
              {/* Timeline Spine Node Marker */}
              <div
                className={`absolute -left-6 top-3 -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center shadow-xs border-2 bg-white transition-transform group-hover:scale-110 ${visual.ringColor}`}
              >
                <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold ${visual.badgeColor}`}>
                  {visual.icon}
                </div>
              </div>

              {/* Event Card */}
              <div
                className={`rounded-2xl border transition-all p-4 space-y-3 shadow-xs ${visual.bgCard}`}
              >
                {/* Header: Timestamp, Action, Port, Direction, Step Number */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-slate-200/80 font-mono text-[11px] font-bold text-slate-700">
                      {msg.timestamp}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider ${
                        msg.direction === 'CP_TO_CS'
                          ? 'bg-cyan-100 text-cyan-800 border border-cyan-200'
                          : 'bg-purple-100 text-purple-800 border border-purple-200'
                      }`}
                      title={
                        msg.direction === 'CP_TO_CS'
                          ? 'Charge Point sent message to Central System'
                          : 'Central System sent command to Charge Point'
                      }
                    >
                      {msg.direction === 'CP_TO_CS' ? 'CP ➔ CS' : 'CS ➔ CP'}
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-900 tracking-tight">
                      {msg.action}
                    </span>
                    {isTransactionEvent && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-100 text-cyan-800">
                        OCPP 2.0.1 • {msg.payload?.eventType || 'Event'}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {port !== null && (
                      <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 font-mono text-[11px] font-semibold">
                        Port {port}
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-slate-400">
                      Step #{index + 1}
                    </span>
                  </div>
                </div>

                {/* Specific Event Highlight Content */}

                {/* 1. METER VALUES & 2.0.1 TELEMETRY DISPLAY */}
                {meterValues && (
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Gauge className="w-3.5 h-3.5 text-cyan-600" />
                        Live Electrical Telemetry {isTransactionEvent && <span className="text-[10px] text-cyan-700 font-mono font-normal">(OCPP 2.0.1)</span>}
                      </span>
                      {meterValues.powerKw !== undefined && (
                        <span className="font-mono text-xs font-bold text-cyan-700">
                          {formatKw(meterValues.powerKw)}
                        </span>
                      )}
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                      {meterValues.powerKw !== undefined && (
                        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                          <div className="text-[10px] text-slate-400 uppercase font-mono">Active Power</div>
                          <div className="text-xs font-mono font-bold text-cyan-700">
                            {meterValues.powerKw.toFixed(1)} kW
                          </div>
                        </div>
                      )}

                      {meterValues.soc !== undefined && (
                        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                          <div className="text-[10px] text-slate-400 uppercase font-mono">Battery SoC</div>
                          <div className="text-xs font-mono font-bold text-emerald-700">
                            {meterValues.soc}%
                          </div>
                        </div>
                      )}

                      {meterValues.voltageV !== undefined && (
                        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                          <div className="text-[10px] text-slate-400 uppercase font-mono">Voltage</div>
                          <div className="text-xs font-mono font-bold text-slate-800">
                            {meterValues.voltageV.toFixed(1)} V
                          </div>
                        </div>
                      )}

                      {meterValues.currentA !== undefined && (
                        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                          <div className="text-[10px] text-slate-400 uppercase font-mono">Current</div>
                          <div className="text-xs font-mono font-bold text-slate-800">
                            {meterValues.currentA.toFixed(1)} A
                          </div>
                        </div>
                      )}
                    </div>

                    {/* SoC Progress Bar if present */}
                    {meterValues.soc !== undefined && (
                      <div className="space-y-1 pt-1">
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-300"
                            style={{ width: `${Math.min(100, meterValues.soc)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                          <span>0%</span>
                          <span>Charging Progress: {meterValues.soc}%</span>
                          <span>100%</span>
                        </div>
                      </div>
                    )}

                    {meterValues.energyKwh !== undefined && (
                      <div className="text-[11px] text-slate-600 flex justify-between items-center pt-1 border-t border-slate-100 font-mono">
                        <span>Energy Register:</span>
                        <span className="font-bold text-slate-800">{meterValues.energyKwh.toFixed(2)} kWh</span>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. STATUS NOTIFICATION & CHARGING STATE DISPLAY */}
                {((msg.action.includes('StatusNotification') || (isTransactionEvent && (msg.payload.transactionInfo as any)?.chargingState)) && statusVal && statusStyle) && (
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-600 font-medium">Connector State:</span>
                        <span
                          className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
                        >
                          <span className={`w-2 h-2 rounded-full ${statusStyle.dot}`} />
                          <span>{formatPortStatus(statusVal)}</span>
                        </span>
                        {isTransactionEvent && (
                          <span className="text-[10px] font-mono text-cyan-800 bg-cyan-50 px-1.5 py-0.5 rounded border border-cyan-200">
                            State: {formatPortStatus((msg.payload.transactionInfo as any)?.chargingState)}
                          </span>
                        )}
                      </div>

                      {msg.payload.errorCode && (
                        <span
                          className={`font-mono text-xs font-semibold px-2 py-0.5 rounded ${
                            msg.payload.errorCode === 'NoError'
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-rose-100 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {String(msg.payload.errorCode)}
                        </span>
                      )}
                    </div>

                    {msg.payload.info && (
                      <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 flex items-start gap-1.5">
                        <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span>{String(msg.payload.info)}</span>
                      </p>
                    )}

                    {msg.payload.vendorErrorCode && (
                      <div className="text-[11px] font-mono text-rose-600 font-semibold">
                        Vendor Error Code: {String(msg.payload.vendorErrorCode)}
                      </div>
                    )}
                  </div>
                )}

                {/* 3. START TRANSACTION DISPLAY (OCPP 1.6 & 2.0.1 Started) */}
                {isStartEvent && (
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                          <Play className="w-3.5 h-3.5 fill-current" />
                        </div>
                        <span className="font-bold text-slate-800">
                          {msg.action.includes('Remote') || msg.action.includes('Request')
                            ? 'Start Request Initiated'
                            : isTransactionEvent
                              ? 'OCPP 2.0.1 Transaction Started'
                              : 'Transaction Active & Metered'}
                        </span>
                      </div>
                      {resolvedTxId && (
                        <span className="font-mono font-bold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded-md border border-cyan-200">
                          Tx #{String(resolvedTxId)}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-slate-50 p-2 rounded-lg border border-slate-100">
                      {authTag && (
                        <div>
                          <span className="text-slate-400">Auth / ID Token: </span>
                          <span className="font-bold text-slate-700">{authTag}</span>
                        </div>
                      )}
                      {msg.payload.meterStart !== undefined && (
                        <div>
                          <span className="text-slate-400">Meter Start: </span>
                          <span className="font-bold text-slate-700">
                            {Number(msg.payload.meterStart) > 1000
                              ? `${(Number(msg.payload.meterStart) / 1000).toFixed(1)} kWh`
                              : `${msg.payload.meterStart} Wh`}
                          </span>
                        </div>
                      )}
                      {msg.payload.triggerReason && (
                        <div>
                          <span className="text-slate-400">Trigger: </span>
                          <span className="font-bold text-slate-700">{String(msg.payload.triggerReason)}</span>
                        </div>
                      )}
                      {msg.payload.limit && (
                        <div>
                          <span className="text-slate-400">Power Limit: </span>
                          <span className="font-bold text-cyan-700">{formatKw(Number(msg.payload.limit))}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 4. STOP TRANSACTION DISPLAY (OCPP 1.6 & 2.0.1 Ended) */}
                {isStopEvent && (
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center">
                          <Square className="w-3.5 h-3.5 fill-current" />
                        </div>
                        <span className="font-bold text-slate-800">
                          {msg.action.includes('Remote') || msg.action.includes('Request')
                            ? 'Stop Command Dispatched'
                            : isTransactionEvent
                              ? 'OCPP 2.0.1 Transaction Ended'
                              : 'Charging Session Stopped'}
                        </span>
                      </div>
                      {resolvedTxId && (
                        <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                          Tx #{String(resolvedTxId)}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {stopBadge && (
                        <span
                          className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${stopBadge.bg} ${stopBadge.text} ${stopBadge.border}`}
                        >
                          Reason: {stopBadge.label}
                        </span>
                      )}
                      {msg.payload.meterStop !== undefined && (
                        <span className="text-[11px] font-mono text-slate-600 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
                          Final Meter: {Number(msg.payload.meterStop) > 1000 ? `${(Number(msg.payload.meterStop) / 1000).toFixed(1)} kWh` : `${msg.payload.meterStop} Wh`}
                        </span>
                      )}
                      {(msg.payload.transactionInfo as any)?.timeSpentCharging !== undefined && (
                        <span className="text-[11px] font-mono text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded-md border border-cyan-200">
                          Charging Time: {Math.round(Number((msg.payload.transactionInfo as any).timeSpentCharging) / 60)} mins
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* 5. HARDWARE BOOT NOTIFICATION (1.6 & 2.0.1) */}
                {msg.action.includes('BootNotification') && (
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center">
                          <Cpu className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-bold text-slate-800">
                          Hardware Online Boot Registration
                        </span>
                      </div>
                      {bootReason && (
                        <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                          Reason: {bootReason}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <div>
                        <span className="text-slate-400">Vendor: </span>
                        <span className="font-bold text-slate-700">{bootVendor || 'Standard Vendor'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Model: </span>
                        <span className="font-bold text-slate-700">{bootModel || 'EV Charger'}</span>
                      </div>
                      {bootFirmware && (
                        <div>
                          <span className="text-slate-400">Firmware: </span>
                          <span className="font-bold text-slate-700">{bootFirmware}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-slate-400">Protocol: </span>
                        <span className="font-bold text-cyan-700">
                          {msg.action.includes('2.0') || (msg.payload.chargingStation as any) ? 'OCPP 2.0.1' : 'OCPP 1.6-J'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 6. AUTHORIZATION DISPLAY */}
                {msg.action.includes('Authorize') && (
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-purple-600" />
                      <span className="text-slate-600 font-medium">User Authorization:</span>
                      <span className="font-mono font-bold text-slate-800">
                        {authTag || 'Operator Tag'}
                      </span>
                    </div>
                    {((msg.payload.idTokenInfo as any)?.status || (msg.payload.idTagInfo as any)?.status) && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        {(msg.payload.idTokenInfo as any)?.status || (msg.payload.idTagInfo as any)?.status || 'Accepted'}
                      </span>
                    )}
                  </div>
                )}

                {/* 7. RESET & UNLOCK COMMANDS */}
                {(msg.action.includes('Reset') || msg.action.includes('UnlockConnector')) && (
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      {msg.action.includes('Unlock') ? (
                        <Unlock className="w-4 h-4 text-orange-600" />
                      ) : (
                        <RotateCcw className="w-4 h-4 text-orange-600" />
                      )}
                      <span className="font-semibold text-slate-800">
                        {msg.action.includes('Unlock') ? 'Unlock Connector Command' : `${String(msg.payload.type || 'Soft')} Hardware Reset`}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-slate-500">
                      {msg.action.endsWith('Response') ? 'Executed by Controller' : 'Dispatched to CP'}
                    </span>
                  </div>
                )}

                {/* Collapsible Raw OCPP JSON Inspector */}
                <div className="pt-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <button
                      type="button"
                      onClick={() => togglePayloadExpand(msg.id)}
                      className="text-cyan-700 hover:text-cyan-900 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      <span>{isExpanded ? 'Hide Raw Payload' : 'Inspect OCPP Payload'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopy(msg.id, JSON.stringify(msg.payload, null, 2))}
                      className="text-slate-400 hover:text-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                      title="Copy raw JSON"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-700 font-medium">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy JSON</span>
                        </>
                      )}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="mt-2 p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 font-mono text-[11px] overflow-x-auto max-h-56 shadow-inner">
                      <pre className="leading-relaxed">
                        {JSON.stringify(msg.payload, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
