import React, { useState } from 'react';
import {
  X,
  Search,
  Building2,
  Zap,
  MapPin,
  ChevronDown,
  ChevronUp,
  Sliders,
  ExternalLink,
  ShieldAlert,
  CheckCircle2,
  Activity,
  Layers,
} from 'lucide-react';
import { ChargingStation, Site, PortStatus } from '../types';
import { getStatusColor, formatKw, formatPortStatus } from '../utils';

interface AllChargersBySiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  sites: Site[];
  chargers: ChargingStation[];
  onSelectStation: (station: ChargingStation) => void;
  onNavigateToChargers: (siteId?: string) => void;
}

export const AllChargersBySiteModal: React.FC<AllChargersBySiteModalProps> = ({
  isOpen,
  onClose,
  sites,
  chargers,
  onSelectStation,
  onNavigateToChargers,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSiteFilter, setSelectedSiteFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [collapsedSites, setCollapsedSites] = useState<Record<string, boolean>>({});

  if (!isOpen) return null;

  const toggleSiteCollapse = (siteId: string) => {
    setCollapsedSites((prev) => ({
      ...prev,
      [siteId]: !prev[siteId],
    }));
  };

  const expandAll = () => setCollapsedSites({});
  const collapseAll = () => {
    const allCollapsed: Record<string, boolean> = {};
    sites.forEach((s) => {
      allCollapsed[s.id] = true;
    });
    setCollapsedSites(allCollapsed);
  };

  // Filter chargers
  const filteredChargers = chargers.filter((charger) => {
    // Site filter
    if (selectedSiteFilter !== 'ALL' && charger.siteId !== selectedSiteFilter) {
      return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = charger.id.toLowerCase().includes(q);
      const matchName = charger.name.toLowerCase().includes(q);
      const matchModel = charger.model.toLowerCase().includes(q);
      const matchSite = charger.siteName.toLowerCase().includes(q);
      const matchConnector = charger.evses.some((e) =>
        e.connectors.some((c) => c.type.toLowerCase().includes(q))
      );
      if (!matchId && !matchName && !matchModel && !matchSite && !matchConnector) {
        return false;
      }
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      const hasMatchingPort = charger.evses.some((evse) =>
        evse.connectors.some((c) => {
          if (statusFilter === 'Charging') return c.status === 'Charging';
          if (statusFilter === 'Available') return c.status === 'Available';
          if (statusFilter === 'Faulted') return c.status === 'Faulted' || c.status === 'Offline';
          return c.status === statusFilter;
        })
      );
      if (!hasMatchingPort) return false;
    }

    return true;
  });

  // Calculate high-level metrics
  let totalChargingPorts = 0;
  let totalAvailablePorts = 0;
  let totalFaultedPorts = 0;

  chargers.forEach((c) => {
    c.evses.forEach((evse) => {
      evse.connectors.forEach((conn) => {
        if (conn.status === 'Charging') totalChargingPorts++;
        else if (conn.status === 'Available') totalAvailablePorts++;
        else if (conn.status === 'Faulted' || conn.status === 'Offline') totalFaultedPorts++;
      });
    });
  });

  // Determine sites to display
  const sitesToDisplay = sites.filter((site) => {
    if (selectedSiteFilter !== 'ALL' && site.id !== selectedSiteFilter) return false;
    // Check if site has any chargers matching the filter
    const siteChargers = filteredChargers.filter((c) => c.siteId === site.id);
    return siteChargers.length > 0 || (searchQuery.trim() === '' && statusFilter === 'ALL');
  });

  return (
    <div
      id="all-chargers-by-site-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="all-chargers-by-site-modal"
        className="w-full max-w-5xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-800 animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-600 text-white shadow-xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  All Chargers in All Sites
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800 font-mono text-xs font-semibold">
                  {chargers.length} Total Chargers
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-mono text-xs font-medium">
                  {sites.length} Metro Hubs
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Complete network inventory grouped by physical site location and grid service
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
            title="Close Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="px-6 py-3.5 border-b border-slate-200 bg-white space-y-3 shrink-0">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search charger ID, name, model, connector type (CCS1, NACS)..."
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-cyan-500 focus:bg-white transition-all font-mono"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Site selector dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Site:</span>
              <select
                value={selectedSiteFilter}
                onChange={(e) => setSelectedSiteFilter(e.target.value)}
                className="py-1.5 px-3 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 font-medium focus:outline-hidden focus:border-cyan-500"
              >
                <option value="ALL">All Sites ({sites.length})</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({chargers.filter((c) => c.siteId === s.id).length})
                  </option>
                ))}
              </select>

              {/* Expand / Collapse all */}
              <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={expandAll}
                  className="px-2 py-1 text-slate-600 hover:text-slate-900 hover:bg-white rounded font-medium text-[11px] transition-all"
                  title="Expand All Sites"
                >
                  Expand All
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="px-2 py-1 text-slate-600 hover:text-slate-900 hover:bg-white rounded font-medium text-[11px] transition-all"
                  title="Collapse All Sites"
                >
                  Collapse All
                </button>
              </div>
            </div>
          </div>

          {/* Quick status filter pills */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <span className="text-slate-500 text-[11px] font-semibold mr-1">Status:</span>
              {[
                { id: 'ALL', label: 'All Statuses', count: chargers.length },
                { id: 'Charging', label: 'Charging', count: totalChargingPorts, color: 'text-cyan-700 bg-cyan-50 border-cyan-200' },
                { id: 'Available', label: 'Available', count: totalAvailablePorts, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
                { id: 'Faulted', label: 'Faulted / Offline', count: totalFaultedPorts, color: 'text-rose-700 bg-rose-50 border-rose-200' },
              ].map((pill) => {
                const isActive = statusFilter === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setStatusFilter(pill.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-slate-800 text-white border-slate-800 shadow-2xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span>{pill.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        isActive ? 'bg-slate-700 text-slate-100' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {pill.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <span className="text-[11px] text-slate-500 font-mono">
              Showing {filteredChargers.length} of {chargers.length} chargers
            </span>
          </div>
        </div>

        {/* Modal Body: Grouped by Site */}
        <div className="p-6 space-y-6 overflow-y-auto bg-slate-50/50 flex-1">
          {sitesToDisplay.length === 0 ? (
            <div className="py-12 text-center bg-white rounded-xl border border-slate-200 p-8 space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-slate-800 text-sm">No chargers match criteria</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No charging stations match your current search and filter settings. Try clearing the search or status filters.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('ALL');
                  setSelectedSiteFilter('ALL');
                }}
                className="btn-3d btn-3d-white text-xs px-3 py-1.5 text-slate-800 font-bold"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            sitesToDisplay.map((site) => {
              const siteChargers = filteredChargers.filter((c) => c.siteId === site.id);
              const allSiteChargers = chargers.filter((c) => c.siteId === site.id);
              const isCollapsed = !!collapsedSites[site.id];

              const siteChargingCount = siteChargers.reduce(
                (acc, c) =>
                  acc +
                  c.evses.reduce(
                    (evseAcc, e) =>
                      evseAcc + e.connectors.filter((conn) => conn.status === 'Charging').length,
                    0
                  ),
                0
              );
              const siteAvailableCount = siteChargers.reduce(
                (acc, c) =>
                  acc +
                  c.evses.reduce(
                    (evseAcc, e) =>
                      evseAcc + e.connectors.filter((conn) => conn.status === 'Available').length,
                    0
                  ),
                0
              );
              const siteFaultCount = siteChargers.reduce(
                (acc, c) =>
                  acc +
                  c.evses.reduce(
                    (evseAcc, e) =>
                      evseAcc +
                      e.connectors.filter(
                        (conn) => conn.status === 'Faulted' || conn.status === 'Offline'
                      ).length,
                    0
                  ),
                0
              );

              const loadPercent = Math.min(
                100,
                Math.round((site.currentLoadKw / site.transformerLimitKw) * 100)
              );

              return (
                <div
                  key={site.id}
                  id={`site-section-${site.id}`}
                  className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition-all"
                >
                  {/* Site Header Accordion Banner */}
                  <div
                    onClick={() => toggleSiteCollapse(site.id)}
                    className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-100/80 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-white border border-slate-200 text-cyan-600 shadow-2xs">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-900 text-sm tracking-tight">
                            {site.name}
                          </h3>
                          <span className="px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800 text-[11px] font-mono font-semibold">
                            {siteChargers.length} / {allSiteChargers.length} Chargers
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {site.address}, {site.city}, {site.state}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Power & Status pills */}
                      <div className="flex items-center gap-2 font-mono text-xs">
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {siteAvailableCount} Avail
                        </span>
                        <span className="px-2 py-0.5 rounded bg-cyan-50 text-cyan-700 border border-cyan-200">
                          {siteChargingCount} Active
                        </span>
                        {siteFaultCount > 0 && (
                          <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                            {siteFaultCount} Fault
                          </span>
                        )}
                        <span className="hidden md:inline-block px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                          Load: {loadPercent}% ({formatKw(site.currentLoadKw)})
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onClose();
                          onNavigateToChargers(site.id);
                        }}
                        className="btn-3d btn-3d-white px-2.5 py-1 text-slate-700 text-xs font-bold flex items-center gap-1.5"
                        title="View site in fleet manager"
                      >
                        <span>Fleet View</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>

                      <div className="text-slate-400 p-1">
                        {isCollapsed ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronUp className="w-4 h-4" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Chargers List for this Site */}
                  {!isCollapsed && (
                    <div className="p-4">
                      {siteChargers.length === 0 ? (
                        <p className="text-xs text-slate-500 italic py-3 text-center">
                          No chargers at this site match the active filter criteria.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {siteChargers.map((charger) => {
                            const isDcfc = charger.type === 'DCFC';
                            const isDisconnected =
                              charger.wsStatus === 'disconnected' || charger.wsStatus === 'lag';

                            return (
                              <div
                                key={charger.id}
                                id={`charger-card-${charger.id}`}
                                className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-cyan-400 hover:shadow-xs transition-all space-y-3 flex flex-col justify-between"
                              >
                                <div>
                                  {/* Charger Header */}
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-mono font-bold text-xs text-slate-900">
                                          {charger.id}
                                        </span>
                                        <span
                                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                                            isDcfc
                                              ? 'bg-amber-100 text-amber-800'
                                              : 'bg-indigo-100 text-indigo-800'
                                          }`}
                                        >
                                          {charger.type}
                                        </span>
                                      </div>
                                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                        {charger.name} • {charger.model}
                                      </p>
                                    </div>

                                    <div className="flex flex-col items-end">
                                      <span className="text-xs font-mono font-bold text-slate-900">
                                        {charger.totalCapacityKw} kW
                                      </span>
                                      <span
                                        className={`text-[10px] font-mono ${
                                          isDisconnected ? 'text-rose-600' : 'text-emerald-600'
                                        }`}
                                      >
                                        ● {charger.wsStatus}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Connectors breakdown */}
                                  <div className="mt-2.5 space-y-1.5 border-t border-slate-100 pt-2">
                                    {charger.evses.flatMap((evse) =>
                                      evse.connectors.map((conn) => {
                                        const isOffline = charger.wsStatus === 'disconnected' || !charger.wsStatus;
                                        const effStatus: PortStatus = isOffline ? 'Offline' : (conn.status || 'Available');
                                        const colorClass = getStatusColor(effStatus);
                                        const isCharging = effStatus === 'Charging';

                                        return (
                                          <div
                                            key={conn.id}
                                            className="flex items-center justify-between text-xs py-1 px-2 rounded-md bg-slate-50 border border-slate-200/80 font-mono"
                                          >
                                            <div className="flex items-center gap-1.5">
                                              <span className="text-[11px] font-bold text-slate-700">
                                                P{conn.portNumber}
                                              </span>
                                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-white border border-slate-200 text-slate-600 font-sans font-semibold">
                                                {conn.type}
                                              </span>
                                            </div>

                                            <div className="flex items-center gap-2">
                                              {isCharging && conn.currentPowerKw > 0 && (
                                                <span className="text-cyan-700 font-bold text-[11px]">
                                                  {conn.currentPowerKw} kW
                                                </span>
                                              )}
                                              <span
                                                className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${colorClass?.bg} ${colorClass?.text} ${colorClass?.border}`}
                                              >
                                                {formatPortStatus(effStatus)}
                                              </span>
                                            </div>
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                </div>

                                {/* Action button */}
                                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                                  <span className="text-[10px] font-mono text-slate-400">
                                    OCPP {charger.ocppVersion}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onClose();
                                      onSelectStation(charger);
                                    }}
                                    className="btn-3d btn-3d-soft px-2.5 py-1 text-slate-800 text-[11px] font-bold flex items-center gap-1 hover:text-cyan-700"
                                  >
                                    <span>Inspect</span>
                                    <Zap className="w-3 h-3 text-cyan-600" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 text-xs text-slate-600 font-mono">
            <span>
              Network Fleet: <strong>{chargers.length} Chargers</strong> across{' '}
              <strong>{sites.length} Sites</strong>
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-emerald-700 font-semibold">{totalAvailablePorts} Ports Available</span>
            <span className="text-slate-300">•</span>
            <span className="text-cyan-700 font-semibold">{totalChargingPorts} Ports Charging</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigateToChargers();
              }}
              className="btn-3d btn-3d-white px-3.5 py-1.5 text-xs text-slate-800 font-bold"
            >
              Open Full Fleet Table →
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-3d btn-3d-soft px-4 py-1.5 text-xs text-slate-700 font-bold"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
