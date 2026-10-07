import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Mail,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  MoreVertical,
  ExternalLink,
  Copy,
  Clock,
  Sparkles,
  Trash2,
  Lock,
  RefreshCw,
  Send,
  Building,
  UserCheck,
  ChevronDown,
} from 'lucide-react';
import { CpmsUserAccount, UserLevel, Site, InviteEmailRecord } from '../types';
import { authService, INITIAL_ADMIN_ACCOUNT } from '../lib/authService';
import { useAuth } from '../lib/AuthContext';
import { InviteUserModal } from './InviteUserModal';
import { InviteEmailPreviewModal } from './InviteEmailPreviewModal';

interface AdminUsersViewProps {
  sites: Site[];
  onOpenInviteModal?: () => void;
  onRequestChangeAdminPassword?: () => void;
  onOpenAssigneeSetup?: (token: string) => void;
  onNavigateHome?: () => void;
}

export const AdminUsersView: React.FC<AdminUsersViewProps> = ({
  sites,
  onRequestChangeAdminPassword,
  onOpenAssigneeSetup,
  onNavigateHome,
}) => {
  const { currentAccount, role, userLevel, isAdmin, permissions } = useAuth();
  const [users, setUsers] = useState<CpmsUserAccount[]>(authService.getUsers());
  const [invites, setInvites] = useState<InviteEmailRecord[]>(authService.getInvites());

  const [activeTab, setActiveTab] = useState<'directory' | 'outbox' | 'rbac'>('directory');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserLevel | 'ALL' | 'INVITED'>('ALL');

  // Modals state
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [previewEmail, setPreviewEmail] = useState<InviteEmailRecord | null>(null);

  // User Actions dropdown
  const [actionMenuUserId, setActionMenuUserId] = useState<string | null>(null);
  const [editingRoleUser, setEditingRoleUser] = useState<CpmsUserAccount | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Prohibit access for non-admin level users
  if (!isAdmin) {
    return (
      <div className="p-4 sm:p-8 max-w-xl mx-auto my-12">
        <div className="bg-white border-2 border-rose-200 rounded-3xl p-8 text-center shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-bold font-mono uppercase mb-3">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Access Prohibited</span>
          </div>

          <h2 className="text-xl font-bold text-slate-900 mb-2">
            Administrator Privileges Required
          </h2>

          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            Only users with the <span className="font-bold text-purple-700">Admin</span> role can open this page. Access is strictly prohibited for Site Manager, Technician, and Viewer accounts.
          </p>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl mb-6 text-left flex items-center justify-between">
            <div>
              <div className="text-[11px] text-slate-400 font-mono uppercase font-bold">Your Active Role</div>
              <div className="text-sm font-bold text-slate-800 flex items-center gap-2 mt-1">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${permissions?.badgeColor || 'bg-slate-200 text-slate-800'}`}>
                  {permissions?.badgeLabel || 'Standard User'}
                </span>
                <span className="text-xs text-slate-400 font-mono">({userLevel})</span>
              </div>
            </div>
            <span className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg">
              Unauthorized
            </span>
          </div>

          {onNavigateHome && (
            <button
              type="button"
              onClick={onNavigateHome}
              className="btn-3d btn-3d-cyan px-5 py-2.5 rounded-xl text-white text-xs font-bold shadow-md hover:brightness-105 active:scale-95 transition-all cursor-pointer"
            >
              Return to Operations Dashboard
            </button>
          )}
        </div>
      </div>
    );
  }

  // Subscribe to real-time users
  useEffect(() => {
    const unsub = authService.subscribeUsers((updatedUsers) => {
      setUsers(updatedUsers);
      setInvites(authService.getInvites());
    });
    return () => unsub();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Stats calculation
  const totalUsers = users.length;
  const adminsCount = users.filter((u) => u.role === 'admin').length;
  const siteManagersCount = users.filter((u) => u.role === 'site_manager').length;
  const techniciansCount = users.filter((u) => u.role === 'technician').length;
  const viewersCount = users.filter((u) => u.role === 'viewer').length;
  const pendingInvitesCount = users.filter((u) => u.status === 'invited').length;

  // Filtered users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (roleFilter === 'ALL') return true;
    if (roleFilter === 'INVITED') return u.status === 'invited';
    return u.role === roleFilter;
  });

  const getRoleBadge = (r: UserLevel) => {
    switch (r) {
      case 'admin':
        return {
          label: 'Admin',
          color: 'bg-purple-100 text-purple-900 border-purple-300 font-bold',
        };
      case 'site_manager':
        return {
          label: 'Site Manager',
          color: 'bg-cyan-100 text-cyan-900 border-cyan-300 font-bold',
        };
      case 'technician':
        return {
          label: 'Technician',
          color: 'bg-amber-100 text-amber-900 border-amber-300 font-bold',
        };
      case 'viewer':
      default:
        return {
          label: 'Viewer',
          color: 'bg-slate-100 text-slate-700 border-slate-300 font-semibold',
        };
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserLevel) => {
    if (!isAdmin) {
      showToast('Permission Denied: Only Admin can change user level.');
      setEditingRoleUser(null);
      return;
    }
    try {
      await authService.updateUserRole(userId, newRole);
      setEditingRoleUser(null);
      showToast(`User level successfully updated to ${newRole.toUpperCase()}`);
    } catch (err: any) {
      showToast(err.message || 'Failed to update user level');
    }
  };

  const handleResetPassword = async (userId: string) => {
    try {
      const tempPass = await authService.resetUserPasswordByAdmin(userId);
      showToast(`Temporary password generated: ${tempPass} (Must change on next login)`);
      setActionMenuUserId(null);
    } catch (err: any) {
      showToast(err.message || 'Failed to reset password');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (confirm('Are you sure you want to delete this user account?')) {
      try {
        await authService.deleteUser(userId);
        showToast('User account successfully removed.');
        setActionMenuUserId(null);
      } catch (err: any) {
        showToast(err.message || 'Cannot delete account');
      }
    }
  };

  const handleToggleSuspend = async (userId: string) => {
    try {
      const isSuspended = await authService.toggleUserSuspension(userId);
      showToast(isSuspended ? 'Account suspended.' : 'Account reactivated.');
      setActionMenuUserId(null);
    } catch (err: any) {
      showToast(err.message || 'Failed to toggle status');
    }
  };

  const handleResendInvite = (user: CpmsUserAccount) => {
    if (!user.inviteToken) {
      showToast('No active invitation token found for user.');
      return;
    }
    const inv = invites.find((i) => i.inviteToken === user.inviteToken);
    if (inv) {
      setPreviewEmail(inv);
    } else {
      const newInv: InviteEmailRecord = {
        id: `email-${Date.now()}`,
        recipientEmail: user.email,
        recipientName: user.displayName,
        role: user.role,
        inviteToken: user.inviteToken,
        inviteUrl: `${window.location.origin}?invite=${user.inviteToken}`,
        sentAt: new Date().toISOString(),
        status: 'delivered',
        assignedSiteNames: ['All Assigned Sites'],
        expiresAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      };
      setPreviewEmail(newInv);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-cyan-500/40 flex items-center gap-2.5 text-xs font-mono animate-in fade-in slide-in-from-bottom-2 duration-150">
          <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-50 via-white to-purple-50/80 rounded-2xl p-6 text-slate-800 border border-purple-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full bg-purple-100 border border-purple-300 text-purple-900 text-xs font-mono font-bold tracking-wider uppercase">
              Admin Console
            </span>
            <span className="px-2 py-0.5 rounded-full bg-cyan-100 border border-cyan-300 text-cyan-900 font-mono text-[10px] font-bold">
              Multi-Level RBAC v3.0.0
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 mt-1.5 flex items-center gap-2">
            <Users className="w-6 h-6 text-purple-600" />
            <span>Multi-Level User Account Management</span>
          </h1>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
            Configure system access across 4 operational levels: <strong className="text-slate-900">Admin</strong>, <strong className="text-slate-900">Site Manager</strong>, <strong className="text-slate-900">Technician</strong>, and <strong className="text-slate-900">Viewer</strong>. Dispatch 1st-time login invitation emails where assignees create their own chosen username and password.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {/* Change Admin Password */}
          {onRequestChangeAdminPassword && (
            <button
              type="button"
              onClick={onRequestChangeAdminPassword}
              className="btn-3d btn-3d-white flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-800"
              title="Force/update administrator password"
            >
              <KeyRound className="w-3.5 h-3.5 text-purple-700" />
              <span>Change Admin Password</span>
            </button>
          )}

          {/* Invite User Button */}
          <button
            type="button"
            onClick={() => setIsInviteOpen(true)}
            className="btn-3d btn-3d-cyan flex items-center gap-2 px-4 py-2 rounded-xl text-white text-xs font-bold shadow-md hover:brightness-105 active:scale-95 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Invite Assignee (Send Email)</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
          <div className="text-[10px] uppercase font-mono font-bold text-slate-400">Total Users</div>
          <div className="text-xl font-extrabold text-slate-900 mt-0.5">{totalUsers}</div>
          <div className="text-[10px] text-slate-500 mt-0.5 font-medium">Provisioned in CPMS</div>
        </div>

        <div className="bg-white border border-purple-200 rounded-xl p-3 shadow-xs">
          <div className="text-[10px] uppercase font-mono font-bold text-purple-700 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-purple-600" />
            <span>Admins</span>
          </div>
          <div className="text-xl font-extrabold text-purple-900 mt-0.5">{adminsCount}</div>
          <div className="text-[10px] text-purple-700 mt-0.5">Root access</div>
        </div>

        <div className="bg-white border border-cyan-200 rounded-xl p-3 shadow-xs">
          <div className="text-[10px] uppercase font-mono font-bold text-cyan-700 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-cyan-600" />
            <span>Site Managers</span>
          </div>
          <div className="text-xl font-extrabold text-cyan-900 mt-0.5">{siteManagersCount}</div>
          <div className="text-[10px] text-cyan-700 mt-0.5">Hub & tariff leads</div>
        </div>

        <div className="bg-white border border-amber-200 rounded-xl p-3 shadow-xs">
          <div className="text-[10px] uppercase font-mono font-bold text-amber-700 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-600" />
            <span>Technicians</span>
          </div>
          <div className="text-xl font-extrabold text-amber-900 mt-0.5">{techniciansCount}</div>
          <div className="text-[10px] text-amber-700 mt-0.5">Field diagnostics</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
          <div className="text-[10px] uppercase font-mono font-bold text-slate-600 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-slate-500" />
            <span>Viewers</span>
          </div>
          <div className="text-xl font-extrabold text-slate-900 mt-0.5">{viewersCount}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Read-only audit</div>
        </div>

        <div className="bg-white border border-rose-200 rounded-xl p-3 shadow-xs">
          <div className="text-[10px] uppercase font-mono font-bold text-rose-700 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
            <span>Pending Invites</span>
          </div>
          <div className="text-xl font-extrabold text-rose-900 mt-0.5">{pendingInvitesCount}</div>
          <div className="text-[10px] text-rose-700 mt-0.5">Awaiting 1st login</div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="border-b border-slate-200 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('directory')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'directory'
              ? 'border-purple-600 text-purple-900 bg-purple-50/50 rounded-t-lg'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>User Directory ({users.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('outbox')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'outbox'
              ? 'border-purple-600 text-purple-900 bg-purple-50/50 rounded-t-lg'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>Invitation Outbox ({invites.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('rbac')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'rbac'
              ? 'border-purple-600 text-purple-900 bg-purple-50/50 rounded-t-lg'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>RBAC Authority Matrix</span>
        </button>
      </div>

      {/* Tab 1: User Directory */}
      {activeTab === 'directory' && (
        <div className="space-y-4">
          {/* Search & Role Filters Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, username, or email..."
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto no-scrollbar">
              {(
                [
                  { id: 'ALL', label: 'All Roles' },
                  { id: 'admin', label: 'Admins' },
                  { id: 'site_manager', label: 'Site Managers' },
                  { id: 'technician', label: 'Technicians' },
                  { id: 'viewer', label: 'Viewers' },
                  { id: 'INVITED', label: 'Pending 1st Login' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setRoleFilter(f.id)}
                  className={`btn-3d px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                    roleFilter === f.id
                      ? 'bg-purple-900 text-white border-purple-950'
                      : 'btn-3d-neutral text-slate-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase tracking-wider">
                    <th className="py-3 px-4">User / Identity</th>
                    <th className="py-3 px-4">Email Address</th>
                    <th className="py-3 px-4">Role Authority</th>
                    <th className="py-3 px-4">Jurisdiction (Sites)</th>
                    <th className="py-3 px-4">1st Login & Password</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No user accounts match the current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => {
                      const isRootAdmin = user.username.toLowerCase() === 'admin';
                      const badge = getRoleBadge(user.role);
                      const isCurrentLoggedIn = currentAccount?.id === user.id;

                      return (
                        <tr
                          key={user.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isCurrentLoggedIn ? 'bg-purple-50/30' : ''
                          }`}
                        >
                          {/* User Column */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase shadow-xs shrink-0 ${
                                  user.role === 'admin'
                                    ? 'bg-purple-700 text-white'
                                    : user.role === 'site_manager'
                                    ? 'bg-cyan-700 text-white'
                                    : user.role === 'technician'
                                    ? 'bg-amber-600 text-white'
                                    : 'bg-slate-600 text-white'
                                }`}
                              >
                                {user.displayName ? user.displayName[0] : user.username[0]}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                  <span className="truncate">{user.displayName}</span>
                                  {isCurrentLoggedIn && (
                                    <span className="px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 text-[9px] font-bold">
                                      YOU
                                    </span>
                                  )}
                                  {isRootAdmin && (
                                    <span className="px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 text-[9px] font-bold">
                                      PRIMARY ROOT
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] font-mono text-slate-500">
                                  @{user.username}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Email Column */}
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                            {user.email}
                          </td>

                          {/* Role Column */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] border ${badge.color}`}>
                                {badge.label}
                              </span>
                              {!isRootAdmin && isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => setEditingRoleUser(user)}
                                  className="text-[10px] text-purple-700 hover:underline font-semibold cursor-pointer"
                                  title="Change user level (Admin only)"
                                >
                                  Edit
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Sites Column */}
                          <td className="py-3 px-4 text-[11px] text-slate-600">
                            {user.assignedSiteIds && user.assignedSiteIds.length > 0 ? (
                              <span className="font-medium">
                                {user.assignedSiteIds.length} site(s)
                              </span>
                            ) : (
                              <span className="text-slate-400">All Network Sites</span>
                            )}
                          </td>

                          {/* Password & 1st Login State */}
                          <td className="py-3 px-4">
                            {user.mustChangePassword ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold border border-rose-200">
                                <KeyRound className="w-3 h-3 text-rose-600" />
                                <span>Change on 1st Login</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Custom Password Set</span>
                              </span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4">
                            {user.status === 'invited' ? (
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold">
                                Invited (Pending)
                              </span>
                            ) : user.status === 'suspended' ? (
                              <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-bold">
                                Suspended
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold">
                                Active
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {user.status === 'invited' && (
                                <button
                                  type="button"
                                  onClick={() => handleResendInvite(user)}
                                  className="btn-3d btn-3d-cyan px-2.5 py-1 rounded-lg text-[11px] font-bold"
                                  title="View invitation email"
                                >
                                  <Mail className="w-3 h-3 mr-1 inline" />
                                  <span>View Invite</span>
                                </button>
                              )}

                              {/* Action Menu Dropdown */}
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActionMenuUserId(actionMenuUserId === user.id ? null : user.id)
                                  }
                                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </button>

                                {actionMenuUserId === user.id && (
                                  <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-xl py-1 z-30 text-left text-xs">
                                    {isAdmin && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingRoleUser(user);
                                          setActionMenuUserId(null);
                                        }}
                                        className="w-full px-3 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center gap-2 cursor-pointer"
                                      >
                                        <Shield className="w-3.5 h-3.5 text-purple-600" />
                                        <span>Change User Level</span>
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => handleResetPassword(user.id)}
                                      className="w-full px-3 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center gap-2 cursor-pointer"
                                    >
                                      <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                                      <span>Reset Password</span>
                                    </button>

                                    {!isRootAdmin && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => handleToggleSuspend(user.id)}
                                          className="w-full px-3 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center gap-2 cursor-pointer"
                                        >
                                          <Lock className="w-3.5 h-3.5 text-slate-600" />
                                          <span>
                                            {user.status === 'suspended' ? 'Reactivate' : 'Suspend Account'}
                                          </span>
                                        </button>

                                        <div className="border-t border-slate-100 my-1" />

                                        <button
                                          type="button"
                                          onClick={() => handleDeleteUser(user.id)}
                                          className="w-full px-3 py-1.5 hover:bg-rose-50 text-rose-600 flex items-center gap-2 cursor-pointer"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                          <span>Delete Account</span>
                                        </button>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Invitation Outbox */}
      {activeTab === 'outbox' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
            <div>
              <h3 className="text-xs font-bold text-slate-900">
                Dispatched Invitation Emails (Simulated SMTP Outbox)
              </h3>
              <p className="text-[11px] text-slate-500">
                All 1st-time login invitation emails sent to assignees with secure onboarding tokens.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsInviteOpen(true)}
              className="btn-3d btn-3d-cyan flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-bold"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send New Invitation</span>
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase tracking-wider">
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4">Assigned Level</th>
                  <th className="py-3 px-4">Token Code</th>
                  <th className="py-3 px-4">Sent At</th>
                  <th className="py-3 px-4">Delivery Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {invites.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No invitations dispatched yet. Click "Invite Assignee" to send one.
                    </td>
                  </tr>
                ) : (
                  invites.map((inv) => {
                    const badge = getRoleBadge(inv.role);
                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{inv.recipientName}</div>
                          <div className="text-[11px] font-mono text-cyan-800">{inv.recipientEmail}</div>
                        </td>

                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] border ${badge.color}`}>
                            {badge.label}
                          </span>
                        </td>

                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                          {inv.inviteToken.slice(0, 16)}...
                        </td>

                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {new Date(inv.sentAt).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>

                        <td className="py-3 px-4">
                          {inv.status === 'accepted' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Accepted & Activated</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800 text-[10px] font-bold border border-cyan-300">
                              <Mail className="w-3 h-3 text-cyan-600" />
                              <span>Delivered (250 OK)</span>
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setPreviewEmail(inv)}
                              className="btn-3d btn-3d-neutral px-2.5 py-1 rounded-lg text-[11px] font-bold"
                            >
                              <span>Preview Email</span>
                            </button>

                            {onOpenAssigneeSetup && (
                              <button
                                type="button"
                                onClick={() => onOpenAssigneeSetup(inv.inviteToken)}
                                className="btn-3d btn-3d-cyan px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1"
                              >
                                <span>Simulate Onboarding</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: RBAC Authority Matrix */}
      {activeTab === 'rbac' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-purple-600" />
              <span>Multi-Level Role Authority Matrix (RBAC)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Deterministic operational security matrix enforced across Z-CHARGE CPMS operations.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-mono text-[10px] uppercase">
                  <th className="py-3 px-4">Feature / Capability</th>
                  <th className="py-3 px-4 text-center font-bold text-purple-900">Admin</th>
                  <th className="py-3 px-4 text-center font-bold text-cyan-900">Site Manager</th>
                  <th className="py-3 px-4 text-center font-bold text-amber-900">Technician</th>
                  <th className="py-3 px-4 text-center font-bold text-slate-700">Viewer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {[
                  {
                    name: 'Multi-Level User Administration & Password Resets',
                    admin: true,
                    manager: false,
                    tech: false,
                    viewer: false,
                  },
                  {
                    name: 'OCPI Roaming Network Handshake & Partners Config',
                    admin: true,
                    manager: true,
                    tech: false,
                    viewer: false,
                  },
                  {
                    name: 'Tariffs, TOU Periods & Revenue Settlement',
                    admin: true,
                    manager: true,
                    tech: false,
                    viewer: false,
                  },
                  {
                    name: 'Hardware Commissioning & Site Registration',
                    admin: true,
                    manager: true,
                    tech: true,
                    viewer: false,
                  },
                  {
                    name: 'Remote Soft Resets & Cable Unlock Diagnostics',
                    admin: true,
                    manager: true,
                    tech: true,
                    viewer: false,
                  },
                  {
                    name: 'High-Voltage Safety Emergency Stops & Trips',
                    admin: true,
                    manager: true,
                    tech: false,
                    viewer: false,
                  },
                  {
                    name: 'Permanent Hardware Decommissioning / Deletion',
                    admin: true,
                    manager: true,
                    tech: false,
                    viewer: false,
                  },
                  {
                    name: 'Real-Time Telemetry & Active Sessions Audit',
                    admin: true,
                    manager: true,
                    tech: true,
                    viewer: true,
                  },
                ].map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-4 font-semibold text-slate-800">{row.name}</td>
                    <td className="py-2.5 px-4 text-center">
                      {row.admin ? (
                        <span className="text-emerald-600 font-bold text-sm">✓</span>
                      ) : (
                        <span className="text-slate-300 font-bold text-sm">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      {row.manager ? (
                        <span className="text-emerald-600 font-bold text-sm">✓</span>
                      ) : (
                        <span className="text-slate-300 font-bold text-sm">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      {row.tech ? (
                        <span className="text-emerald-600 font-bold text-sm">✓</span>
                      ) : (
                        <span className="text-slate-300 font-bold text-sm">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      {row.viewer ? (
                        <span className="text-emerald-600 font-bold text-sm">✓</span>
                      ) : (
                        <span className="text-slate-300 font-bold text-sm">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {editingRoleUser && isAdmin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in"
          role="dialog"
        >
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-slate-800 space-y-4">
            <div className="flex items-center gap-2.5">
              <Shield className="w-5 h-5 text-purple-600" />
              <h3 className="text-sm font-bold">
                Assign User Level for {editingRoleUser.displayName}
              </h3>
            </div>

            <p className="text-xs text-slate-500">
              Select the new role authority level for <strong className="text-slate-800">{editingRoleUser.email}</strong>:
            </p>

            <div className="space-y-2">
              {(
                [
                  { id: 'admin', label: 'Admin', desc: 'Full root authority & user management' },
                  { id: 'site_manager', label: 'Site Manager', desc: 'Hub management & tariff setup' },
                  { id: 'technician', label: 'Technician', desc: 'Hardware diagnostics & soft resets' },
                  { id: 'viewer', label: 'Viewer', desc: 'Read-only telemetry & session audit' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleRoleChange(editingRoleUser.id, opt.id)}
                  className={`w-full text-left p-3 rounded-xl border text-xs transition-all cursor-pointer ${
                    editingRoleUser.role === opt.id
                      ? 'border-purple-500 bg-purple-50/70 font-bold'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-slate-900">{opt.label}</span>
                    <span className="text-[10px] font-mono text-slate-400">{opt.id.toUpperCase()}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setEditingRoleUser(null)}
                className="btn-3d btn-3d-neutral px-4 py-2 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite User Modal */}
      <InviteUserModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        sites={sites}
        onInvitationSent={(record) => {
          setPreviewEmail(record);
          setInvites(authService.getInvites());
        }}
      />

      {/* Invite Email Preview Modal */}
      <InviteEmailPreviewModal
        emailRecord={previewEmail}
        isOpen={!!previewEmail}
        onClose={() => setPreviewEmail(null)}
        onSimulateClickLink={(token) => {
          if (onOpenAssigneeSetup) {
            onOpenAssigneeSetup(token);
          }
        }}
      />
    </div>
  );
};
