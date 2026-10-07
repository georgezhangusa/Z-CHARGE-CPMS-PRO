import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  BookOpen,
  Mail,
  Linkedin,
  Zap,
  CheckCircle2,
  Cpu,
  Layers,
  Sparkles,
  Copy,
  Check,
  Activity,
  ArrowUpRight,
  ExternalLink,
} from 'lucide-react';

interface ReadmeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReadmeModal: React.FC<ReadmeModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  const rawReadme = `The EV Charge Point Management System (CPMS or CMS) manages the electric vehicle (EV) charging equipment (EVSE) for large-scale public or enterprise fleets. It manages charging sessions using OCPP versions 1.6j or 2.0.1 and processes credit card transactions through OCPI. It also monitors equipment health. Future features will include Time of Use (ToU) pricing, Plug-n-Charge (PnC), V2G, Smart Charge, and Load Balancing.

This is a conceptual demonstration. If you see potential to develop this into an enterprise-grade CPMS, we can collaborate to make it happen.
Please get in touch with the author, George Zhang, by email: z_george@yahoo.com or reach me on LinkedIn: georgezhangusa`;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(rawReadme);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="readme-modal-container"
        className="w-full max-w-3xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-800 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500 text-white flex items-center justify-center shadow-sm shadow-cyan-500/30 shrink-0">
              <BookOpen className="w-4 h-4 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base tracking-tight text-white font-mono">
                  Z-CHARGE CPMS
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/50 text-cyan-300 font-mono text-[11px] font-bold">
                  README.md
                </span>
              </div>
              <p className="text-xs text-slate-400">
                EV Charge Point Management System Overview
              </p>
            </div>
          </div>
          <button
            type="button"
            id="readme-close-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Complete README Contents */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-sm">
          {/* Main Statement from README.md */}
          <div className="space-y-3">
            <p className="text-slate-800 leading-relaxed text-sm sm:text-base font-normal">
              The <strong className="text-slate-950 font-bold">EV Charge Point Management System (CPMS or CMS)</strong> manages the electric vehicle (EV) charging equipment (EVSE) for large-scale public or enterprise fleets. It manages charging sessions using <strong className="text-cyan-800 font-semibold">OCPP versions 1.6j or 2.0.1</strong> and processes credit card transactions through <strong className="text-emerald-800 font-semibold">OCPI</strong>. It also monitors equipment health.
            </p>

            {/* Core Capability Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <div className="flex items-center gap-2 p-2.5 rounded-xl border border-cyan-200 bg-cyan-50/70 text-xs text-cyan-950 font-semibold">
                <Cpu className="w-4 h-4 text-cyan-600 shrink-0" />
                <span>OCPP 1.6j & 2.0.1</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 text-xs text-emerald-950 font-semibold">
                <Layers className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>OCPI Credit Card Clearing</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-xl border border-amber-200 bg-amber-50/70 text-xs text-amber-950 font-semibold">
                <Activity className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Equipment Health Monitoring</span>
              </div>
            </div>
          </div>

          {/* Future Features & Roadmap */}
          <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/60 space-y-2.5">
            <div className="flex items-center gap-2 text-purple-900 font-bold text-xs uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span>Future Features</span>
            </div>
            <p className="text-xs text-purple-950 leading-relaxed">
              Future features will include:
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                'Time of Use (ToU) Pricing',
                'Plug-n-Charge (PnC)',
                'V2G (Vehicle-to-Grid)',
                'Smart Charge',
                'Load Balancing',
              ].map((feature) => (
                <span
                  key={feature}
                  className="px-3 py-1 rounded-lg bg-white border border-purple-300 text-purple-900 text-xs font-semibold flex items-center gap-1.5 shadow-2xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
                  <span>{feature}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Conceptual Demonstration & Collaboration */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-900 text-white space-y-3 shadow-md">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-cyan-400 fill-cyan-400" />
                <h4 className="font-bold text-xs uppercase tracking-wider text-cyan-400 font-mono">
                  Conceptual Demonstration
                </h4>
              </div>
              <p className="text-slate-200 text-xs sm:text-sm leading-relaxed">
                This is a conceptual demonstration. If you see potential to develop this into an enterprise-grade CPMS, we can collaborate to make it happen.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-800 space-y-2">
              <p className="text-xs text-slate-300">
                Please get in touch with the author, <strong className="text-white font-semibold">George Zhang</strong>:
              </p>
              <div className="flex flex-wrap items-center gap-2.5">
                <a
                  href="mailto:z_george@yahoo.com"
                  className="btn-3d btn-3d-cyan inline-flex items-center gap-2 px-3.5 py-1.5 text-white text-xs font-bold rounded-lg shadow-sm"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>z_george@yahoo.com</span>
                </a>
                <a
                  href="https://www.linkedin.com/in/georgezhangusa"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-3d btn-3d-white inline-flex items-center gap-2 px-3.5 py-1.5 text-slate-800 text-xs font-bold rounded-lg shadow-sm hover:text-blue-700"
                >
                  <Linkedin className="w-3.5 h-3.5 text-blue-600" />
                  <span>LinkedIn: georgezhangusa</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <button
            type="button"
            id="readme-footer-copy-btn"
            onClick={handleCopy}
            className="btn-3d btn-3d-white px-3 py-1.5 text-xs text-slate-700 font-semibold rounded-lg flex items-center gap-1.5"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied to Clipboard' : 'Copy README.md'}</span>
          </button>
          <button
            type="button"
            id="readme-footer-close-btn"
            onClick={onClose}
            className="btn-3d btn-3d-cyan px-4 py-1.5 text-xs text-white font-bold rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : null;
};
