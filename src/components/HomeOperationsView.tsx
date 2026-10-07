import React, { useState } from 'react';
import {
  Zap,
  Activity,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  ArrowUpRight,
  Clock,
  Radio,
  Sliders,
  CheckCircle2,
  Calendar,
  Layers,
} from 'lucide-react';
import { ChargingStation, Site, Session, SystemAlert } from '../types';
import { formatKw, formatCurrency } from '../utils';
import { AllChargersBySiteModal } from './AllChargersBySiteModal';

interface HomeOperationsViewProps {
  chargers: ChargingStation[];
  sites: Site[];
  sessions: Session[];
  alerts: SystemAlert[];
  onNavigateToTab: (tab: 'chargers' | 'sessions' | 'sites' | 'pricing' | 'settings', filter?: string) => void;
  onSelectStation: (station: ChargingStation) => void;
  onOpenSimulator?: () => void;
  onOpenAddCharger?: () => void;
  onOpenAddSite?: () => void;
}

export const HomeOperationsView: React.FC<HomeOperationsViewProps> = ({
  chargers,
  sites,
  sessions,
  alerts,
  onNavigateToTab,
  onSelectStation,
  onOpenSimulator,
  onOpenAddCharger,
  onOpenAddSite,
}) => {
  // Aggregate network numbers
  const totalStations = chargers.length;
  const activeSessions = sessions.filter((s) => s.status === 'active');
  const totalLoadKw = chargers.reduce((acc, c) => acc + c.currentLoadKw, 0);
  const totalCapacityKw = chargers.reduce((acc, c) => acc + c.totalCapacityKw, 0);
  const totalTransformerLimitKw = sites.reduce((acc, s) => acc + s.transformerLimitKw, 0);
  const totalRevenue = sites.reduce((acc, s) => acc + s.todayRevenue, 0);

  // Revenue timeframe selector state
  type RevenuePeriod = 'date' | 'month' | 'year' | 'ytd';
  const [revenuePeriod, setRevenuePeriod] = useState<RevenuePeriod>('date');
  const [selectedDate, setSelectedDate] = useState<string>('2026-09-05');
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-09');
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [showAllChargersModal, setShowAllChargersModal] = useState(false);

  // Dynamically compute revenue metrics based on selected period
  const getRevenueStats = () => {
    switch (revenuePeriod) {
      case 'date': {
        const isToday = selectedDate === '2026-09-05';
        const dayNum = parseInt(selectedDate.split('-')[2] || '5', 10);
        const dayVariation = 0.82 + ((dayNum * 7) % 30) * 0.012;
        const rev = isToday ? totalRevenue : Math.round(totalRevenue * dayVariation);
        const energyMwh = ((rev / totalRevenue) * 115.2).toFixed(1);
        const trendPct = ((dayVariation - 0.85) * 60).toFixed(1);
        const isPos = Number(trendPct) >= 0;
        return {
          title: isToday ? "Today's Gross Revenue" : "Daily Gross Revenue",
          revenue: rev,
          trend: `${isPos ? '+' : ''}${trendPct}% vs prev day`,
          energy: `${energyMwh} MWh`,
          label: selectedDate,
        };
      }
      case 'month': {
        const monthMap: Record<string, { mult: number; energy: string; trend: string }> = {
          '2026-09': { mult: 7.4, energy: '852.4 MWh', trend: '+18.6% vs last month' },
          '2026-08': { mult: 25.8, energy: '2,972.1 MWh', trend: '+14.2% vs Jul' },
          '2026-07': { mult: 24.1, energy: '2,776.3 MWh', trend: '+9.8% vs Jun' },
          '2026-06': { mult: 22.4, energy: '2,580.4 MWh', trend: '+11.5% vs May' },
        };
        const mData = monthMap[selectedMonth] || { mult: 20.0, energy: '2,300 MWh', trend: '+12.0% vs prior' };
        const rev = Math.round(totalRevenue * mData.mult);
        return {
          title: "Monthly Gross Revenue",
          revenue: rev,
          trend: mData.trend,
          energy: mData.energy,
          label: selectedMonth,
        };
      }
      case 'year': {
        const yearMap: Record<string, { mult: number; energy: string; trend: string }> = {
          '2026': { mult: 92.4, energy: '10.64 GWh', trend: '+31.4% vs 2025' },
          '2025': { mult: 70.2, energy: '8.08 GWh', trend: '+42.5% vs 2024' },
          '2024': { mult: 49.3, energy: '5.67 GWh', trend: '+68.0% vs 2023' },
        };
        const yData = yearMap[selectedYear] || { mult: 80.0, energy: '9.2 GWh', trend: '+20.0%' };
        const rev = Math.round(totalRevenue * yData.mult);
        return {
          title: `${selectedYear} Annual Revenue`,
          revenue: rev,
          trend: yData.trend,
          energy: yData.energy,
          label: `FY ${selectedYear}`,
        };
      }
      case 'ytd': {
        const rev = Math.round(totalRevenue * 64.8);
        return {
          title: "YTD Gross Revenue",
          revenue: rev,
          trend: "+26.8% YoY pace",
          energy: "7.46 GWh",
          label: "Jan 1 – Sep 5, 2026",
        };
      }
    }
  };

  const revenueStats = getRevenueStats();

  // Status counts
  let chargingCount = 0;
  let availableCount = 0;
  let offlineCount = 0;
  let faultedCount = 0;
  let preparingCount = 0;

  chargers.forEach((c) => {
    if (c.wsStatus === 'disconnected' || c.wsStatus === 'lag') {
      offlineCount++;
    }
    c.evses.forEach((evse) => {
      evse.connectors.forEach((conn) => {
        if (conn.status === 'Charging') chargingCount++;
        else if (conn.status === 'Available') availableCount++;
        else if (conn.status === 'Faulted') faultedCount++;
        else if (conn.status === 'Preparing' || conn.status === 'Occupied') preparingCount++;
      });
    });
  });

  const loadPercentage = Math.round((totalLoadKw / totalTransformerLimitKw) * 100);

  // Hourly demand simulation for 24 hours
  const hourlyDemand = [
    { hour: '00:00', kw: 280 },
    { hour: '02:00', kw: 210 },
    { hour: '04:00', kw: 190 },
    { hour: '06:00', kw: 450 },
    { hour: '08:00', kw: 1100 },
    { hour: '10:00', kw: 1820 },
    { hour: '12:00', kw: 1650 },
    { hour: '14:00', kw: 1740 },
    { hour: '16:00', kw: 2150 }, // Peak
    { hour: '18:00', kw: 2420 }, // Peak demand
    { hour: '20:00', kw: 1980 },
    { hour: '22:00', kw: 920 },
  ];

  const maxPeakKw = 2800;

  return (
    <div className="space-y-6">
      {/* Top Welcome / Status strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900 tracking-tight">
                Network Operations Control Center
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-mono font-semibold">
                SYSTEM OPERATIONAL
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Supervising {sites.length} Site{sites.length === 1 ? '' : 's'} • {totalStations} Charging Station{totalStations === 1 ? '' : 's'} • Real-time OCPP telemetry
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onOpenAddSite && (
            <button
              type="button"
              id="home-btn-add-site"
              onClick={onOpenAddSite}
              className="btn-3d btn-3d-white px-3.5 py-1.5 text-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:text-cyan-700"
            >
              <span>+ Add Site</span>
            </button>
          )}
          {onOpenAddCharger && (
            <button
              type="button"
              id="home-btn-add-charger"
              onClick={onOpenAddCharger}
              className="btn-3d btn-3d-cyan px-3.5 py-1.5 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span>+ Add Charger</span>
            </button>
          )}
          <button
            type="button"
            id="btn-list-all-chargers"
            onClick={() => setShowAllChargersModal(true)}
            className="btn-3d btn-3d-white px-3 py-1.5 text-slate-700 text-xs font-bold flex items-center gap-1.5"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>List All ({chargers.length})</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Grid (4 Pillars) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Network Current Load & Peak Demand KPI */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Network Current Load
            </span>
            <div className="p-1.5 rounded-md bg-cyan-50 text-cyan-700 border border-cyan-200">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
              {formatKw(totalLoadKw)}
            </div>
            <div className="flex items-center gap-2 text-xs mt-1">
              <span className="text-amber-700 font-mono font-semibold">{loadPercentage}% of Grid Cap</span>
              <span className="text-slate-500">/ {formatKw(totalTransformerLimitKw)} Limit</span>
            </div>
          </div>

          {/* Progress bar with peak demand limit */}
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                loadPercentage > 80 ? 'bg-amber-500' : 'bg-cyan-500'
              }`}
              style={{ width: `${loadPercentage}%` }}
            />
          </div>
          <div className="text-[10px] text-slate-500 flex justify-between font-mono">
            <span>Peak 24h: 2.42 MW</span>
            <span className="text-emerald-700 font-medium">Headroom: {formatKw(totalTransformerLimitKw - totalLoadKw)}</span>
          </div>
        </div>

        {/* Card 2: Active Charging Fleet */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Fleet Availability
            </span>
            <div className="p-1.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
              {totalStations} <span className="text-sm font-normal text-slate-500">Stations</span>
            </div>
            <div className="flex items-center gap-3 text-xs mt-1 font-mono font-medium flex-wrap">
              <span className="text-cyan-700">{chargingCount} Charging</span>
              <span className="text-emerald-700">{availableCount} Available</span>
              {preparingCount > 0 && <span className="text-amber-700">{preparingCount} Occupied</span>}
              <span className="text-rose-600">{faultedCount} Fault</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
            <span className="text-slate-500">Fleet Uptime:</span>
            <span className="font-mono font-semibold text-emerald-700">98.4%</span>
          </div>
        </div>

        {/* Card 3: Live Active Sessions */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Live Sessions
            </span>
            <div className="p-1.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
              {activeSessions.length} <span className="text-sm font-normal text-slate-500">Active</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Avg Duration: 24 mins</span>
            </div>
            {activeSessions.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-1.5">
                {activeSessions.slice(0, 3).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onNavigateToTab('sessions')}
                    className="font-mono text-[10px] font-bold text-cyan-800 bg-cyan-50 border border-cyan-200 px-1.5 py-0.5 rounded cursor-pointer hover:bg-cyan-100 transition-colors"
                    title={`Active session ID on ${s.stationId}. Click to view in Sessions.`}
                  >
                    {s.id}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
            <span className="text-slate-500">Throughput:</span>
            <span className="font-mono font-semibold text-cyan-700">~18.4 kWh/min</span>
          </div>
        </div>

        {/* Card 4: Energy & Revenue (Selectable by Date, Month, Year, or YTD) */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">
                {revenueStats.title}
              </span>
              <div className="p-1.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>

            {/* Timeframe Selector Pills: Date | Month | Year | YTD */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-lg text-[11px] font-semibold">
              {(['date', 'month', 'year', 'ytd'] as const).map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => setRevenuePeriod(period)}
                  className={`py-1 rounded-md text-center transition-all ${
                    revenuePeriod === period
                      ? 'bg-amber-500 text-white shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                  }`}
                >
                  {period === 'date'
                    ? 'Date'
                    : period === 'month'
                    ? 'Month'
                    : period === 'year'
                    ? 'Year'
                    : 'YTD'}
                </button>
              ))}
            </div>

            {/* Sub-selector for specific Date / Month / Year / YTD range */}
            <div className="flex items-center justify-between gap-2 text-xs pt-0.5">
              {revenuePeriod === 'date' && (
                <div className="flex items-center gap-1.5 w-full">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full text-xs font-mono py-0.5 px-1.5 bg-slate-50 border border-slate-200 rounded text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                  />
                </div>
              )}

              {revenuePeriod === 'month' && (
                <div className="flex items-center gap-1.5 w-full">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full text-xs font-mono py-0.5 px-1.5 bg-slate-50 border border-slate-200 rounded text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                  >
                    <option value="2026-09">September 2026 (MTD)</option>
                    <option value="2026-08">August 2026</option>
                    <option value="2026-07">July 2026</option>
                    <option value="2026-06">June 2026</option>
                  </select>
                </div>
              )}

              {revenuePeriod === 'year' && (
                <div className="flex items-center gap-1.5 w-full">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-full text-xs font-mono py-0.5 px-1.5 bg-slate-50 border border-slate-200 rounded text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                  >
                    <option value="2026">2026 (Current FY)</option>
                    <option value="2025">2025 (Prior FY)</option>
                    <option value="2024">2024</option>
                  </select>
                </div>
              )}

              {revenuePeriod === 'ytd' && (
                <div className="flex items-center justify-between w-full text-[11px] text-slate-500 font-mono bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                  <span>Range:</span>
                  <span className="font-semibold text-slate-700">Jan 1 – Sep 5, 2026</span>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
              {formatCurrency(revenueStats.revenue)}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 mt-1 font-mono font-medium">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{revenueStats.trend}</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
            <span className="text-slate-500">Energy Dispensed:</span>
            <span className="font-mono font-semibold text-slate-700">{revenueStats.energy}</span>
          </div>
        </div>
      </div>

      {/* Main Row: Live Power Profile & Actionable Triage Alert Center */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Live Power Profile Chart & Grid Demand */}
        <div className="lg:col-span-2 p-6 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 tracking-tight flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan-600" />
                Live Power Demand Profile & Utility Ceiling
              </h3>
              <p className="text-xs text-slate-500">
                15-Minute Rolling Average vs Peak Demand Charge Threshold
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <div className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-1 bg-cyan-500 rounded-full" />
                <span>Actual Load</span>
              </div>
              <div className="flex items-center gap-1.5 text-rose-600">
                <span className="w-2.5 h-0.5 border-t border-dashed border-rose-500" />
                <span>Ceiling (2.5 MW)</span>
              </div>
            </div>
          </div>

          {/* Graphical Bar/Curve representation */}
          <div className="relative pt-6 pb-2">
            {/* Ceiling guideline */}
            <div className="absolute top-10 left-0 right-0 border-b border-dashed border-rose-400 z-10 flex justify-end">
              <span className="text-[10px] font-mono text-rose-700 bg-white border border-rose-200 px-1.5 py-0.5 rounded shadow-xs">
                Utility Peak Threshold: 2.50 MW
              </span>
            </div>

            <div className="h-44 flex items-end justify-between gap-1.5 sm:gap-3 pt-6 border-b border-slate-200">
              {hourlyDemand.map((d) => {
                const heightPercent = Math.min(100, Math.round((d.kw / maxPeakKw) * 100));
                const isNearCeiling = d.kw >= 2200;
                return (
                  <div key={d.hour} className="flex-1 flex flex-col items-center gap-2 group">
                    <div className="w-full bg-slate-100 rounded-t-sm relative h-36 flex items-end">
                      <div
                        className={`w-full rounded-t-sm transition-all duration-300 ${
                          isNearCeiling
                            ? 'bg-amber-500 group-hover:bg-amber-600'
                            : 'bg-cyan-500 group-hover:bg-cyan-600'
                        }`}
                        style={{ height: `${heightPercent}%` }}
                      />
                      {/* Tooltip on hover */}
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:block bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded text-[10px] font-mono text-white z-20 whitespace-nowrap shadow-md">
                        {d.kw} kW
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 rotate-45 sm:rotate-0 origin-left">
                      {d.hour}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-500 block text-[11px]">Active Power Factor</span>
              <span className="font-mono text-slate-900 font-bold">0.98 pf (High Efficiency)</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-500 block text-[11px]">Peak 15-min Window</span>
              <span className="font-mono text-amber-700 font-bold">2.42 MW @ 18:05</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-500 block text-[11px]">Estimated Demand Charge</span>
              <span className="font-mono text-slate-900 font-bold">$2,840.00 / month</span>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Actionable Alert Center (Triage Action Queue) */}
        <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-slate-900 tracking-tight">Triage Action Center</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-mono text-xs font-semibold">
                {alerts.length} Active
              </span>
            </div>

            <p className="text-xs text-slate-500 mt-2">
              Operator action queue with deep-link resolution:
            </p>

            {/* Alert List */}
            <div className="mt-3 space-y-2.5">
              {alerts.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-1.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto" />
                  <div className="text-xs font-semibold text-slate-800">All Systems Operational</div>
                  <p className="text-[11px] text-slate-500">No active alarms or fault notifications across the charging network.</p>
                </div>
              ) : (
                alerts.map((alert) => {
                const isCritical = alert.severity === 'critical';
                const isWarning = alert.severity === 'warning';
                return (
                  <div
                    key={alert.id}
                    onClick={() => {
                      if (alert.targetStationId) {
                        const target = chargers.find((c) => c.id === alert.targetStationId);
                        if (target) onSelectStation(target);
                        else onNavigateToTab('chargers', alert.filterStatus);
                      } else if (alert.targetTab) {
                        onNavigateToTab(alert.targetTab, alert.filterStatus);
                      }
                    }}
                    className={`p-3 rounded-xl border cursor-pointer transition-all hover:shadow-xs ${
                      isCritical
                        ? 'bg-rose-50 hover:bg-rose-100/70 border-rose-200'
                        : isWarning
                          ? 'bg-amber-50 hover:bg-amber-100/70 border-amber-200'
                          : 'bg-blue-50 hover:bg-blue-100/70 border-blue-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-bold tracking-tight ${
                          isCritical ? 'text-rose-800' : isWarning ? 'text-amber-800' : 'text-blue-800'
                        }`}
                      >
                        {alert.title}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">{alert.timestamp}</span>
                    </div>
                    <p className="text-[11px] text-slate-700 mt-1 leading-relaxed">
                      {alert.description}
                    </p>
                    <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-200/80">
                      <span className="text-[10px] font-mono text-slate-500">
                        Target: {alert.targetStationId || alert.targetTab}
                      </span>
                      <span className="text-[11px] text-cyan-700 font-semibold flex items-center gap-1">
                        Resolve <ArrowUpRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                );
              })
            )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200">
            <button
              type="button"
              id="btn-view-full-chargers-fleet"
              onClick={() => onNavigateToTab('chargers')}
              className="btn-3d btn-3d-cyan w-full py-2.5 px-4 text-xs text-white rounded-lg font-bold flex items-center justify-center gap-2 group transition-all"
            >
              <Zap className="w-3.5 h-3.5 fill-current opacity-90" />
              <span>View All Chargers</span>
              <ArrowUpRight className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </button>
          </div>
        </div>
      </div>

      {/* All Chargers in All Sites Modal */}
      <AllChargersBySiteModal
        isOpen={showAllChargersModal}
        onClose={() => setShowAllChargersModal(false)}
        sites={sites}
        chargers={chargers}
        onSelectStation={onSelectStation}
        onNavigateToChargers={(siteId) => onNavigateToTab('chargers', siteId)}
      />
    </div>
  );
};
