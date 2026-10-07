import React, { useState } from 'react';
import {
  Mail,
  Copy,
  Check,
  ExternalLink,
  Shield,
  Zap,
  Clock,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { InviteEmailRecord } from '../types';

interface InviteEmailPreviewModalProps {
  emailRecord: InviteEmailRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSimulateClickLink: (token: string) => void;
}

export const InviteEmailPreviewModal: React.FC<InviteEmailPreviewModalProps> = ({
  emailRecord,
  isOpen,
  onClose,
  onSimulateClickLink,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !emailRecord) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(emailRecord.inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getRoleTitle = (role: string) => {
    switch (role) {
      case 'admin':
        return 'System Administrator';
      case 'site_manager':
        return 'Site Operations Manager';
      case 'technician':
        return 'Field Diagnostics Technician';
      default:
        return 'Compliance & Audit Viewer';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      aria-modal="true"
      role="dialog"
    >
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800 flex flex-col max-h-[92vh]">
        {/* Top Bar with SMTP Dispatch confirmation */}
        <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  SMTP 250 OK: Email Dispatched
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Simulated Outbox</span>
              </div>
              <h3 className="text-sm font-bold text-white">First-Time Login Invitation Sent</h3>
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

        {/* Scrollable Email Preview Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs bg-slate-100">
          {/* Email Envelope Meta Header */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-1.5">
            <div className="grid grid-cols-[80px_1fr] items-center gap-2 text-slate-600">
              <span className="font-bold text-slate-400 uppercase text-[10px] tracking-wider">From:</span>
              <span className="font-mono text-slate-800 font-semibold">
                Z-CHARGE CPMS Security &lt;security@zcharge-cpms.com&gt;
              </span>
            </div>
            <div className="grid grid-cols-[80px_1fr] items-center gap-2 text-slate-600">
              <span className="font-bold text-slate-400 uppercase text-[10px] tracking-wider">To:</span>
              <span className="font-mono text-cyan-800 font-bold">
                {emailRecord.recipientName} &lt;{emailRecord.recipientEmail}&gt;
              </span>
            </div>
            <div className="grid grid-cols-[80px_1fr] items-center gap-2 text-slate-600">
              <span className="font-bold text-slate-400 uppercase text-[10px] tracking-wider">Subject:</span>
              <span className="font-bold text-slate-900">
                Action Required: Welcome to Z-CHARGE CPMS - Activate your {getRoleTitle(emailRecord.role)} Account
              </span>
            </div>
          </div>

          {/* Rendered HTML Email Content */}
          <div className="bg-white border border-slate-300 rounded-2xl shadow-md overflow-hidden">
            {/* Email Header */}
            <div className="bg-slate-900 px-6 py-5 text-white flex items-center justify-between border-b border-cyan-500/40">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-500 text-white flex items-center justify-center font-bold">
                  <Zap className="w-4 h-4 fill-current" />
                </div>
                <div>
                  <span className="text-sm font-black tracking-widest text-cyan-400 font-mono">Z-CHARGE</span>
                  <span className="text-sm font-semibold text-white ml-1 font-mono">CPMS PRO</span>
                </div>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">Official Security Notice</span>
            </div>

            {/* Email Body Message */}
            <div className="p-6 space-y-4 text-slate-700">
              <div>
                <p className="text-sm font-bold text-slate-900">
                  Hello {emailRecord.recipientName},
                </p>
                <p className="mt-1 leading-relaxed text-xs">
                  You have been assigned access to the <strong className="text-slate-900">Z-CHARGE EV Charging Management System (CPMS)</strong> with the following credential level:
                </p>
              </div>

              {/* Assignment Badge Card */}
              <div className="bg-cyan-50/70 border border-cyan-200 rounded-xl p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-cyan-900 font-bold text-xs">Assigned User Level:</span>
                  <span className="px-2 py-0.5 rounded-full bg-cyan-700 text-white text-[10px] font-mono font-bold uppercase tracking-wider">
                    {getRoleTitle(emailRecord.role)} ({emailRecord.role.toUpperCase()})
                  </span>
                </div>
                {emailRecord.assignedSiteNames && emailRecord.assignedSiteNames.length > 0 && (
                  <div className="flex items-center justify-between text-[11px] text-cyan-800">
                    <span>Authorized Sites:</span>
                    <span className="font-semibold">{emailRecord.assignedSiteNames.join(', ')}</span>
                  </div>
                )}
              </div>

              <p className="leading-relaxed text-xs">
                To guarantee zero-trust credential hygiene, no default or shared password was assigned to you.
                Please click the button below to complete your first-time registration, where you will enter your own
                <strong> chosen username and personal password</strong>:
              </p>

              {/* Primary Call to Action Button inside Email */}
              <div className="py-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSimulateClickLink(emailRecord.inviteToken);
                  }}
                  className="btn-3d btn-3d-cyan inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold text-xs shadow-lg hover:brightness-105 active:scale-95 transition-all cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Complete Account Setup & Choose Password</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                </button>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-start gap-2">
                <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Security Expiration:</span> This one-time activation link is valid for 48 hours. After entering your credentials, your account will be immediately active.
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 font-mono break-all">
                Direct Onboarding URL:
                <div className="text-cyan-700 underline mt-0.5 font-sans text-[11px]">
                  {emailRecord.inviteUrl}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleCopyLink}
            className="btn-3d btn-3d-neutral flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Link Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Copy 1st-Time Link</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-3d btn-3d-neutral px-4 py-2 rounded-xl text-xs font-bold"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onSimulateClickLink(emailRecord.inviteToken);
              }}
              className="btn-3d btn-3d-cyan flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-bold shadow-md cursor-pointer"
            >
              <span>Simulate Assignee Onboarding</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
