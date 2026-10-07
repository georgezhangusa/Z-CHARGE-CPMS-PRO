import React, { useState } from 'react';
import {
  ShieldAlert,
  Lock,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

interface ForceChangePasswordModalProps {
  isOpen: boolean;
}

export const ForceChangePasswordModal: React.FC<ForceChangePasswordModalProps> = ({ isOpen }) => {
  const { currentAccount, changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('password');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Password strength calculation
  const hasMinLength = newPassword.length >= 8;
  const hasLetters = /[a-zA-Z]/.test(newPassword);
  const hasNumbers = /[0-9]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!hasMinLength) {
      setErrorMsg('New password must be at least 8 characters long.');
      return;
    }

    if (!hasLetters || !hasNumbers) {
      setErrorMsg('Password must include both letters and numbers for high security.');
      return;
    }

    if (newPassword === 'password') {
      setErrorMsg('New password cannot be the default "password". Please choose a secure custom password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter confirmation password.');
      return;
    }

    setLoading(true);
    try {
      const res = await changePassword(currentPassword, newPassword);
      if (!res.success) {
        setErrorMsg(res.error || 'Failed to update password. Please check your current password.');
      } else {
        setSuccessMsg('Admin credentials successfully updated! First-time security policy satisfied.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred while updating password.');
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
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-cyan-200 overflow-hidden text-slate-800">
        {/* Banner with Security Alert styling */}
        <div className="bg-[#0891b2] px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-mono font-black tracking-widest uppercase">
                  Mandatory Security Step
                </span>
                <span className="text-[11px] text-cyan-100 font-mono">1st Time Login</span>
              </div>
              <h2 className="text-lg font-black tracking-tight text-white mt-0.5">
                Change Default Administrator Password
              </h2>
            </div>
          </div>
          <p className="text-xs text-cyan-100 mt-2 leading-relaxed">
            Welcome to <span className="font-bold text-white">Z-CHARGE CPMS PRO</span>. As the primary
            root administrator logged in with initial credentials (
            <code className="bg-black/20 px-1 py-0.5 rounded font-mono text-white">admin / password</code>
            ), you are required to set a permanent, secure password before accessing system management.
          </p>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 space-y-1">
            <div className="font-semibold text-slate-800 flex items-center justify-between">
              <span>Account Username:</span>
              <span className="font-mono font-bold text-cyan-800 bg-cyan-100 px-2 py-0.5 rounded">
                {currentAccount?.username || 'admin'}
              </span>
            </div>
            <div className="text-[11px] text-slate-500">
              Role Authority: <span className="font-bold text-slate-700">Root System Administrator</span>
            </div>
          </div>

          {/* Current Password Field */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Current Default Password
            </label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full pl-9 pr-10 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                placeholder="Initial password (password)"
              />
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New Password Field */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              New Permanent Password
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="w-full pl-9 pr-10 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                placeholder="At least 8 characters with letters & numbers"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Password Validation Checklist */}
            <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px]">
              <div
                className={`flex items-center gap-1.5 ${
                  hasMinLength ? 'text-emerald-700 font-semibold' : 'text-slate-400'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Min 8 characters</span>
              </div>
              <div
                className={`flex items-center gap-1.5 ${
                  hasLetters && hasNumbers ? 'text-emerald-700 font-semibold' : 'text-slate-400'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Letters & Numbers</span>
              </div>
            </div>
          </div>

          {/* Confirm Password Field */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className={`w-full pl-9 pr-3 py-2 rounded-xl border text-xs font-mono focus:outline-none focus:ring-2 ${
                  passwordsMatch
                    ? 'border-emerald-400 focus:ring-emerald-500/50'
                    : 'border-slate-300 focus:ring-cyan-500/50'
                }`}
                placeholder="Re-enter your new password"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
            {confirmPassword.length > 0 && (
              <p
                className={`text-[11px] mt-1 ${
                  passwordsMatch ? 'text-emerald-600 font-bold' : 'text-rose-600'
                }`}
              >
                {passwordsMatch ? '✓ Passwords match' : '✕ Passwords do not match'}
              </p>
            )}
          </div>

          {/* Footer Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || !hasMinLength || !passwordsMatch}
              className="btn-3d btn-3d-cyan w-full py-2.5 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span>Updating Password & Securing System...</span>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Update Password & Unlock CPMS Operations</span>
                </>
              )}
            </button>
            <p className="text-[10px] text-center text-slate-400 mt-2">
              Note: This action satisfies the required first-time security policy for the default admin.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};
