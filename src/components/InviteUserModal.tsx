import React, { useState } from 'react';
import {
  UserPlus,
  Mail,
  User,
  Shield,
  Building,
  Send,
  X,
  Sparkles,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { UserLevel, Site, InviteEmailRecord } from '../types';
import { authService } from '../lib/authService';

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  sites: Site[];
  onInvitationSent: (emailRecord: InviteEmailRecord) => void;
}

export const InviteUserModal: React.FC<InviteUserModalProps> = ({
  isOpen,
  onClose,
  sites,
  onInvitationSent,
}) => {
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [role, setRole] = useState<UserLevel>('site_manager');
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>(
    sites.length > 0 ? [sites[0].id] : ['site-houston-03']
  );
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const rolesConfig: {
    id: UserLevel;
    label: string;
    description: string;
    badgeColor: string;
  }[] = [
    {
      id: 'site_manager',
      label: 'Site Manager',
      description: 'Manages assigned charging sites, pricing tariffs, and hardware commissioning.',
      badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-300',
    },
    {
      id: 'technician',
      label: 'Technician',
      description: 'Field engineer: checks hardware diagnostics, ground isolation, soft resets, and logs.',
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
    },
    {
      id: 'viewer',
      label: 'Viewer',
      description: 'Read-only audit: monitors telemetry and reports with no control authority.',
      badgeColor: 'bg-slate-100 text-slate-700 border-slate-300',
    },
    {
      id: 'admin',
      label: 'Admin',
      description: 'Full system administrator: user account management, OCPI roaming, pricing, and fleet.',
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
    },
  ];

  const handleToggleSite = (siteId: string) => {
    setSelectedSiteIds((prev) =>
      prev.includes(siteId) ? prev.filter((id) => id !== siteId) : [...prev, siteId]
    );
  };

  const handleSelectAllSites = () => {
    if (selectedSiteIds.length === sites.length) {
      setSelectedSiteIds([]);
    } else {
      setSelectedSiteIds(sites.map((s) => s.id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!recipientEmail || !recipientName) {
      setErrorMsg('Please enter both name and email.');
      return;
    }

    setLoading(true);
    try {
      const assignedNames = sites
        .filter((s) => selectedSiteIds.includes(s.id))
        .map((s) => s.name);

      const res = await authService.inviteUser({
        recipientName,
        recipientEmail,
        role,
        assignedSiteIds: selectedSiteIds,
        assignedSiteNames: assignedNames.length > 0 ? assignedNames : ['All Fleet Locations'],
        notes,
      });

      // Notify parent to open preview
      onInvitationSent(res.emailRecord);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to dispatch invitation email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      aria-modal="true"
      role="dialog"
    >
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 px-6 py-4 text-white flex items-center justify-between border-b border-purple-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-200 text-[10px] font-mono font-bold uppercase tracking-wider">
                  Multi-Level User Provisioning
                </span>
              </div>
              <h2 className="text-base font-black tracking-tight text-white mt-0.5">
                Invite Assignee & Dispatch 1st-Time Login Email
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

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Recipient Full Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Assignee Full Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  required
                  placeholder="e.g. Alex Morgan"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>
            </div>

            {/* Recipient Email Address */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Assignee Email Address <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  required
                  placeholder="e.g. amorgan@energycorridor.com"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>
            </div>
          </div>

          {/* User Role Selection (Site Manager, Technician, Viewer, Admin) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Assign User Level (Role Authority) <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {rolesConfig.map((r) => {
                const isSelected = role === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRole(r.id)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-purple-500 bg-purple-50/70 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">{r.label}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${r.badgeColor}`}>
                        {r.id.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {r.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Site Jurisdiction Assignment */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Authorized Charging Sites (Jurisdiction)
              </label>
              {sites.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAllSites}
                  className="text-[11px] font-bold text-purple-700 hover:underline cursor-pointer"
                >
                  {selectedSiteIds.length === sites.length ? 'Deselect All' : 'Select All Sites'}
                </button>
              )}
            </div>

            <div className="border border-slate-200 rounded-xl p-2.5 max-h-36 overflow-y-auto space-y-1 bg-slate-50">
              {sites.length === 0 ? (
                <div className="text-[11px] text-slate-400 py-2 text-center">
                  No sites currently registered. User will be granted global jurisdiction.
                </div>
              ) : (
                sites.map((site) => {
                  const checked = selectedSiteIds.includes(site.id);
                  return (
                    <label
                      key={site.id}
                      className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white text-xs cursor-pointer text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleSite(site.id)}
                        className="rounded text-purple-600 focus:ring-purple-500"
                      />
                      <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-semibold text-slate-800">{site.name}</span>
                      <span className="text-[10px] font-mono text-slate-400 ml-auto">
                        {site.city}, {site.state}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* Welcome Message / Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Welcome Note / Assignment Details (Optional)
            </label>
            <div className="relative">
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Lead commissioning for newly installed 350kW DC chargers"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
              <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
          </div>

          {/* Explanation Banner */}
          <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl text-[11px] text-purple-900 leading-relaxed">
            <span className="font-bold">Next Step:</span> Upon submission, an invitation email with a
            unique 1st-time login token will be generated and dispatched. The assignee will be able to
            open the link and enter their <strong>own chosen username and permanent password</strong>.
          </div>

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
              disabled={loading || !recipientName || !recipientEmail}
              className="btn-3d btn-3d-cyan flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <span>Dispatching Email...</span>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send 1st-Time Login Email</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
