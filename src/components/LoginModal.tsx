import React, { useState } from 'react';
import {
  LogIn,
  Zap,
  Lock,
  User,
  X,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  Shield,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { authService } from '../lib/authService';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { signInWithCredentials, signIn } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const adminPasswordChanged = authService.isAdminPasswordChanged();

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = signInWithCredentials(username.trim(), password);
      if (!res.success) {
        setErrorMsg(res.error || 'Invalid credentials. Please verify your username and password.');
      } else {
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication error.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSubmit = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await signIn();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to sign in with Google.');
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
      <div className="relative w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 text-slate-800 space-y-4">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-600 text-white flex items-center justify-center font-bold shadow-xs">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Sign In to Z-CHARGE CPMS</h3>
              <p className="text-[11px] text-slate-500">Multi-level user account authentication</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Informative Hint Banner */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
          {adminPasswordChanged ? (
            <div className="flex items-start gap-2 text-slate-700">
              <Shield className="w-4 h-4 text-cyan-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-900">Security Verification:</span> Default
                administrator password has been customized. Enter your username and password to log in.
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-slate-600">
              <div className="font-bold text-slate-800 flex items-center justify-between">
                <span>Default Initial Administrator:</span>
                <button
                  type="button"
                  onClick={() => {
                    setUsername('admin');
                    setPassword('password');
                  }}
                  className="text-cyan-700 underline font-mono text-[10px] cursor-pointer"
                >
                  Fill Default Credentials
                </button>
              </div>
              <div className="font-mono text-cyan-900 mt-0.5">
                Username: <code className="bg-white px-1 py-0.5 rounded border border-slate-200">admin</code> • Password: <code className="bg-white px-1 py-0.5 rounded border border-slate-200">password</code>
              </div>
            </div>
          )}
        </div>

        {/* Login Form */}
        <form onSubmit={handleCredentialsSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Username or Email
            </label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="e.g. admin or your username"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
                className="w-full pl-9 pr-10 py-2 rounded-xl border border-slate-300 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
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

          <button
            type="submit"
            disabled={loading}
            className="btn-3d btn-3d-cyan w-full py-2.5 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Sign In with Credentials</span>
              </>
            )}
          </button>
        </form>

        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-slate-200"></div>
          <span className="flex-shrink mx-2 text-[10px] text-slate-400 uppercase font-mono">OR</span>
          <div className="flex-grow border-t border-slate-200"></div>
        </div>

        <button
          type="button"
          onClick={handleGoogleSubmit}
          disabled={loading}
          className="btn-3d btn-3d-neutral w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 text-slate-700"
        >
          <span>Sign In with Google</span>
        </button>

        {/* Continue as Guest option */}
        <div className="pt-1 text-center">
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
          >
            Cancel and continue as Viewer
          </button>
        </div>
      </div>
    </div>
  );
};
