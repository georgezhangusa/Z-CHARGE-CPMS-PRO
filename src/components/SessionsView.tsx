import React, { useState } from 'react';
import {
  Activity,
  Search,
  Clock,
  Zap,
  DollarSign,
  FileText,
  X,
  AlertCircle,
  Receipt,
  Car,
  CreditCard,
  BatteryCharging,
} from 'lucide-react';
import { Session } from '../types';
import { getStopReasonBadge, formatCurrency } from '../utils';

interface SessionsViewProps {
  sessions: Session[];
  onOpenStation?: (stationId: string) => void;
  onStopSession?: (sessionId: string) => void;
  onStartNewSession?: () => void;
}

export const SessionsView: React.FC<SessionsViewProps> = ({
  sessions,
  onOpenStation,
  onStopSession,
  onStartNewSession,
}) => {
  const [tab, setTab] = useState<'active' | 'completed'>('active');
  const [search, setSearch] = useState('');
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  const activeList = sessions.filter((s) => s.status === 'active');
  const completedList = sessions.filter((s) => s.status === 'completed');

  const currentList = tab === 'active' ? activeList : completedList;

  const filteredSessions = currentList.filter((s) => {
    const query = search.toLowerCase();
    return (
      s.id.toLowerCase().includes(query) ||
      s.stationId.toLowerCase().includes(query) ||
      s.userTag.toLowerCase().includes(query) ||
      (s.vehicleModel && s.vehicleModel.toLowerCase().includes(query)) ||
      s.siteName.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-4">
      {/* Top Filter & Tab Strip */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Active vs Completed Tabs */}
        <div className="flex rounded-lg bg-slate-100 p-1 border border-slate-200 text-xs w-full sm:w-auto gap-1">
          <button
            type="button"
            id="tab-active-sessions"
            onClick={() => setTab('active')}
            className={`btn-3d flex-1 sm:flex-initial px-4 py-2 rounded-lg font-bold transition-all flex items-center justify-center gap-2 ${
              tab === 'active'
                ? 'btn-3d-cyan text-white'
                : 'bg-transparent text-slate-600 hover:text-slate-900 border-0 shadow-none'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Active Sessions ({activeList.length})</span>
          </button>
          <button
            type="button"
            id="tab-completed-sessions"
            onClick={() => setTab('completed')}
            className={`btn-3d flex-1 sm:flex-initial px-4 py-2 rounded-lg font-bold transition-all flex items-center justify-center gap-2 ${
              tab === 'completed'
                ? 'btn-3d-white text-slate-900'
                : 'bg-transparent text-slate-600 hover:text-slate-900 border-0 shadow-none'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Historical Logs ({completedList.length})</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            id="session-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search session ID, RFID, vehicle..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl bg-white border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-mono text-[11px]">
                <th className="py-3 px-4">SESSION ID</th>
                <th className="py-3 px-4">STATION & PORT</th>
                <th className="py-3 px-4">USER & VEHICLE</th>
                <th className="py-3 px-4">START & DURATION</th>
                <th className="py-3 px-4">ENERGY (kWh)</th>
                <th className="py-3 px-4">{tab === 'completed' ? 'PEAK POWER' : 'POWER (kW)'}</th>
                {tab === 'completed' ? (
                  <th className="py-3 px-4">STOP REASON</th>
                ) : (
                  <th className="py-3 px-4">SOC</th>
                )}
                <th className="py-3 px-4">COST</th>
                <th className="py-3 px-4 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 px-4 text-center">
                    <div className="max-w-sm mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
                        <Activity className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-slate-800">
                          {tab === 'active' ? 'No Active Charging Sessions' : 'No Completed Sessions'}
                        </h4>
                        <p className="text-xs text-slate-500">
                          {tab === 'active'
                            ? 'Connect an EV to start an active charging session or initiate a session from Chargers fleet.'
                            : 'Completed charging sessions and billing receipts will appear here.'}
                        </p>
                      </div>
                      {tab === 'active' && onStartNewSession && (
                        <button
                          type="button"
                          onClick={onStartNewSession}
                          className="btn-3d btn-3d-cyan px-3.5 py-1.5 text-xs text-white font-bold"
                        >
                          View Fleet Chargers
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredSessions.map((session) => {
                  const stopStyle = session.stopReason
                    ? getStopReasonBadge(session.stopReason)
                    : null;
                  const isActive = session.status === 'active';

                  return (
                    <tr
                      key={session.id}
                      onClick={() => setSelectedSession(session)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer group"
                    >
                      {/* Session ID & Status */}
                      <td className="py-3.5 px-4 font-mono">
                        <div className="font-bold text-slate-900 group-hover:text-cyan-700 transition-colors flex items-center gap-1.5">
                          <span>{session.id}</span>
                          {isActive && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {isActive ? (
                            session.lastMeterValueTimestamp ? (
                              <span className="text-emerald-700 font-medium">
                                Meter: {Math.max(0, Math.floor((Date.now() - session.lastMeterValueTimestamp) / 1000))}s ago (1m timeout)
                              </span>
                            ) : (
                              <span className="text-amber-700 font-medium">
                                Awaiting MeterValue (1m timeout)
                              </span>
                            )
                          ) : (
                            'Completed session'
                          )}
                        </div>
                      </td>

                      {/* Station & Port */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-slate-800 font-semibold flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenStation?.(session.stationId);
                            }}
                            className="text-cyan-700 hover:underline cursor-pointer"
                            title="Click to view charger diagnostics drawer"
                          >
                            {session.stationId}
                          </button>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-600">P{session.portNumber} ({session.connectorType})</span>
                        </div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[180px]">
                          {session.siteName}
                        </div>
                      </td>

                      {/* User & Vehicle */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-slate-800 font-medium">
                          {session.userTag}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1">
                          <span>{session.vehicleModel || 'EV Driver'}</span>
                          <span className="text-slate-400">•</span>
                          <span className="text-cyan-700 font-mono text-[10px] font-semibold">
                            [{session.authMethod}]
                          </span>
                        </div>
                      </td>

                      {/* Start & Duration */}
                      <td className="py-3.5 px-4 font-mono">
                        <div className="text-slate-800 text-[11px]">
                          {session.startTime.includes('T') ? session.startTime.split('T')[1].slice(0, 8) : session.startTime}
                        </div>
                        <div className="text-[11px] text-slate-600 font-semibold flex items-center gap-1 mt-0.5">
                          {isActive && <Clock className="w-3 h-3 text-cyan-600 animate-spin" />}
                          <span>{session.durationMinutes} mins</span>
                        </div>
                      </td>

                      {/* Energy Delivered */}
                      <td className="py-3.5 px-4 font-mono">
                        <div className="text-slate-900 font-bold">{session.energyKwh.toFixed(2)} kWh</div>
                        <div className="text-[10px] text-slate-400">Via MeterValues</div>
                      </td>

                      {/* Power */}
                      <td className="py-3.5 px-4 font-mono">
                        {tab === 'completed' || !isActive ? (
                          <div className="text-slate-900 font-bold flex items-center gap-1">
                            <Zap className="w-3.5 h-3.5 text-cyan-600" />
                            <span>{session.peakKw > 0 ? `${session.peakKw.toFixed(1)} kW` : '—'}</span>
                          </div>
                        ) : (
                          <>
                            <div className="text-cyan-700 font-bold flex items-center gap-1">
                              {isActive && <Zap className="w-3 h-3 text-cyan-600 animate-bounce" />}
                              <span>{session.currentKw > 0 ? `${session.currentKw.toFixed(1)} kW` : '0 kW'}</span>
                            </div>
                            <div className="text-[10px] text-slate-500">Peak {session.peakKw.toFixed(0)} kW</div>
                          </>
                        )}
                      </td>

                      {/* SoC / Stop Reason */}
                      <td className="py-3.5 px-4">
                        {tab === 'completed' && stopStyle ? (
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-medium border ${stopStyle.bg} ${stopStyle.text} ${stopStyle.border}`}
                          >
                            {stopStyle.label}
                          </span>
                        ) : (
                          <div className="space-y-1">
                            <span className="font-mono text-cyan-700 font-bold text-xs flex items-center gap-1">
                              {session.socCurrent !== undefined ? `${session.socCurrent}%` : '—'}
                              {isActive && (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              )}
                            </span>
                            <div className="w-16 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${isActive ? 'charging-animated-bar' : 'bg-cyan-600'}`}
                                style={{ width: `${session.socCurrent || 0}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Cost */}
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-700">
                        {formatCurrency(session.costTotal)}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isActive && onStopSession && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onStopSession(session.id);
                              }}
                              className="btn-3d btn-3d-rose px-2.5 py-1 text-xs text-white font-bold"
                              title="Remotely stop this active charging session"
                            >
                              Stop
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSession(session);
                            }}
                            className="btn-3d btn-3d-white px-2.5 py-1 text-xs font-bold text-slate-800"
                          >
                            Receipt
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Itemized Session Receipt Modal */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div
            id="session-receipt-modal"
            className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden text-slate-800 space-y-4"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-cyan-600" />
                <h3 className="font-semibold text-slate-900">Session Itemized Receipt</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSession(null)}
                className="btn-3d btn-3d-white p-1 rounded-lg text-slate-500 hover:text-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="flex justify-between items-start pb-3 border-b border-slate-200">
                <div>
                  <span className="font-mono text-base font-bold text-slate-900 block">
                    {selectedSession.id}
                  </span>
                  <span className="text-slate-500">{selectedSession.stationName} • Port {selectedSession.portNumber}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block">{selectedSession.startTime}</span>
                  <span className="font-mono text-slate-700 font-semibold">{selectedSession.durationMinutes} min session</span>
                </div>
              </div>

              {/* Vehicle & User info */}
              <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-slate-500 block text-[10px] font-semibold">VEHICLE</span>
                  <span className="font-semibold text-slate-800">{selectedSession.vehicleModel || 'Electric Vehicle'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-semibold">AUTHORIZATION</span>
                  <span className="font-mono text-cyan-700 font-semibold">{selectedSession.authMethod} ({selectedSession.userTag})</span>
                </div>
              </div>

              {/* Stop reason if ended */}
              {selectedSession.stopReason && (
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex justify-between items-center">
                  <span className="text-slate-600">Termination Cause:</span>
                  <span className="font-semibold text-slate-900">{selectedSession.stopReason}</span>
                </div>
              )}

              {/* Itemized Cost Breakdown */}
              <div className="space-y-2 pt-1">
                <div className="flex justify-between text-slate-600">
                  <span>Energy Delivered ({selectedSession.energyKwh.toFixed(1)} kWh @ $0.49/kWh)</span>
                  <span className="font-mono text-slate-900 font-semibold">{formatCurrency(selectedSession.costBreakdown.energyFee)}</span>
                </div>
                {selectedSession.peakKw > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Peak Charging Power</span>
                    <span className="font-mono text-slate-900 font-semibold">{selectedSession.peakKw.toFixed(1)} kW</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>Time / Session Fee</span>
                  <span className="font-mono text-slate-900 font-semibold">{formatCurrency(selectedSession.costBreakdown.timeFee)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Idle Fee (Grace period applied)</span>
                  <span className="font-mono text-slate-900 font-semibold">{formatCurrency(selectedSession.costBreakdown.idleFee)}</span>
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-slate-200 font-semibold text-sm">
                  <span className="text-slate-900 font-bold">Total Charged</span>
                  <span className="font-mono text-emerald-700 text-base font-bold">
                    {formatCurrency(selectedSession.costTotal)}
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onOpenStation?.(selectedSession.stationId);
                    setSelectedSession(null);
                  }}
                  className="text-cyan-700 hover:text-cyan-800 hover:underline font-mono cursor-pointer font-semibold"
                >
                  View Station {selectedSession.stationId} →
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSession(null)}
                  className="btn-3d btn-3d-cyan px-4 py-2 text-white text-xs font-bold"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
