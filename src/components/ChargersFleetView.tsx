import React, { useState, useMemo } from 'react';
import {
  Search,
  LayoutGrid,
  List,
  Filter,
  Zap,
  Radio,
  ShieldAlert,
  ChevronRight,
  BatteryCharging,
  Cpu,
  Lock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Plus,
  Database,
  Globe,
  Sliders,
  Trash2,
} from 'lucide-react';
import { ChargingStation, PortStatus, ConnectorType, Session } from '../types';
import { getStatusColor, formatKw, formatPortStatus } from '../utils';

interface ChargersFleetViewProps {
  chargers: ChargingStation[];
  sessions?: Session[];
  onSelectStation: (station: ChargingStation) => void;
  onEditStation?: (station: ChargingStation) => void;
  onDeleteStation?: (station: ChargingStation) => void;
  onOpenSession?: (sessionId: string) => void;
  initialFilterStatus?: PortStatus | 'All';
  initialSearchQuery?: string;
  onOpenAddCharger?: () => void;
}

export const ChargersFleetView: React.FC<ChargersFleetViewProps> = ({
  chargers,
  sessions,
  onSelectStation,
  onEditStation,
  onDeleteStation,
  onOpenSession,
  initialFilterStatus = 'All',
  initialSearchQuery = '',
  onOpenAddCharger,
}) => {
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [statusFilter, setStatusFilter] = useState<string>(initialFilterStatus);
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'DCFC' | 'AC_L2'>('ALL');
  const [connectorFilter, setConnectorFilter] = useState<string>('ALL');

  // Sorting state
  type SortField = 'id' | 'name' | 'power' | 'port1' | 'port2' | 'heartbeat';
  type SortDirection = 'asc' | 'desc';

  const [sortField, setSortField] = useState<SortField>('id');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'power' ? 'desc' : 'asc');
    }
  };

  // Filter logic
  const filteredChargers = chargers.filter((c) => {
    // Search query
    const matchesSearch =
      c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.siteName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.model.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    // Type filter (DCFC / AC_L2)
    if (typeFilter !== 'ALL' && c.type !== typeFilter) return false;

    // Status filter
    if (statusFilter !== 'All') {
      const isOfflineStation = c.wsStatus === 'disconnected' || !c.wsStatus;
      const hasStatus = c.evses.some((evse) =>
        evse.connectors.some((conn) => {
          const effStatus = isOfflineStation ? 'Offline' : (conn.status || 'Available');
          if (statusFilter === 'Occupied' || statusFilter === 'Preparing') {
            return effStatus === 'Occupied' || effStatus === 'Preparing';
          }
          return effStatus === statusFilter;
        })
      );
      if (!hasStatus) return false;
    }

    // Connector filter
    if (connectorFilter !== 'ALL') {
      const hasConnector = c.evses.some((evse) =>
        evse.connectors.some((conn) => conn.type === connectorFilter)
      );
      if (!hasConnector) return false;
    }

    return true;
  });

  // Sorted chargers list
  const sortedChargers = useMemo(() => {
    const list = [...filteredChargers];
    if (!sortField) return list;

    return list.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'id':
          comparison = a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' });
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
          if (comparison === 0) {
            comparison = a.siteName.localeCompare(b.siteName);
          }
          break;
        case 'power':
          comparison = a.currentLoadKw - b.currentLoadKw;
          if (comparison === 0) {
            comparison = a.totalCapacityKw - b.totalCapacityKw;
          }
          break;
        case 'port1': {
          const isAOff = a.wsStatus === 'disconnected' || !a.wsStatus;
          const isBOff = b.wsStatus === 'disconnected' || !b.wsStatus;
          const sA = isAOff ? 'Offline' : (a.evses[0]?.connectors[0]?.status || 'Available');
          const sB = isBOff ? 'Offline' : (b.evses[0]?.connectors[0]?.status || 'Available');
          comparison = sA.localeCompare(sB);
          break;
        }
        case 'port2': {
          const isAOff = a.wsStatus === 'disconnected' || !a.wsStatus;
          const isBOff = b.wsStatus === 'disconnected' || !b.wsStatus;
          const connA = a.evses.length > 1 ? a.evses[1]?.connectors[0] : a.evses[0]?.connectors[1];
          const connB = b.evses.length > 1 ? b.evses[1]?.connectors[0] : b.evses[0]?.connectors[1];
          const sA = isAOff ? 'Offline' : (connA?.status || 'Available');
          const sB = isBOff ? 'Offline' : (connB?.status || 'Available');
          comparison = sA.localeCompare(sB);
          break;
        }
        case 'heartbeat':
          comparison = a.lastHeartbeatSecondsAgo - b.lastHeartbeatSecondsAgo;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredChargers, sortField, sortDirection]);

  const statuses: (PortStatus | 'All')[] = [
    'All',
    'Available',
    'Preparing',
    'Occupied',
    'Charging',
    'SuspendedEV',
    'Finishing',
    'Faulted',
    'Offline',
    'Maintenance',
  ];

  return (
    <div className="space-y-4">
      {/* Top Filter & View Controls Bar */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="charger-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ID, model, or site..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-cyan-500"
            />
          </div>

          {/* Type toggles & Table/Grid toggle */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end overflow-x-auto pb-1 md:pb-0">
            {/* Type selector */}
            <div className="flex rounded-lg bg-slate-100 p-1 border border-slate-200 text-xs gap-1">
              <button
                type="button"
                onClick={() => setTypeFilter('ALL')}
                className={`btn-3d px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                  typeFilter === 'ALL'
                    ? 'btn-3d-white text-slate-900'
                    : 'bg-transparent text-slate-600 hover:text-slate-900 border-0 shadow-none'
                }`}
              >
                All Levels
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('DCFC')}
                className={`btn-3d px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                  typeFilter === 'DCFC'
                    ? 'btn-3d-cyan text-white'
                    : 'bg-transparent text-slate-600 hover:text-slate-900 border-0 shadow-none'
                }`}
              >
                DC Fast
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('AC_L2')}
                className={`btn-3d px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                  typeFilter === 'AC_L2'
                    ? 'btn-3d-white text-slate-900'
                    : 'bg-transparent text-slate-600 hover:text-slate-900 border-0 shadow-none'
                }`}
              >
                AC Level 2
              </button>
            </div>

            {/* View Mode Toggle: Table ▤ vs Card ▦ */}
            <div className="flex rounded-lg bg-slate-100 p-1 border border-slate-200 text-xs shrink-0 gap-1">
              <button
                type="button"
                id="view-mode-table-btn"
                onClick={() => setViewMode('table')}
                title="Dense Table View"
                className={`btn-3d p-1.5 rounded-md transition-all ${
                  viewMode === 'table'
                    ? 'btn-3d-cyan text-white'
                    : 'bg-transparent text-slate-500 hover:text-slate-900 border-0 shadow-none'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                id="view-mode-grid-btn"
                onClick={() => setViewMode('grid')}
                title="Card Grid View"
                className={`btn-3d p-1.5 rounded-md transition-all ${
                  viewMode === 'grid'
                    ? 'btn-3d-cyan text-white'
                    : 'bg-transparent text-slate-500 hover:text-slate-900 border-0 shadow-none'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>

            {/* Add New Charger Action Button */}
            {onOpenAddCharger && (
              <button
                type="button"
                id="add-new-charger-btn"
                onClick={onOpenAddCharger}
                className="btn-3d btn-3d-cyan flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-bold shrink-0 hover:brightness-105 active:scale-95 transition-all shadow-xs cursor-pointer"
                title="Commission new real AC or DCFC EV charger with Webhook and Database persistence"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add New Charger</span>
                <span className="sm:hidden">Add</span>
              </button>
            )}
          </div>
        </div>

        {/* Status Pills Horizontal Scroller */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
          <span className="text-slate-500 text-[11px] font-bold mr-1 flex items-center gap-1 shrink-0">
            <Filter className="w-3 h-3" /> Status:
          </span>
          {statuses.map((st) => {
            const isActive = statusFilter === st;
            return (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`btn-3d px-3 py-1 rounded-full whitespace-nowrap text-xs font-bold transition-all ${
                  isActive
                    ? 'btn-3d-dark'
                    : 'btn-3d-white text-slate-700'
                }`}
              >
                {st}
              </button>
            );
          })}
        </div>
      </div>

      {/* Result Count & Active Sort Summary */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1.5 px-1 text-xs text-slate-500 font-mono">
        <div className="flex items-center gap-2">
          <span>Showing {sortedChargers.length} of {chargers.length} charging stations</span>
          {sortField && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-800 text-[10px] font-bold">
              Sorted: {sortField === 'id' ? 'ID' : sortField === 'name' ? 'Name' : sortField === 'power' ? 'Power' : sortField === 'port1' ? 'Port 1' : sortField === 'port2' ? 'Port 2' : 'Heartbeat'} ({sortDirection === 'asc' ? 'Asc ▲' : 'Desc ▼'})
            </span>
          )}
        </div>
        <span className="text-[11px] text-slate-400">Click headers to sort column • Click row for diagnostics</span>
      </div>

      {/* VIEW MODE 1: DENSE TABLE VIEW or EMPTY STATE */}
      {sortedChargers.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-300 shadow-xs space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center mx-auto shadow-xs">
            <Zap className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">
              {chargers.length === 0 ? 'No EV Chargers Commissioned Yet' : 'No Chargers Match Your Filter'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {chargers.length === 0
                ? 'Commission your first AC Level 2 or DC Fast charging station with Firestore database persistence, or connect a physical charger to the live OCPP WebSocket endpoint.'
                : 'Try adjusting your search query, power level, or status filters to view stations.'}
            </p>
          </div>
          {onOpenAddCharger && (
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                id="empty-state-add-charger-btn"
                onClick={onOpenAddCharger}
                className="btn-3d btn-3d-cyan px-4 py-2.5 text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-xs hover:brightness-105 active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>+ Commission & Add New Charger</span>
              </button>
            </div>
          )}
        </div>
      ) : viewMode === 'table' ? (
        <div className="rounded-xl bg-white border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-mono text-[11px]">
                  {/* CSS selector 1: STATION ID */}
                  <th
                    scope="col"
                    id="th-station-id"
                    onClick={() => handleSort('id')}
                    className={`py-3 px-4 cursor-pointer select-none transition-all group ${
                      sortField === 'id'
                        ? 'bg-cyan-50/90 text-cyan-950 font-bold border-b-2 border-cyan-600'
                        : 'hover:bg-slate-100/90 hover:text-slate-900'
                    }`}
                    title={`Click to sort by Station ID (${sortField === 'id' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'click to activate'})`}
                    aria-sort={sortField === 'id' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <div className="flex items-center gap-1.5 justify-between">
                      <span className="tracking-wider">STATION ID</span>
                      <span className="inline-flex items-center">
                        {sortField === 'id' ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-40 group-hover:opacity-100 group-hover:text-slate-700 transition-all shrink-0" />
                        )}
                      </span>
                    </div>
                  </th>

                  {/* CSS selector 2: LOCATION & MODEL */}
                  <th
                    scope="col"
                    id="th-location-model"
                    onClick={() => handleSort('name')}
                    className={`py-3 px-4 cursor-pointer select-none transition-all group ${
                      sortField === 'name'
                        ? 'bg-cyan-50/90 text-cyan-950 font-bold border-b-2 border-cyan-600'
                        : 'hover:bg-slate-100/90 hover:text-slate-900'
                    }`}
                    title={`Click to sort by Location & Model (${sortField === 'name' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'click to activate'})`}
                    aria-sort={sortField === 'name' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <div className="flex items-center gap-1.5 justify-between">
                      <span className="tracking-wider">LOCATION & MODEL</span>
                      <span className="inline-flex items-center">
                        {sortField === 'name' ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-40 group-hover:opacity-100 group-hover:text-slate-700 transition-all shrink-0" />
                        )}
                      </span>
                    </div>
                  </th>

                  {/* CSS selector 3: POWER & CAPACITY */}
                  <th
                    scope="col"
                    id="th-power-capacity"
                    onClick={() => handleSort('power')}
                    className={`py-3 px-4 cursor-pointer select-none transition-all group ${
                      sortField === 'power'
                        ? 'bg-cyan-50/90 text-cyan-950 font-bold border-b-2 border-cyan-600'
                        : 'hover:bg-slate-100/90 hover:text-slate-900'
                    }`}
                    title={`Click to sort by Power & Capacity (${sortField === 'power' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'click to activate'})`}
                    aria-sort={sortField === 'power' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <div className="flex items-center gap-1.5 justify-between">
                      <span className="tracking-wider">POWER & CAPACITY</span>
                      <span className="inline-flex items-center">
                        {sortField === 'power' ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-40 group-hover:opacity-100 group-hover:text-slate-700 transition-all shrink-0" />
                        )}
                      </span>
                    </div>
                  </th>

                  {/* PORT 1 */}
                  <th
                    scope="col"
                    id="th-port-1"
                    onClick={() => handleSort('port1')}
                    className={`py-3 px-4 cursor-pointer select-none transition-all group ${
                      sortField === 'port1'
                        ? 'bg-cyan-50/90 text-cyan-950 font-bold border-b-2 border-cyan-600'
                        : 'hover:bg-slate-100/90 hover:text-slate-900'
                    }`}
                    title={`Click to sort by Port 1 status (${sortField === 'port1' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'click to activate'})`}
                    aria-sort={sortField === 'port1' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <div className="flex items-center gap-1.5 justify-between">
                      <span className="tracking-wider">PORT 1</span>
                      <span className="inline-flex items-center">
                        {sortField === 'port1' ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-40 group-hover:opacity-100 group-hover:text-slate-700 transition-all shrink-0" />
                        )}
                      </span>
                    </div>
                  </th>

                  {/* PORT 2 */}
                  <th
                    scope="col"
                    id="th-port-2"
                    onClick={() => handleSort('port2')}
                    className={`py-3 px-4 cursor-pointer select-none transition-all group ${
                      sortField === 'port2'
                        ? 'bg-cyan-50/90 text-cyan-950 font-bold border-b-2 border-cyan-600'
                        : 'hover:bg-slate-100/90 hover:text-slate-900'
                    }`}
                    title={`Click to sort by Port 2 status (${sortField === 'port2' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'click to activate'})`}
                    aria-sort={sortField === 'port2' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <div className="flex items-center gap-1.5 justify-between">
                      <span className="tracking-wider">PORT 2</span>
                      <span className="inline-flex items-center">
                        {sortField === 'port2' ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-40 group-hover:opacity-100 group-hover:text-slate-700 transition-all shrink-0" />
                        )}
                      </span>
                    </div>
                  </th>

                  {/* STATUS */}
                  <th
                    scope="col"
                    id="th-heartbeat"
                    onClick={() => handleSort('heartbeat')}
                    className={`py-3 px-4 cursor-pointer select-none transition-all group ${
                      sortField === 'heartbeat'
                        ? 'bg-cyan-50/90 text-cyan-950 font-bold border-b-2 border-cyan-600'
                        : 'hover:bg-slate-100/90 hover:text-slate-900'
                    }`}
                    title={`Click to sort by Connection status (${sortField === 'heartbeat' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'click to activate'})`}
                    aria-sort={sortField === 'heartbeat' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <div className="flex items-center gap-1.5 justify-between">
                      <span className="tracking-wider">STATUS</span>
                      <span className="inline-flex items-center">
                        {sortField === 'heartbeat' ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-40 group-hover:opacity-100 group-hover:text-slate-700 transition-all shrink-0" />
                        )}
                      </span>
                    </div>
                  </th>

                  {/* ACTION */}
                  <th scope="col" className="py-3 px-4 text-right tracking-wider">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedChargers.map((station) => {
                  const allConnectors = station.evses.flatMap((e) => e.connectors);
                  const p1 = allConnectors.find((c) => c.portNumber === 1) || station.evses[0]?.connectors[0];
                  const p2 =
                    allConnectors.find((c) => c.portNumber === 2) ||
                    (station.evses.length > 1
                      ? station.evses[1]?.connectors[0]
                      : station.evses[0]?.connectors[1]);

                  const isStationOffline = station.wsStatus === 'disconnected' || !station.wsStatus;

                  // Active charging sessions for this station and ports
                  const activeStationSession = sessions?.find(
                    (s) => s.stationId === station.id && s.status === 'active'
                  );

                  const getPortActiveSession = (portNumber: number, connActiveSessionId?: string) => {
                    if (connActiveSessionId) {
                      const found = sessions?.find((x) => x.id === connActiveSessionId);
                      return found || { id: connActiveSessionId };
                    }
                    return sessions?.find(
                      (s) => s.stationId === station.id && s.portNumber === portNumber && s.status === 'active'
                    );
                  };

                  const p1Session = p1 ? getPortActiveSession(p1.portNumber, p1.activeSessionId) : null;
                  const p2Session = p2 ? getPortActiveSession(p2.portNumber, p2.activeSessionId) : null;

                  // Port 1/2 initial states should be "Offline", until the network is online
                  const p1Status: PortStatus = isStationOffline ? 'Offline' : (p1?.status || 'Available');
                  const p2Status: PortStatus = isStationOffline ? 'Offline' : (p2?.status || 'Available');

                  const p1Style = p1 ? getStatusColor(p1Status) : null;
                  const p2Style = p2 ? getStatusColor(p2Status) : null;

                  return (
                    <tr
                      key={station.id}
                      onClick={() => onSelectStation(station)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer group"
                    >
                      {/* ID & Hardware tag */}
                      <td className="py-3.5 px-4 font-mono">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900 group-hover:text-cyan-700 transition-colors">
                            {station.id}
                          </span>
                        </div>
                        <div className="mt-1">
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${
                              station.ocppVersion === '2.0.1'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            OCPP {station.ocppVersion}
                          </span>
                        </div>


                        {/*
                        {activeStationSession && (
                          <div className="mt-1.5">
                            <span
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-cyan-50 text-cyan-900 border border-cyan-300 shadow-2xs"
                              title={`Active charging session ID: ${activeStationSession.id}`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse shrink-0" />
                              <span className="text-cyan-700 font-sans font-medium text-[9px]">Session:</span>
                              <span>{activeStationSession.id}</span>
                            </span>
                          </div>
                        )}
                        */}


                      </td>

                      {/* Location & Model */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{station.name}</div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[200px]">
                          {station.siteName}
                        </div>
                      </td>

                      {/* Power & Load */}
                      <td className="py-3.5 px-4 font-mono">
                        <div className="flex items-center gap-1 text-cyan-700 font-bold">
                          <Zap className="w-3 h-3" />
                          <span>{formatKw(station.currentLoadKw)}</span>
                          <span className="text-slate-400 font-normal">
                            / {formatKw(station.totalCapacityKw)}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {station.isSimultaneous ? 'Dynamic Sharing' : 'Mutually Exclusive'}
                        </div>
                      </td>

                      {/* Port 1 */}
                      <td className="py-3.5 px-4">
                        {p1 ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[10px] font-semibold text-slate-700">
                                {p1.type}
                              </span>
                              <span
                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all duration-300 ${p1Style?.bg} ${p1Style?.border}`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    p1Status === 'Charging'
                                      ? 'bg-cyan-500 shadow-xs shadow-cyan-400 animate-ping'
                                      : p1Status === 'Preparing' || p1Status === 'Occupied'
                                        ? 'bg-amber-500 animate-pulse'
                                        : p1Status === 'SuspendedEV' || p1Status === 'SuspendedSystem'
                                          ? 'bg-indigo-500 animate-pulse'
                                          : p1Status === 'Finishing'
                                            ? 'bg-violet-500'
                                            : p1Status === 'Faulted'
                                              ? 'bg-rose-500 animate-pulse'
                                              : p1Status === 'Offline'
                                                ? 'bg-slate-400'
                                                : 'bg-emerald-500'
                                  }`}
                                />
                                <span>{formatPortStatus(p1Status)}</span>
                              </span>
                            </div>
                            {p1Session && (
                              <div className="flex items-center gap-1 text-[10px] font-mono text-cyan-900 mt-0.5">
                                <span className="text-slate-500 font-sans font-medium text-[9px]">Session:</span>
                                <span className="font-bold bg-cyan-50 border border-cyan-200 px-1.5 py-0.2 rounded text-[10px]">
                                  {p1Session.id}
                                </span>
                              </div>
                            )}
                            {p1.currentPowerKw > 0 && (
                              <div className="text-[10px] font-mono text-cyan-700 font-semibold">
                                {p1.currentPowerKw.toFixed(1)} kW{' '}
                                {p1.currentSoc !== undefined ? `(${p1.currentSoc}%)` : ''}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Port 2 */}
                      <td className="py-3.5 px-4">
                        {p2 ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[10px] font-semibold text-slate-700">
                                {p2.type}
                              </span>
                              <span
                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all duration-300 ${p2Style?.bg} ${p2Style?.border}`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    p2Status === 'Charging'
                                      ? 'bg-cyan-500 shadow-xs shadow-cyan-400 animate-ping'
                                      : p2Status === 'Preparing' || p2Status === 'Occupied'
                                        ? 'bg-amber-500 animate-pulse'
                                        : p2Status === 'SuspendedEV' || p2Status === 'SuspendedSystem'
                                          ? 'bg-indigo-500 animate-pulse'
                                          : p2Status === 'Finishing'
                                            ? 'bg-violet-500'
                                            : p2Status === 'Faulted'
                                              ? 'bg-rose-500 animate-pulse'
                                              : p2Status === 'Offline'
                                                ? 'bg-slate-400'
                                                : 'bg-emerald-500'
                                  }`}
                                />
                                <span>{formatPortStatus(p2Status)}</span>
                              </span>
                            </div>
                            {p2Session && (
                              <div className="flex items-center gap-1 text-[10px] font-mono text-cyan-900 mt-0.5">
                                <span className="text-slate-500 font-sans font-medium text-[9px]">Session:</span>
                                <span className="font-bold bg-cyan-50 border border-cyan-200 px-1.5 py-0.2 rounded text-[10px]">
                                  {p2Session.id}
                                </span>
                              </div>
                            )}
                            {p2.currentPowerKw > 0 ? (
                              <div className="text-[10px] font-mono text-cyan-700 font-semibold">
                                {p2.currentPowerKw.toFixed(1)} kW{' '}
                                {p2.currentSoc !== undefined ? `(${p2.currentSoc}%)` : ''}
                              </div>
                            ) : p2.lockoutReason ? (
                              <div className="text-[9px] text-amber-700 font-medium truncate max-w-[120px]">
                                Lockout: Port 1 Active
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Online / Offline Status */}
                      <td className="py-3.5 px-4 font-mono text-[11px]">
                        <div
                          title={
                            station.wsStatus === 'connected'
                              ? `Live WebSocket Connected (IP: ${station.ipAddress || 'Remote client'})`
                              : station.wsStatus === 'lag'
                                ? `Warning: Heartbeat lag without ping`
                                : `Offline: Disconnected`
                          }
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-tight border transition-all ${
                            station.wsStatus === 'connected'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs'
                              : station.wsStatus === 'lag'
                                ? 'bg-amber-50 text-amber-800 border-amber-300 shadow-2xs'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              station.wsStatus === 'connected'
                                ? 'bg-emerald-500 shadow-xs shadow-emerald-400/80 animate-pulse'
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
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => onSelectStation(station)}
                            className="btn-3d btn-3d-white px-2.5 py-1 text-slate-700 text-xs font-bold inline-flex items-center gap-1 hover:text-cyan-700 cursor-pointer"
                            title="Inspect charger diagnostics"
                          >
                            Inspect <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                          {onEditStation && (
                            <button
                              type="button"
                              onClick={() => onEditStation(station)}
                              className="btn-3d btn-3d-white p-1 text-slate-600 hover:text-cyan-700 cursor-pointer"
                              title="Edit charger configuration"
                            >
                              <Sliders className="w-3.5 h-3.5 text-cyan-600" />
                            </button>
                          )}
                          {onDeleteStation && (
                            <button
                              type="button"
                              onClick={() => onDeleteStation(station)}
                              className="btn-3d btn-3d-white p-1 text-rose-600 hover:text-rose-700 cursor-pointer"
                              title="Decommission charger"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* VIEW MODE 2: CARD GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedChargers.map((station) => {
            const headroom = Math.max(0, station.totalCapacityKw - station.currentLoadKw);
            return (
              <div
                key={station.id}
                onClick={() => onSelectStation(station)}
                className="p-4 rounded-xl bg-white border border-slate-200 hover:border-cyan-400 hover:shadow-sm transition-all cursor-pointer space-y-3 group"
              >
                {/* Card Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-sm font-bold text-slate-900 group-hover:text-cyan-700">
                        {station.id}
                      </span>
                    </div>
                    <div className="text-xs text-slate-800 font-semibold mt-0.5">{station.name}</div>
                    <div className="text-[11px] text-slate-500 truncate max-w-[200px]">
                      {station.siteName}
                    </div>
                    {sessions?.find((s) => s.stationId === station.id && s.status === 'active') && (
                      <div className="mt-1">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-50 text-cyan-900 border border-cyan-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse shrink-0" />
                          <span className="text-cyan-700 font-sans font-medium text-[9px]">Session:</span>
                          <span>{sessions.find((s) => s.stationId === station.id && s.status === 'active')?.id}</span>
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono border font-semibold ${
                        station.wsStatus === 'connected'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : station.wsStatus === 'lag'
                            ? 'bg-amber-50 text-amber-800 border-amber-300'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          station.wsStatus === 'connected'
                            ? 'bg-emerald-500 animate-pulse'
                            : station.wsStatus === 'lag'
                              ? 'bg-amber-500 animate-ping'
                              : 'bg-rose-500'
                        }`}
                      />
                      {station.wsStatus === 'connected'
                        ? 'Online'
                        : station.wsStatus === 'lag'
                          ? 'Lag'
                          : 'Offline'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{station.ocppVersion}</span>
                  </div>
                </div>

                {/* Power Bar */}
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-slate-600 flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-cyan-600" />
                      Live: <strong className="text-slate-900">{formatKw(station.currentLoadKw)}</strong>
                    </span>
                    <span className="text-slate-400">Cap: {formatKw(station.totalCapacityKw)}</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-600"
                      style={{
                        width: `${Math.min(
                          100,
                          (station.currentLoadKw / station.totalCapacityKw) * 100
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono flex justify-between">
                    <span>{station.isSimultaneous ? 'Simultaneous Ports' : 'Exclusive Port Lock'}</span>
                    <span className="text-emerald-700 font-medium">Headroom: {formatKw(headroom)}</span>
                  </div>
                </div>

                {/* Connectors / Ports preview */}
                <div className="space-y-1.5 pt-1">
                  {station.evses.map((evse) =>
                    evse.connectors.map((conn) => {
                      const connSession = sessions?.find(
                        (s) => s.stationId === station.id && s.portNumber === conn.portNumber && s.status === 'active'
                      ) || (conn.activeSessionId ? { id: conn.activeSessionId } : null);

                      const isStationOffline = station.wsStatus === 'disconnected' || !station.wsStatus;
                      const effStatus: PortStatus = isStationOffline ? 'Offline' : (conn.status || 'Available');
                      const st = getStatusColor(effStatus);

                      return (
                        <div
                          key={conn.id}
                          className="flex items-center justify-between p-2 rounded-md bg-slate-50 border border-slate-100 text-xs"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-slate-600 font-medium">
                              P{conn.portNumber} ({conn.type})
                            </span>
                            {connSession && (
                              <span className="font-mono text-[9px] text-cyan-800 bg-cyan-100/70 border border-cyan-200 px-1 py-0.2 rounded font-bold">
                                SID: {connSession.id}
                              </span>
                            )}
                            {conn.currentPowerKw > 0 && (
                              <span className="font-mono text-cyan-700 font-bold">
                                {conn.currentPowerKw.toFixed(1)} kW
                              </span>
                            )}
                          </div>
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all duration-300 ${st.bg} ${st.border}`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                effStatus === 'Charging'
                                  ? 'bg-cyan-500 shadow-xs shadow-cyan-400 animate-ping'
                                  : effStatus === 'Preparing' || effStatus === 'Occupied'
                                    ? 'bg-amber-500 animate-pulse'
                                    : effStatus === 'SuspendedEV' || effStatus === 'SuspendedSystem'
                                      ? 'bg-indigo-500 animate-pulse'
                                      : effStatus === 'Finishing'
                                        ? 'bg-violet-500'
                                        : effStatus === 'Faulted'
                                          ? 'bg-rose-500 animate-pulse'
                                          : effStatus === 'Offline'
                                            ? 'bg-slate-400'
                                            : 'bg-emerald-500'
                              }`}
                            />
                            <span>{formatPortStatus(effStatus)}</span>
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Card Actions Footer */}
                <div
                  className="flex items-center justify-between pt-2.5 border-t border-slate-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => onSelectStation(station)}
                    className="btn-3d btn-3d-cyan px-2.5 py-1 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Inspect</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-center gap-1.5">
                    {onEditStation && (
                      <button
                        type="button"
                        onClick={() => onEditStation(station)}
                        className="btn-3d btn-3d-white px-2 py-1 text-slate-700 text-xs font-bold inline-flex items-center gap-1 hover:text-cyan-700 cursor-pointer"
                        title="Edit Charger Configuration"
                      >
                        <Sliders className="w-3 h-3 text-cyan-600" />
                        <span>Edit</span>
                      </button>
                    )}
                    {onDeleteStation && (
                      <button
                        type="button"
                        onClick={() => onDeleteStation(station)}
                        className="btn-3d btn-3d-white p-1 text-rose-600 hover:text-rose-700 cursor-pointer"
                        title="Decommission Charger"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
