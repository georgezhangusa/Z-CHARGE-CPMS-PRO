import { ChargingStation, Connector, PortStatus, StopReason } from './types';

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
 * Format WebSocket URL for an EV charger / ChargeBox according to OCPP version
 * Format:
 *   - OCPP 1.6: wss://<real-host>/ocpp/1.6/<ChargeBoxID>
 *   - OCPP 2.0.1: wss://<real-host>/ocpp/2.0.1/<ChargeBoxID>
 * Uses the live active environment host (e.g. Cloud Run preview URL or local host).
 */
export function formatOcppWsUrl(
  chargeBoxId: string,
  param2?: string,
  param3?: string
): string {
  const host = getRealHost();
  const { wsProto } = getRealProtocol();
  const cleanId = (chargeBoxId || 'CHG-NEW').trim();

  let existingUrl: string | undefined;
  let ocppVer: string | undefined;

  // Determine whether param2 is an existingUrl or an ocppVersion string
  if (param2) {
    if (
      param2.startsWith('ws://') ||
      param2.startsWith('wss://') ||
      param2.startsWith('http://') ||
      param2.startsWith('https://')
    ) {
      existingUrl = param2;
      ocppVer = param3;
    } else {
      ocppVer = param2;
    }
  }

  const verSlug = ocppVer?.includes('2.0') ? '2.0.1' : '1.6';

  // If existingUrl is already a real custom URL pointing to a valid custom server (excluding legacy fake placeholders)
  if (
    existingUrl &&
    (existingUrl.startsWith('wss://') || existingUrl.startsWith('ws://')) &&
    (existingUrl.includes('/ocpp/1.6/') ||
      existingUrl.includes('/ocpp/2.0.1/') ||
      existingUrl.includes('/ocpp/ws/')) &&
    !existingUrl.includes('z-charge-cpms2.ai.studio') &&
    !existingUrl.includes('cpms.zcharge.network')
  ) {
    if (ocppVer) {
      return existingUrl.replace(/\/ocpp\/(1\.6|2\.0\.1|ws)\//, `/ocpp/${verSlug}/`);
    }
    return existingUrl;
  }

  return `${wsProto}://${host}/ocpp/${verSlug}/${cleanId}`;
}

/**
 * Format HTTPS Webhook Ingest URL for an EV charger / HTTP Bridge according to OCPP version
 * Format:
 *   - OCPP 1.6: https://<real-host>/api/webhook/ocpp/1.6/<ChargeBoxID>
 *   - OCPP 2.0.1: https://<real-host>/api/webhook/ocpp/2.0.1/<ChargeBoxID>
 */
export function formatHttpWebhookUrl(
  chargeBoxId: string,
  param2?: string,
  param3?: string
): string {
  const host = getRealHost();
  const { httpProto } = getRealProtocol();
  const cleanId = (chargeBoxId || 'CHG-NEW').trim();

  let existingUrl: string | undefined;
  let ocppVer: string | undefined;

  if (param2) {
    if (param2.startsWith('http://') || param2.startsWith('https://')) {
      existingUrl = param2;
      ocppVer = param3;
    } else {
      ocppVer = param2;
    }
  }

  const verSlug = ocppVer?.includes('2.0') ? '2.0.1' : '1.6';

  if (
    existingUrl &&
    (existingUrl.startsWith('https://') || existingUrl.startsWith('http://')) &&
    (existingUrl.includes('/api/webhook/ocpp/1.6/') ||
      existingUrl.includes('/api/webhook/ocpp/2.0.1/') ||
      existingUrl.includes('/api/webhook/ocpp/')) &&
    !existingUrl.includes('z-charge-cpms2.ai.studio') &&
    !existingUrl.includes('cpms.zcharge.network')
  ) {
    if (ocppVer) {
      return existingUrl.replace(/\/api\/webhook\/ocpp\/(1\.6|2\.0\.1|ws)\//, `/api/webhook/ocpp/${verSlug}/`);
    }
    return existingUrl;
  }

  return `${httpProto}://${host}/api/webhook/ocpp/${verSlug}/${cleanId}`;
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
  if (s === 'preparing' || s.includes('prepar')) return 'Preparing';
  if (s === 'occupied' || s.includes('evconnect')) return 'Occupied';
  if (s === 'finishing' || s.includes('finish')) return 'Finishing';
  if (s.includes('charg')) return 'Charging';
  if (s.includes('avail') || s === 'idle') return 'Available';
  if (s.includes('fault')) return 'Faulted';
  if (s.includes('unavail') || s.includes('offlin')) return 'Offline';
  if (s.includes('suspendedevse') || s.includes('suspendedsystem')) return 'SuspendedSystem';
  if (s.includes('suspended')) return 'SuspendedEV';
  if (s.includes('maint')) return 'Maintenance';
  if (s.includes('reserv')) return 'Reserved';
  return status as string;
}

/**
 * Robustly resolve the port index (1 or 2) for an individual connector in a station
 */
export function getPortNumberForConnector(
  station: ChargingStation,
  eIdx: number,
  cIdx: number,
  conn: Connector
): number {
  // Case A: Station has multiple EVSEs (common in OCPP 2.0.1 and DC fast chargers)
  if (station.evses && station.evses.length > 1) {
    return eIdx + 1;
  }
  // Case B: Connector has an explicit portNumber
  if (conn.portNumber !== undefined && conn.portNumber > 0) {
    return conn.portNumber;
  }
  // Case C: Single EVSE with multiple connectors
  return cIdx + 1;
}

/**
 * Determine if a specific connector matches a target port (1 or 2)
 */
export function isTargetConnector(
  targetPort: number,
  station: ChargingStation,
  eIdx: number,
  cIdx: number,
  conn: Connector
): boolean {
  if (targetPort === 0) {
    // Port 0 in OCPP represents the main ChargePoint controller / chassis ground, not individual ports
    return false;
  }
  const resolvedPort = getPortNumberForConnector(station, eIdx, cIdx, conn);
  return resolvedPort === targetPort;
}

/**
 * Robustly extract port number (1 or 2) from any OCPP 1.6 or 2.0.1 payload
 */
export function extractOcppPortNumber(payload: Record<string, any>): number {
  if (!payload || typeof payload !== 'object') return 1;

  const evseObj = (payload.evse as any) || {};

  const rawConnId = payload.connectorId !== undefined && !isNaN(Number(payload.connectorId)) ? Number(payload.connectorId) : undefined;
  const rawEvseConnId = typeof evseObj.connectorId === 'number' && !isNaN(evseObj.connectorId) ? Number(evseObj.connectorId) : undefined;
  const rawEvseId = payload.evseId !== undefined && !isNaN(Number(payload.evseId)) ? Number(payload.evseId) : undefined;
  const rawEvseObjId = typeof evseObj.id === 'number' && !isNaN(evseObj.id) ? Number(evseObj.id) : undefined;
  const rawPort = payload.port !== undefined && !isNaN(Number(payload.port)) ? Number(payload.port) : undefined;
  const rawPortNumber = payload.portNumber !== undefined && !isNaN(Number(payload.portNumber)) ? Number(payload.portNumber) : undefined;

  // Explicit check for Port 2
  if (
    rawPort === 2 ||
    rawPortNumber === 2 ||
    rawConnId === 2 ||
    rawEvseConnId === 2 ||
    rawEvseId === 2 ||
    rawEvseObjId === 2
  ) {
    return 2;
  }

  // Explicit check for Port 1
  if (
    rawPort === 1 ||
    rawPortNumber === 1 ||
    rawConnId === 1 ||
    rawEvseConnId === 1 ||
    rawEvseId === 1 ||
    rawEvseObjId === 1
  ) {
    return 1;
  }

  // Explicit check for Port 0 (main station / controller)
  if (rawConnId === 0 || rawEvseId === 0) {
    return 0;
  }

  return 1;
}


