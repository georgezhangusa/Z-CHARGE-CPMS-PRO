import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  Lock,
  User,
  Mail,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Shield,
  Eye,
  EyeOff,
  Building,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { authService } from '../lib/authService';
import { CpmsUserAccount, InviteEmailRecord } from '../types';

interface FirstTimeSetupModalProps {
  inviteToken: string | null;
  onClose: () => void;
}

export const FirstTimeSetupModal: React.FC<FirstTimeSetupModalProps> = ({
  inviteToken,
  onClose,
}) => {
  const { completeInvitation } = useAuth();
  const [invitedUser, setInvitedUser] = useState<CpmsUserAccount | null>(null);
  const [inviteRecord, setInviteRecord] = useState<InviteEmailRecord | null>(null);

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!inviteToken) return;
    const users = authService.getUsers();
    const target = users.find((u) => u.inviteToken === inviteToken);
    if (target) {
      setInvitedUser(target);
      setDisplayName(target.displayName || '');
      setUsername(target.username || target.email.split('@')[0] || '');
    }

    const invites = authService.getInvites();
    const inv = invites.find((i) => i.inviteToken === inviteToken);
    if (inv) {
      setInviteRecord(inv);
    }
  }, [inviteToken]);

  if (!inviteToken) return null;

  const hasMinLength = password.length >= 8;
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const usernameValid = username.trim().length >= 3;

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'admin':
        return { label: 'Admin', color: 'bg-purple-100 text-purple-800 border-purple-300' };
      case 'site_manager':
        return { label: 'Site Manager', color: 'bg-cyan-100 text-cyan-800 border-cyan-300' };
      case 'technician':
        return { label: 'Technician', color: 'bg-amber-100 text-amber-800 border-amber-300' };
      default:
        return { label: 'Viewer', color: 'bg-slate-100 text-slate-700 border-slate-300' };
    }
  };

  const badge = getRoleBadge(invitedUser?.role);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!usernameValid) {
      setErrorMsg('Username must be at least 3 characters long.');
      return;
    }

    if (!hasMinLength) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }

    if (!passwordsMatch) {
      setErrorMsg('Passwords do not match. Please verify.');
      return;
    }

    setLoading(true);
    try {
      const res = await completeInvitation({
        inviteToken,
        chosenUsername: username.trim(),
        chosenPassword: password,
        displayName: displayName.trim(),
      });

      if (!res.success) {
        setErrorMsg(res.error || 'Failed to complete account registration.');
      } else {
        setSuccess(true);
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred.');
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
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-cyan-950 to-slate-900 px-6 py-5 text-white border-b border-cyan-800/40">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center shrink-0">
              <UserCheck className="w-6 h-6 text-cyan-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/30 text-cyan-200 text-[10px] font-mono font-bold uppercase tracking-wider">
                  1st Time Login Onboarding
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.color}`}>
                  {badge.label}
                </span>
              </div>
              <h2 className="text-lg font-black tracking-tight text-white mt-0.5">
                Set Up Your Z-CHARGE CPMS Account
              </h2>
            </div>
          </div>
          <p className="text-xs text-slate-300 mt-2">
            You were invited by the System Administrator. Create your chosen username and secure
            password to activate your multi-level CPMS access.
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Account successfully activated!</p>
                <p className="text-[11px] text-emerald-700">
                  Welcome to Z-CHARGE CPMS PRO. Logging you in now with your new credentials...
                </p>
              </div>
            </div>
          )}

          {/* Invitation Metadata Card */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs text-slate-600">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Invited Email:</span>
              <span className="font-mono font-bold text-slate-800">{invitedUser?.email || 'assignee@network.com'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Assigned User Level:</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.color}`}>
                {badge.label}
              </span>
            </div>
            {inviteRecord?.assignedSiteNames && inviteRecord.assignedSiteNames.length > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Jurisdiction Sites:</span>
                <span className="font-semibold text-slate-700 truncate max-w-[200px]">
                  {inviteRecord.assignedSiteNames.join(', ')}
                </span>
              </div>
            )}
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Your Full Name</label>
            <div className="relative">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                placeholder="e.g. Sarah Jenkins"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
          </div>

          {/* Chosen Username */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Choose Your Username
            </label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                required
                placeholder="e.g. sjenkins, tech_elena"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
              <span className="text-slate-400 font-mono text-xs absolute left-3 top-2.5">@</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              You will use this username to log in to Z-CHARGE CPMS PRO anytime.
            </p>
          </div>

          {/* Chosen Password */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Create Your Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Minimum 8 characters"
                className="w-full pl-9 pr-10 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Re-enter your password"
                className={`w-full pl-9 pr-3 py-2 rounded-xl border text-xs font-mono focus:outline-none focus:ring-2 ${
                  passwordsMatch ? 'border-emerald-400 focus:ring-emerald-500/50' : 'border-slate-300 focus:ring-cyan-500/50'
                }`}
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
            {confirmPassword.length > 0 && (
              <p className={`text-[11px] mt-1 ${passwordsMatch ? 'text-emerald-600 font-bold' : 'text-rose-600'}`}>
                {passwordsMatch ? '✓ Passwords match' : '✕ Passwords do not match'}
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="btn-3d btn-3d-neutral w-1/3 py-2.5 rounded-xl text-xs font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !usernameValid || !hasMinLength || !passwordsMatch}
              className="btn-3d btn-3d-cyan flex-1 py-2.5 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span>Activating Account...</span>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Activate Account & Sign In</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
