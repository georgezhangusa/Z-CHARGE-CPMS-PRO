import { PortStatus, StopReason } from './types';

export function getStatusColor(status: PortStatus): {
  bg: string;
  text: string;
  border: string;
  dot: string;
  pulse?: boolean;
} {
  switch (status) {
    case 'Available':
      return {
        bg: 'bg-emerald-50 text-emerald-700',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        dot: 'bg-emerald-500',
      };
    case 'Charging':
      return {
        bg: 'bg-cyan-50 text-cyan-700',
        text: 'text-cyan-700',
        border: 'border-cyan-300',
        dot: 'bg-cyan-500',
        pulse: true,
      };
    case 'Preparing':
    case 'Occupied':
      return {
        bg: 'bg-amber-50 text-amber-800',
        text: 'text-amber-800',
        border: 'border-amber-300',
        dot: 'bg-amber-500',
        pulse: true,
      };
    case 'SuspendedEV':
    case 'SuspendedSystem':
      return {
        bg: 'bg-indigo-50 text-indigo-700',
        text: 'text-indigo-700',
        border: 'border-indigo-200',
        dot: 'bg-indigo-500',
      };
    case 'Finishing':
      return {
        bg: 'bg-violet-50 text-violet-700',
        text: 'text-violet-700',
        border: 'border-violet-200',
        dot: 'bg-violet-500',
      };
    case 'Faulted':
      return {
        bg: 'bg-rose-50 text-rose-700',
        text: 'text-rose-700',
        border: 'border-rose-300',
        dot: 'bg-rose-600',
      };
    case 'Offline':
      return {
        bg: 'bg-slate-100 text-slate-600',
        text: 'text-slate-600',
        border: 'border-slate-300',
        dot: 'bg-slate-400',
      };
    case 'Maintenance':
      return {
        bg: 'bg-orange-50 text-orange-800',
        text: 'text-orange-800',
        border: 'border-orange-300',
        dot: 'bg-orange-500',
      };
    case 'Reserved':
      return {
        bg: 'bg-blue-50 text-blue-700',
        text: 'text-blue-700',
        border: 'border-blue-200',
        dot: 'bg-blue-500',
      };
    default:
      return {
        bg: 'bg-slate-100 text-slate-700',
        text: 'text-slate-700',
        border: 'border-slate-300',
        dot: 'bg-slate-400',
      };
  }
}

export function getStopReasonBadge(reason?: StopReason): {
  label: string;
  bg: string;
  text: string;
  border: string;
} {
  switch (reason) {
    case 'Local':
      return {
        label: 'Local (User Stopped)',
        bg: 'bg-slate-100',
        text: 'text-slate-700',
        border: 'border-slate-300',
      };
    case 'Remote':
      return {
        label: 'Remote (CPMS Command)',
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-200',
      };
    case 'EVDisconnected':
      return {
        label: 'EV Disconnected',
        bg: 'bg-amber-50',
        text: 'text-amber-800',
        border: 'border-amber-300',
      };
    case 'GroundFailure':
      return {
        label: 'Ground Failure',
        bg: 'bg-rose-50',
        text: 'text-rose-700',
        border: 'border-rose-300',
      };
    case 'EmergencyStop':
      return {
        label: 'Emergency Stop Tripped',
        bg: 'bg-red-100',
        text: 'text-red-700',
        border: 'border-red-300',
      };
    case 'Timeout':
      return {
        label: 'Timeout (No MeterValue 1m)',
        bg: 'bg-amber-50',
        text: 'text-amber-800',
        border: 'border-amber-300',
      };
    default:
      return {
        label: reason || 'Completed',
        bg: 'bg-slate-100',
        text: 'text-slate-700',
        border: 'border-slate-200',
      };
  }
}

