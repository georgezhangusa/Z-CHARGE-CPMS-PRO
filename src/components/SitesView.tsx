import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Zap,
  DollarSign,
  AlertTriangle,
  Sliders,
  X,
  CheckCircle,
  Building,
  TrendingUp,
  Trash2,
  Save,
  ShieldAlert,
} from 'lucide-react';
import { Site, ChargingStation } from '../types';
import { formatKw, formatCurrency } from '../utils';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface SitesViewProps {
  sites: Site[];
  chargers: ChargingStation[];
  onOpenStation: (station: ChargingStation) => void;
  onNavigateToChargers: (siteId: string) => void;
  onOpenAddSite?: () => void;
  onUpdateSite?: (updatedSite: Site) => Promise<void> | void;
  onDeleteSite?: (siteId: string) => Promise<void> | void;
}

export const SitesView: React.FC<SitesViewProps> = ({
  sites,
  chargers,
  onOpenStation,
  onNavigateToChargers,
  onOpenAddSite,
  onUpdateSite,
  onDeleteSite,
}) => {
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [deletingSite, setDeletingSite] = useState<Site | null>(null);

  // Edit Site Form State
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editState, setEditState] = useState('');
  const [editZip, setEditZip] = useState('');
  const [editTransformerLimitKw, setEditTransformerLimitKw] = useState(2500);
  const [peakShavingEnabled, setPeakShavingEnabled] = useState(true);
  const [demandLimitKw, setDemandLimitKw] = useState(2000);
  const [submitting, setSubmitting] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'grid'>('profile');

  useEffect(() => {
    if (selectedSite) {
      setEditName(selectedSite.name || '');
      setEditAddress(selectedSite.address || '');
      setEditCity(selectedSite.city || '');
      setEditState(selectedSite.state || '');
      setEditZip(selectedSite.zip || '');
      setEditTransformerLimitKw(selectedSite.transformerLimitKw || 2500);
      setDemandLimitKw(selectedSite.peakDemandKw24h ? Math.round(selectedSite.transformerLimitKw * 0.85) : 2000);
      setSavedSuccess(false);
      setActiveTab('profile');
    }
  }, [selectedSite]);

  const handleSaveSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSite) return;

    setSubmitting(true);
    try {
      const updated: Site = {
        ...selectedSite,
        name: editName.trim() || selectedSite.name,
        address: editAddress.trim() || selectedSite.address,
        city: editCity.trim() || selectedSite.city,
        state: editState.trim() || selectedSite.state,
        zip: editZip.trim() || selectedSite.zip,
        transformerLimitKw: Number(editTransformerLimitKw),
      };

      if (onUpdateSite) {
        await onUpdateSite(updated);
      }
      setSavedSuccess(true);
      setTimeout(() => {
        setSelectedSite(null);
        setSavedSuccess(false);
      }, 1500);
    } catch (err) {
      console.error('Error saving site:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Intro strip */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Building className="w-4 h-4 text-cyan-600" />
            Grid Interconnection & Site Electrical Service Management
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time transformer capacity tracking, peak demand shaving, and site power distribution.
          </p>
        </div>

        {onOpenAddSite && (
          <button
            type="button"
            onClick={onOpenAddSite}
            className="btn-3d btn-3d-cyan flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-bold shrink-0 hover:brightness-105 active:scale-95 transition-all shadow-xs cursor-pointer"
          >
            <Building className="w-4 h-4" />
            <span>+ Add New Site</span>
          </button>
        )}
      </div>

      {/* Empty State when no sites exist */}
      {sites.length === 0 ? (
        <div className="p-10 text-center bg-white rounded-2xl border border-dashed border-slate-300 shadow-xs space-y-3">
          <div className="w-12 h-12 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center mx-auto">
            <Building className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No Charging Sites Configured</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Create your first charging site / facility to organize your EV chargers, manage electrical transformer limits, and track peak power demand.
          </p>
          {onOpenAddSite && (
            <button
              type="button"
              onClick={onOpenAddSite}
              className="btn-3d btn-3d-cyan px-4 py-2 text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <Building className="w-4 h-4" />
              <span>Add New Site</span>
            </button>
          )}
        </div>
      ) : (
        /* Site Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sites.map((site) => {
          const siteChargers = chargers.filter(
            (c) => c.siteId === site.id || (c.siteName && site.name && c.siteName.toLowerCase() === site.name.toLowerCase())
          );
          const totalChargersInDb = siteChargers.length;
          const activeSessionsCount = siteChargers.filter((c) =>
            c.evses.some((e) => e.connectors.some((cn) => cn.status === 'Charging'))
          ).length;
          const offlineCount = siteChargers.filter(
            (c) =>
              c.wsStatus === 'disconnected' ||
              c.evses.some((e) => e.connectors.every((cn) => cn.status === 'Unavailable'))
          ).length;
          const availableCount = Math.max(0, totalChargersInDb - activeSessionsCount - offlineCount);

          const calculatedLoadKw = siteChargers.reduce((sum, c) => sum + (c.currentLoadKw || 0), 0);
          const currentLoadKw = calculatedLoadKw > 0 ? calculatedLoadKw : (site.currentLoadKw || 0);
          const transformerLimit = site.transformerLimitKw || 2500;
          const loadPercent = Math.min(100, Math.round((currentLoadKw / transformerLimit) * 100));
          const isWarning = loadPercent >= 70;
          const headroomKw = Math.max(0, transformerLimit - currentLoadKw);

          return (
            <div
              key={site.id}
              className="p-5 rounded-xl bg-white border border-slate-200 space-y-4 hover:border-slate-300 transition-all shadow-xs"
            >
              {/* Site Header */}
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-cyan-600 shrink-0" />
                    <h3 className="font-bold text-slate-900 text-sm tracking-tight">{site.name}</h3>
                  </div>
                  <p className="text-xs text-slate-500 pl-6">{site.address}, {site.city}, {site.state}</p>
                </div>

                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono text-[11px] border border-slate-200 font-medium">
                  {totalChargersInDb} {totalChargersInDb === 1 ? 'Charger' : 'Chargers'}
                </span>
              </div>

              {/* Status summary pill */}
              <div className="flex items-center gap-2 text-xs font-mono p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-cyan-700 font-bold">{activeSessionsCount} Active Charging</span>
                <span className="text-slate-300">•</span>
                <span className="text-emerald-700 font-medium">
                  {availableCount} Available
                </span>
                {offlineCount > 0 && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="text-rose-600 font-medium">{offlineCount} Offline</span>
                  </>
                )}
              </div>

              {/* Power Demand & Transformer Limit Bar */}
              <div className="space-y-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600 font-medium flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-cyan-600" />
                    Site Power Demand
                  </span>
                  <div className="font-mono">
                    <span className={`font-bold ${isWarning ? 'text-amber-700' : 'text-cyan-700'}`}>
                      {formatKw(currentLoadKw)}
                    </span>
                    <span className="text-slate-400"> / {formatKw(transformerLimit)} Grid Limit</span>
                  </div>
                </div>

                {/* Meter Bar */}
                <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden flex">
                  <div
                    className={`h-full transition-all duration-500 ${
                      loadPercent >= 80
                        ? 'bg-rose-500'
                        : isWarning
                          ? 'bg-amber-500'
                          : 'bg-cyan-600'
                    }`}
                    style={{ width: `${loadPercent}%` }}
                  />
                </div>

                <div className="flex justify-between text-[11px] font-mono text-slate-600">
                  <span>Capacity Utilized: {loadPercent}%</span>
                  <span className="text-emerald-700 font-medium">Headroom: {formatKw(headroomKw)}</span>
                </div>
              </div>

              {/* Revenue & Energy */}
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                <div className="flex items-center gap-1.5 text-slate-600">
                  <DollarSign className="w-3.5 h-3.5 text-amber-600" />
                  <span>Today's Revenue: </span>
                  <strong className="text-slate-900 font-mono">{formatCurrency(site.todayRevenue)}</strong>
                </div>
                <div className="text-slate-500 font-mono text-[11px]">
                  {(site.todayEnergyKwh / 1000).toFixed(1)} MWh today
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSite(site);
                    setSavedSuccess(false);
                  }}
                  className="btn-3d btn-3d-white flex-1 py-2 px-3 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5 text-cyan-600" />
                  <span>Manage & Edit Site</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateToChargers(site.id)}
                  className="btn-3d btn-3d-cyan py-2 px-3 text-white text-xs font-bold cursor-pointer"
                >
                  View Chargers →
                </button>
                {onDeleteSite && (
                  <button
                    type="button"
                    disabled={totalChargersInDb > 0}
                    onClick={() => {
                      if (totalChargersInDb === 0) {
                        setDeletingSite(site);
                      }
                    }}
                    title={
                      totalChargersInDb > 0
                        ? `Cannot decommission site: ${totalChargersInDb} charger(s) assigned. Only sites with zero chargers can be decommissioned.`
                        : `Decommission site "${site.name}"`
                    }
                    className={`btn-3d btn-3d-white p-2 ${
                      totalChargersInDb > 0
                        ? 'opacity-40 cursor-not-allowed text-slate-400'
                        : 'text-rose-600 hover:text-rose-700 cursor-pointer'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Site Management & Peak Shaving Slide-out Modal */}
      {selectedSite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div
            id="manage-site-modal"
            className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden text-slate-800 space-y-4"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-100 text-cyan-700 border border-cyan-200">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-sm tracking-tight">Edit Site Configuration</h3>
                    <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-bold">
                      {selectedSite.id}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">Update facility details, transformer limits, and peak shaving</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSite(null)}
                className="btn-3d btn-3d-white p-1 rounded-lg text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 px-6 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                className={`py-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 cursor-pointer transition-colors ${
                  activeTab === 'profile'
                    ? 'border-cyan-600 text-cyan-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Building className="w-3.5 h-3.5" />
                <span>Site Profile & Interconnection</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('grid')}
                className={`py-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 cursor-pointer transition-colors ${
                  activeTab === 'grid'
                    ? 'border-cyan-600 text-cyan-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Smart Charging & Grid Limits</span>
              </button>
            </div>

            <form onSubmit={handleSaveSite} className="p-6 space-y-4 text-xs">
              {savedSuccess ? (
                <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-center space-y-2">
                  <CheckCircle className="w-7 h-7 text-emerald-600 mx-auto" />
                  <p className="font-bold text-sm">Site Configuration Saved</p>
                  <p className="text-xs text-emerald-700">
                    Facility details and electrical parameters for {selectedSite.name} updated successfully.
                  </p>
                </div>
              ) : (
                <>
                  {activeTab === 'profile' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">Site Facility Name *</label>
                        <input
                          type="text"
                          required
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="e.g. Downtown Plaza Hyperhub"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:border-cyan-500 focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">Street Address *</label>
                        <input
                          type="text"
                          required
                          value={editAddress}
                          onChange={(e) => setEditAddress(e.target.value)}
                          placeholder="e.g. 500 Howard Street"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:border-cyan-500 focus:bg-white"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-slate-700 font-semibold mb-1">City *</label>
                          <input
                            type="text"
                            required
                            value={editCity}
                            onChange={(e) => setEditCity(e.target.value)}
                            placeholder="San Francisco"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:border-cyan-500 focus:bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-700 font-semibold mb-1">State *</label>
                          <input
                            type="text"
                            required
                            value={editState}
                            onChange={(e) => setEditState(e.target.value)}
                            placeholder="CA"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:border-cyan-500 focus:bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-700 font-semibold mb-1">Postal Code *</label>
                          <input
                            type="text"
                            required
                            value={editZip}
                            onChange={(e) => setEditZip(e.target.value)}
                            placeholder="94105"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:border-cyan-500 focus:bg-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">
                          Utility Dedicated Transformer Limit (kW) *
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            required
                            min="100"
                            max="50000"
                            step="50"
                            value={editTransformerLimitKw}
                            onChange={(e) => setEditTransformerLimitKw(Number(e.target.value))}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-hidden focus:border-cyan-500 focus:bg-white"
                          />
                          <span className="absolute right-3 top-2 text-slate-400 font-mono text-xs">
                            {(editTransformerLimitKw / 1000).toFixed(2)} MW
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">
                          The hard limit agreed upon with the electrical utility provider for this interconnection.
                        </p>
                      </div>
                    </div>
                  )}

                  {activeTab === 'grid' && (
                    <div className="space-y-4">
                      <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2 font-mono">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Utility Transformer Limit:</span>
                          <span className="text-slate-900 font-bold">
                            {editTransformerLimitKw} kW ({(editTransformerLimitKw / 1000).toFixed(1)} MW)
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Current Instantaneous Load:</span>
                          <span className="text-cyan-700 font-bold">{selectedSite.currentLoadKw} kW</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">24-Hour Peak Recorded:</span>
                          <span className="text-amber-700 font-bold">{selectedSite.peakDemandKw24h} kW</span>
                        </div>
                      </div>

                      {/* Peak Shaving Automation */}
                      <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-slate-900 block">
                              Dynamic Load Curtailment (Smart Charging)
                            </span>
                            <span className="text-slate-500 text-[11px]">
                              Throttle charging sessions automatically via OCPP SetChargingProfile when nearing grid ceiling.
                            </span>
                          </div>
                          <input
                            type="checkbox"
                            checked={peakShavingEnabled}
                            onChange={(e) => setPeakShavingEnabled(e.target.checked)}
                            className="w-4 h-4 rounded-sm accent-cyan-600 cursor-pointer"
                          />
                        </div>

                        {peakShavingEnabled && (
                          <div className="pt-2 border-t border-slate-200 space-y-1.5">
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-700 font-medium">Soft Demand Ceiling:</span>
                              <span className="font-mono text-cyan-700 font-bold">{demandLimitKw} kW</span>
                            </div>
                            <input
                              type="range"
                              min="100"
                              max={editTransformerLimitKw}
                              step="50"
                              value={demandLimitKw}
                              onChange={(e) => setDemandLimitKw(Number(e.target.value))}
                              className="w-full accent-cyan-600 bg-slate-200 h-1.5 rounded-lg cursor-pointer"
                            />
                            <div className="text-[10px] text-slate-500">
                              When load exceeds {demandLimitKw} kW, active DCFCs will be gracefully throttled by 15% to avoid utility peak demand charges.
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Danger Zone: Decommission Site Facility (INSIDE SITE EDITING PAGE) */}
                  {(() => {
                    const assignedChargers = chargers.filter(
                      (c) => c.siteId === selectedSite.id || (c.siteName && selectedSite.name && c.siteName.toLowerCase() === selectedSite.name.toLowerCase())
                    );
                    const assignedCount = assignedChargers.length;
                    const canDecommission = assignedCount === 0;

                    if (!canDecommission) {
                      return (
                        <div className="p-4 rounded-xl bg-amber-50/90 border border-amber-200 space-y-2 mt-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
                                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                                <span>Decommissioning Restricted: {assignedCount} Active Charger{assignedCount > 1 ? 's' : ''} Assigned</span>
                              </div>
                              <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">
                                A charging site can only be decommissioned when it has <strong>zero chargers</strong>. Currently, {assignedCount} charger{assignedCount > 1 ? 's are' : ' is'} deployed at {selectedSite.name}. Please reassign or decommission all chargers first.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSite(null);
                                onNavigateToChargers(selectedSite.id);
                              }}
                              className="btn-3d btn-3d-white px-3 py-1.5 text-xs font-bold text-slate-800 shrink-0 flex items-center gap-1 cursor-pointer"
                            >
                              <span>View {assignedCount} Chargers →</span>
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-200 space-y-2 mt-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-1.5 text-rose-900 font-bold text-xs">
                              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                              <span>Danger Zone: Decommission Site Facility</span>
                            </div>
                            <p className="text-[11px] text-rose-700 mt-1 leading-relaxed">
                              This facility has 0 chargers assigned and is eligible for decommissioning. Permanently remove this site and delete its electrical grid interconnection records. Requires safety confirmation.
                            </p>
                          </div>
                          <button
                            type="button"
                            id="modal-decommission-site-btn"
                            onClick={() => {
                              setDeletingSite(selectedSite);
                            }}
                            className="btn-3d btn-3d-rose px-3.5 py-1.5 text-white text-xs font-bold shrink-0 flex items-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Decommission Site</span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Footer Action Buttons */}
                  <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setSelectedSite(null)}
                      disabled={submitting}
                      className="btn-3d btn-3d-white px-4 py-2 text-slate-700 text-xs font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="btn-3d btn-3d-cyan px-5 py-2 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Save className="w-4 h-4" />
                      <span>{submitting ? 'Saving Changes...' : 'Save Site Configuration'}</span>
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Confirm Decommission Modal for Site */}
      {deletingSite && (
        <ConfirmDeleteModal
          isOpen={!!deletingSite}
          onClose={() => setDeletingSite(null)}
          title="Decommission Charging Site"
          itemType="site"
          itemId={deletingSite.id}
          itemName={deletingSite.name}
          warningText={`Permanently decommission site "${deletingSite.name}" (${deletingSite.address}, ${deletingSite.city}, ${deletingSite.state}). All electrical service records and transformer grid limits will be removed from the database.`}
          onConfirm={async () => {
            if (onDeleteSite) {
              await onDeleteSite(deletingSite.id);
            }
            if (selectedSite?.id === deletingSite.id) {
              setSelectedSite(null);
            }
            setDeletingSite(null);
          }}
        />
      )}
    </div>
  );
};
