import React, { useState } from 'react';
import {
  X,
  Building,
  MapPin,
  Zap,
  Check,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import { Site } from '../types';
import { useAuth } from '../lib/AuthContext';

interface AddSiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSite: (newSite: Site) => Promise<void>;
}

export const AddSiteModal: React.FC<AddSiteModalProps> = ({
  isOpen,
  onClose,
  onAddSite,
}) => {
  const { userProfile } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form Fields
  const [siteId, setSiteId] = useState(`site-${Math.random().toString(36).substring(2, 7)}`);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('CA');
  const [transformerLimitKw, setTransformerLimitKw] = useState(1500);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !address.trim() || !city.trim()) {
      setErrorMsg('Please enter Site Name, Address, and City.');
      return;
    }

    if (!siteId.trim()) {
      setErrorMsg('Please provide a Site ID.');
      return;
    }

    if (transformerLimitKw <= 0) {
      setErrorMsg('Transformer capacity must be greater than 0 kW.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const sanitizedId = siteId
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-')
        .replace(/-+/g, '-');

      const newSite: Site = {
        id: sanitizedId,
        name: name.trim(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim().toUpperCase(),
        transformerLimitKw: Number(transformerLimitKw),
        currentLoadKw: 0,
        peakDemandKw24h: 0,
        totalChargers: 0,
        activeSessionsCount: 0,
        offlineCount: 0,
        todayRevenue: 0,
        todayEnergyKwh: 0,
      };

      await onAddSite(newSite);
      setName('');
      setAddress('');
      setCity('');
      setSiteId(`site-${Math.random().toString(36).substring(2, 7)}`);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to register site in Firestore.';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-600 text-white flex items-center justify-center shadow-xs">
              <Building className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Add New Charging Site</h3>
              <p className="text-[11px] text-slate-500">Configure grid interconnection and electrical service location</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto text-xs">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Site Identifier */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Site ID <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                placeholder="site-downtown-01"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-xs text-slate-900 focus:outline-hidden focus:border-cyan-500 focus:bg-white"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Site Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Downtown FastHub Hub #1"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:border-cyan-500 focus:bg-white"
                required
              />
            </div>
          </div>

          {/* Location Details */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Street Address <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="100 Innovation Way"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:border-cyan-500 focus:bg-white"
              required
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="col-span-1 sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                City <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Austin"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:border-cyan-500 focus:bg-white"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                State <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                maxLength={2}
                value={state}
                onChange={(e) => setState(e.target.value.toUpperCase())}
                placeholder="TX"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-xs uppercase text-slate-900 focus:outline-hidden focus:border-cyan-500 focus:bg-white"
                required
              />
            </div>
          </div>

          {/* Grid Electrical Capacity */}
          <div className="p-3.5 rounded-xl bg-cyan-50/50 border border-cyan-100 space-y-2">
            <label className="block font-semibold text-slate-800">
              Utility Transformer Service Limit (kW) <span className="text-rose-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-600 shrink-0" />
              <input
                type="number"
                min="50"
                max="20000"
                step="50"
                value={transformerLimitKw}
                onChange={(e) => setTransformerLimitKw(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs font-bold text-slate-900 focus:outline-hidden focus:border-cyan-500"
                required
              />
              <span className="font-mono text-slate-500 text-xs shrink-0">kW</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Sets the upper threshold for automated peak demand shaving and dynamic power management across EV chargers at this location.
            </p>
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="btn-3d btn-3d-white px-4 py-2 text-slate-700 text-xs font-bold"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-3d btn-3d-cyan px-5 py-2 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
            >
              {submitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving to Firestore...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Site</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
