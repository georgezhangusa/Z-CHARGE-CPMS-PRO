import React from 'react';
import {
  LayoutDashboard,
  Zap,
  Activity,
  MapPin,
  DollarSign,
  Settings,
  ShieldAlert,
  Network,
  Users,
  Lock,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

export type NavTab =
  | 'home'
  | 'chargers'
  | 'sessions'
  | 'sites'
  | 'pricing'
  | 'roaming'
  | 'admin'
  | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  chargersCount: number;
  activeSessionsCount: number;
  criticalAlertsCount: number;
  sitesCount?: number;
  roamingPartnersCount?: number;
  pendingInvitesCount?: number;
  isOcppServerActive?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  chargersCount,
  activeSessionsCount,
  criticalAlertsCount,
  sitesCount = 0,
  roamingPartnersCount = 5,
  pendingInvitesCount = 0,
  isOcppServerActive = true,
}) => {
  const { userLevel, permissions, isAdmin } = useAuth();
  const [prohibitedNotice, setProhibitedNotice] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (prohibitedNotice) {
      const timer = setTimeout(() => setProhibitedNotice(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [prohibitedNotice]);

  const navItems: {
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string | number;
    badgeColor?: string;
  }[] = [
    {
      id: 'home',
      label: 'Operations ',
      icon: LayoutDashboard,
      badge: criticalAlertsCount > 0 ? `${criticalAlertsCount}!` : undefined,
      badgeColor: 'bg-rose-100 text-rose-700 border border-rose-200',
    },
    {
      id: 'sessions',
      label: 'Sessions ',
      icon: Activity,
      badge: activeSessionsCount,
      badgeColor: 'bg-cyan-100 text-cyan-800 border border-cyan-200',
    },
    {
      id: 'chargers',
      label: 'Chargers ',
      icon: Zap,
      badge: chargersCount,
      badgeColor: 'bg-cyan-100 text-cyan-800 border border-cyan-300 font-bold',
    },
    {
      id: 'sites',
      label: 'Charging Sites ',
      icon: MapPin,
      badge: sitesCount,
      badgeColor: 'bg-slate-100 text-slate-600 border border-slate-200',
    },
    {
      id: 'pricing',
      label: 'Tariff ',
      icon: DollarSign,
    },
    {
      id: 'roaming',
      label: 'Roaming ',
      icon: Network,
      badgeColor: 'bg-indigo-100 text-indigo-900 border border-indigo-300 font-bold',
    },
    {
      id: 'admin',
      label: 'User Account ',
      icon: isAdmin ? Users : Lock,
      badge: !isAdmin ? 'Not Admin' : pendingInvitesCount > 0 ? `${pendingInvitesCount} new` : undefined,
      badgeColor: !isAdmin
        ? 'bg-rose-100 text-rose-800 border border-rose-300 font-bold'
        : 'bg-purple-100 text-purple-900 border border-purple-300 font-bold',
    },
    {
      id: 'settings',
      label: 'OCPP Gateway ',
      icon: Settings,
      badgeColor: 'bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold',
    },
  ];

  return (
    <aside className="w-full md:w-48 shrink-0 border-r border-slate-200 bg-white p-2 md:p-2.5 space-y-1">
      <div className="px-2 py-1.5 text-[10px] font-mono uppercase tracking-widest text-slate-400 font-bold hidden md:block">
        Management
      </div>
      <nav className="flex md:flex-col gap-1 overflow-x-auto no-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          const isRestricted = item.id === 'admin' && !isAdmin;

          return (
            <button
              key={item.id}
              type="button"
              id={`nav-item-${item.id}`}
              aria-disabled={isRestricted}
              title={
                isRestricted
                  ? `Access Prohibited: Only Admin can open this page. Prohibited for ${permissions?.badgeLabel || 'other level'} accounts.`
                  : item.id === 'chargers'
                  ? `Total chargers from all sites (${chargersCount})`
                  : undefined
              }
              onClick={(e) => {
                if (isRestricted) {
                  e.preventDefault();
                  setProhibitedNotice(
                    `Access Prohibited: Only Admin can open User Account Management. Access is strictly prohibited for ${permissions?.badgeLabel || 'other level'} users.`
                  );
                  return;
                }
                onTabChange(item.id);
              }}
              className={`btn-3d w-full flex items-center !justify-between gap-2 px-2.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 text-left ${
                isRestricted
                  ? 'bg-rose-50/60 hover:bg-rose-100/70 text-rose-700/80 border border-rose-200 cursor-not-allowed shadow-none'
                  : isActive
                  ? 'bg-cyan-50 text-cyan-950 border border-cyan-300 border-b-[3px] border-b-cyan-600 shadow-xs'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 border-b-[3px] border-b-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 text-left mr-auto min-w-0">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isRestricted ? 'text-rose-500' : isActive ? 'text-cyan-700' : 'text-slate-500'
                  }`}
                />
                <span className="text-left truncate">{item.label}</span>
              </div>

              {item.badge !== undefined && (
                <span
                  className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono shadow-xs shrink-0 transition-colors ${
                    item.id === 'chargers'
                      ? isActive
                        ? 'bg-cyan-600 text-white border border-cyan-700 font-extrabold'
                        : 'bg-cyan-100 text-cyan-900 border border-cyan-300 font-bold'
                      : item.badgeColor || 'bg-slate-100 text-slate-600 font-bold'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Prohibited Alert Toast if other level user attempts to open */}
      {prohibitedNotice && (
        <div className="fixed bottom-5 left-5 z-50 bg-slate-900 text-white p-3.5 rounded-2xl shadow-2xl border-2 border-rose-500 max-w-sm flex items-start gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/40 mt-0.5">
            <Lock className="w-4 h-4" />
          </div>
          <div className="text-xs flex-1">
            <div className="font-bold text-white flex items-center gap-1.5 mb-1">
              <span className="inline-block w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
              Access Prohibited
            </div>
            <div className="text-slate-300 leading-relaxed text-[11px]">{prohibitedNotice}</div>
          </div>
          <button
            type="button"
            onClick={() => setProhibitedNotice(null)}
            className="text-slate-400 hover:text-white text-base leading-none p-1 cursor-pointer"
          >
            ×
          </button>
        </div>
      )}
    </aside>
  );
};
