import React, { useState } from 'react';
import {
  LogIn,
  LogOut,
  Shield,
  ShieldAlert,
  ChevronDown,
  Lock,
  Sparkles,
  Zap,
  Check,
  KeyRound,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { UserRole, ROLE_PERMISSIONS } from '../lib/firebase';

interface UserAuthWidgetProps {
  onRequestChangePassword?: () => void;
}

export const UserAuthWidget: React.FC<UserAuthWidgetProps> = ({
  onRequestChangePassword,
}) => {
  const {
    currentUser,
    currentAccount,
    userProfile,
    role,
    userLevel,
    isAdmin,
    permissions,
    signOut,
    switchRoleForDemo,
    openRegularLogin,
  } = useAuth();

  const [dropdownOpen, setDropdownOpen] = useState(false);

  const displayName =
    currentAccount?.displayName ||
    currentUser?.displayName ||
    userProfile?.displayName ||
    'System Administrator';

  const usernameTag =
    currentAccount?.username ||
    currentUser?.email?.split('@')[0] ||
    'admin';

  const handleRoleChange = async (newRole: UserRole) => {
    if (!isAdmin) {
      alert('Access Denied: Only Admin can change user level.');
      return;
    }
    try {
      await switchRoleForDemo(newRole);
      setDropdownOpen(false);
    } catch (err: any) {
      console.error('Failed to change role:', err);
      alert(err.message || 'Failed to change role');
    }
  };

  const roleList: { role: UserRole; label: string; desc: string }[] = [
    { role: 'admin', label: 'Admin', desc: 'Full root authority, user provisioning, roaming, and tariffs' },
    { role: 'site_manager', label: 'Site Manager', desc: 'Manages assigned hubs, tariffs, and hardware commissioning' },
    { role: 'technician', label: 'Technician', desc: 'Hardware diagnostics, ground isolation, and soft resets' },
    { role: 'viewer', label: 'Viewer', desc: 'Read-only telemetry and session monitoring' },
  ];

  return (
    <div className="relative">
      {currentAccount || currentUser ? (
        <div className="flex items-center gap-2">
          {/* User Profile Pill with Role Badge */}
          <button
            type="button"
            id="user-auth-profile-btn"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-xl bg-slate-800 border border-slate-700 hover:border-cyan-500/50 text-slate-200 transition-all text-xs cursor-pointer shadow-xs"
          >
            <div className="w-6 h-6 rounded-full bg-purple-700 text-white font-bold text-[10px] flex items-center justify-center border border-purple-400">
              {(displayName[0] || 'A').toUpperCase()}
            </div>

            <div className="text-left hidden sm:block">
              <div className="text-[11px] font-bold text-white leading-tight max-w-[110px] truncate">
                {displayName}
              </div>
              <div className="text-[10px] text-cyan-400 font-mono flex items-center gap-1">
                <span>@{usernameTag}</span>
                <span className="text-slate-500">•</span>
                <span className="font-bold text-purple-300">{permissions.badgeLabel}</span>
              </div>
            </div>

            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* Sign Out Button */}
          <button
            type="button"
            id="user-signout-btn"
            onClick={() => signOut()}
            title="Sign out or switch user"
            className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      ) : (
        /* Sign In Button */
        <button
          type="button"
          id="user-signin-btn"
          onClick={openRegularLogin}
          className="btn-3d btn-3d-cyan flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-bold shadow-xs hover:brightness-105 active:scale-95 transition-all cursor-pointer"
        >
          <LogIn className="w-3.5 h-3.5" />
          <span>Sign In / Switch User</span>
        </button>
      )}

      {/* Role Switcher & Access Control Dropdown */}
      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-2xl p-3 z-50 text-slate-800 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="border-b border-slate-100 pb-2.5 mb-2.5">
            <div className="text-xs font-bold text-slate-900 truncate">
              {displayName}
            </div>
            <div className="text-[11px] text-slate-500 font-mono truncate">
              @{usernameTag} • {currentAccount?.email || currentUser?.email || 'admin@zcharge-cpms.com'}
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${permissions.badgeColor}`}>
                {permissions.badgeLabel}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Multi-Level RBAC</span>
            </div>
          </div>

          {isAdmin ? (
            /* Admin Only: Switch Access Level for testing & role delegation */
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="text-[10px] uppercase font-mono font-bold text-purple-700 tracking-wider flex items-center gap-1">
                  <Shield className="w-3 h-3 text-purple-600" />
                  <span>Switch Access Level (Admin)</span>
                </div>
                <span className="text-[9px] font-mono font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                  Admin Only
                </span>
              </div>

              {roleList.map((item) => {
                const isCurrent =
                  userLevel === item.role ||
                  (item.role === 'admin' && (userLevel === 'admin' || role === 'superadmin')) ||
                  (item.role === 'site_manager' && (userLevel === 'site_manager' || role === 'operator'));

                return (
                  <button
                    key={item.role}
                    type="button"
                    onClick={() => handleRoleChange(item.role)}
                    className={`w-full text-left p-2 rounded-lg text-xs transition-all flex items-start justify-between cursor-pointer ${
                      isCurrent
                        ? 'bg-purple-50 border border-purple-200 text-purple-900 font-bold'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span>{item.label}</span>
                        {isCurrent && <Check className="w-3.5 h-3.5 text-purple-600" />}
                      </div>
                      <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                        {item.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            /* Non-Admin Users: Read-only access level lock */
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Assigned User Level</span>
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${permissions.badgeColor}`}>
                  {permissions.badgeLabel}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                {permissions.description}
              </p>
              <div className="pt-2 border-t border-slate-200 flex items-center gap-1.5 text-[10px] text-rose-700 font-semibold">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>Locked: Only Admin can change user level</span>
              </div>
            </div>
          )}

          {/* Quick Actions in Dropdown */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1.5">
            {onRequestChangePassword && (
              <button
                type="button"
                onClick={() => {
                  setDropdownOpen(false);
                  onRequestChangePassword();
                }}
                className="w-full py-1.5 px-2 rounded-lg hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-2 cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5 text-purple-600" />
                <span>Change Password</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setDropdownOpen(false);
                openRegularLogin();
              }}
              className="w-full py-1.5 px-2 rounded-lg hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-2 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5 text-cyan-600" />
              <span>Switch User Account</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
