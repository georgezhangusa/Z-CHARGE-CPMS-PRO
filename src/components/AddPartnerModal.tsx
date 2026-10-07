import React, { useState } from 'react';
import {
  Globe,
  Network,
  Shield,
  Key,
  Mail,
  Send,
  X,
  Sparkles,
  AlertCircle,
  Building,
} from 'lucide-react';
import { OcpiPartner, OcpiRole } from '../types';

interface AddPartnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddPartner: (partner: Omit<OcpiPartner, 'id' | 'lastSync' | 'syncStats'>) => void;
}

export const AddPartnerModal: React.FC<AddPartnerModalProps> = ({
  isOpen,
  onClose,
  onAddPartner,
}) => {
  const [name, setName] = useState('');
  const [role, setRole] = useState<OcpiRole>('eMSP');
  const [countryCode, setCountryCode] = useState('US');
  const [partyId, setPartyId] = useState('');
  const [versionsUrl, setVersionsUrl] = useState('');
  const [tokenA, setTokenA] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [autoSync, setAutoSync] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanPartyId = partyId.trim().toUpperCase();
    const cleanCountry = countryCode.trim().toUpperCase();

    if (!cleanPartyId || cleanPartyId.length !== 3) {
      setErrorMsg('Party ID must be a standard 3-character code (e.g. CPT, HUB, EVG, SHL, ENX).');
      return;
    }

    if (!cleanCountry || cleanCountry.length !== 2) {
      setErrorMsg('Country code must be a 2-letter ISO code (e.g. US, DE, NL, FR, UK).');
      return;
    }

    if (!versionsUrl.startsWith('http')) {
      setErrorMsg('Please enter a valid OCPI Versions URL starting with http:// or https://');
      return;
    }

    onAddPartner({
      name: name.trim(),
      role,
      countryCode: cleanCountry,
      partyId: cleanPartyId,
      status: 'Connected',
      versionsUrl: versionsUrl.trim(),
      tokenA: tokenA.trim() || `tok_a_${cleanPartyId.toLowerCase()}_${Math.random().toString(36).slice(2, 8)}`,
      tokenB: `tok_b_${cleanPartyId.toLowerCase()}_${Math.random().toString(36).slice(2, 8)}`,
      ocpiVersion: '2.2.1',
      autoSync,
      contactEmail: contactEmail.trim() || `roaming@${cleanPartyId.toLowerCase()}.network`,
    });

    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      aria-modal="true"
      role="dialog"
    >
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-6 py-4 text-white flex items-center justify-between border-b border-indigo-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 text-[10px] font-mono font-bold uppercase tracking-wider">
                  OCPI 2.2.1 Handshake
                </span>
              </div>
              <h2 className="text-base font-black tracking-tight text-white mt-0.5">
                Connect New Roaming Partner (eMSP / Hub)
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Partner Organization Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Partner Organization Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Enel X Way, Octopus Electroverse, Gireve"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            {/* Role */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Role Type</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as OcpiRole)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                <option value="eMSP">eMSP Partner</option>
                <option value="HUB">Roaming Hub</option>
                <option value="CPO">Peer CPO</option>
              </select>
            </div>

            {/* Country Code */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Country (ISO-2) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                maxLength={2}
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
                required
                placeholder="US"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>

            {/* Party ID */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Party ID (3-ch) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                maxLength={3}
                value={partyId}
                onChange={(e) => setPartyId(e.target.value.toUpperCase())}
                required
                placeholder="ENX"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
          </div>

          {/* Versions Endpoint URL */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Partner OCPI Versions Endpoint URL <span className="text-rose-500">*</span>
            </label>
            <input
              type="url"
              value={versionsUrl}
              onChange={(e) => setVersionsUrl(e.target.value)}
              required
              placeholder="https://partner-gateway.com/ocpi/versions"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>

          {/* Registration Token A */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Initial Handshake Token A (Optional / Auto-generated)
            </label>
            <input
              type="text"
              value={tokenA}
              onChange={(e) => setTokenA(e.target.value)}
              placeholder="Leave blank to auto-generate authorization token"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>

          {/* Contact Email */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Technical / Operational Contact Email
            </label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="roaming-noc@partner.com"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>

          {/* Auto-Sync Toggle */}
          <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={autoSync}
              onChange={(e) => setAutoSync(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span className="font-semibold text-slate-800">
              Enable Automatic Push of Locations & EVSE Availability (Every 5 minutes)
            </span>
          </label>

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="btn-3d btn-3d-neutral px-4 py-2 rounded-xl text-xs font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-3d btn-3d-cyan flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-white text-xs font-bold shadow-md cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Complete Handshake & Register</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