export function formatKw(kw: number): string {
  if (kw >= 1000) {
    return `${(kw / 1000).toFixed(2)} MW`;
  }
  return `${kw.toFixed(1)} kW`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Resolves the real entry host for the active environment (Cloud Run dev/shared URL or localhost)
 */
export function getRealHost(): string {
  if (typeof window !== 'undefined' && window.location?.host) {
    return window.location.host;
  }
  return 'localhost:3000';
}

/**
 * Resolves the real protocols (WSS/WS and HTTPS/HTTP) based on browser window
 */
export function getRealProtocol(): { isHttps: boolean; wsProto: 'wss' | 'ws'; httpProto: 'https' | 'http' } {
  if (typeof window !== 'undefined' && window.location?.protocol) {
    const isHttps = window.location.protocol === 'https:';
    return {
      isHttps,
      wsProto: isHttps ? 'wss' : 'ws',
      httpProto: isHttps ? 'https' : 'http',
    };
  }
  return {
    isHttps: false,
    wsProto: 'ws',
    httpProto: 'http',
  };
}

/**
 * Format WebSocket URL for an EV charger / ChargeBox
 * Format: wss://<real-host>/ocpp/ws/<ChargeBoxID>
 * Uses the live active environment host (e.g. Cloud Run preview URL or local host).
 */
export function formatOcppWsUrl(chargeBoxId: string, existingUrl?: string): string {
  const host = getRealHost();
  const { wsProto } = getRealProtocol();
  const cleanId = (chargeBoxId || 'CHG-NEW').trim();

  // If existingUrl is already a real URL pointing to a valid custom server (excluding legacy fake placeholders)
  if (
    existingUrl &&
    (existingUrl.startsWith('wss://') || existingUrl.startsWith('ws://')) &&
    existingUrl.includes('/ocpp/ws/') &&
    !existingUrl.includes('z-charge-cpms2.ai.studio') &&
    !existingUrl.includes('cpms.zcharge.network')
  ) {
    return existingUrl;
  }

  return `${wsProto}://${host}/ocpp/ws/${cleanId}`;
}

/**
 * Format HTTPS Webhook Ingest URL for an EV charger / HTTP Bridge
 * Format: https://<real-host>/api/webhook/ocpp/<ChargeBoxID>
 */
export function formatHttpWebhookUrl(chargeBoxId: string, existingUrl?: string): string {
  const host = getRealHost();
  const { httpProto } = getRealProtocol();
  const cleanId = (chargeBoxId || 'CHG-NEW').trim();

  if (
    existingUrl &&
    (existingUrl.startsWith('https://') || existingUrl.startsWith('http://')) &&
    existingUrl.includes('/api/webhook/ocpp/') &&
    !existingUrl.includes('z-charge-cpms2.ai.studio') &&
    !existingUrl.includes('cpms.zcharge.network')
  ) {
    return existingUrl;
  }

  return `${httpProto}://${host}/api/webhook/ocpp/${cleanId}`;
}

/**
 * Display label for connector / port status according to OCPP 1.6J and 2.0.1 specifications.
 * When status is 'Preparing' (OCPP 1.6J) or 'Occupied' (OCPP 2.0.1), always display "Occupied".
 * When status is 'Charging', display "Charging".
 * When status is 'Finishing', display "Finishing".
 */
export function formatPortStatus(status?: PortStatus | string): string {
  if (!status) return 'Available';
  const s = String(status).trim().toLowerCase();
  if (s === 'preparing' || s.includes('prepar') || s === 'occupied' || s.includes('evconnect')) return 'Occupied';
  if (s.includes('charg')) return 'Charging';
  if (s.includes('finish')) return 'Finishing';
  if (s.includes('avail') || s === 'idle') return 'Available';
  if (s.includes('fault')) return 'Faulted';
  if (s.includes('unavail') || s.includes('offlin')) return 'Offline';
  if (s.includes('suspendedevse') || s.includes('suspendedsystem')) return 'SuspendedSystem';
  if (s.includes('suspended')) return 'SuspendedEV';
  if (s.includes('maint')) return 'Maintenance';
  if (s.includes('reserv')) return 'Reserved';
  return status as string;
}

