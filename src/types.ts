export type ConnectorType = 'CCS1' | 'NACS' | 'J1772' | 'CHAdeMO';

export type PortStatus =
  | 'Available'
  | 'Preparing'
  | 'Occupied'
  | 'Charging'
  | 'SuspendedEV'
  | 'SuspendedSystem'
  | 'Finishing'
  | 'Faulted'
  | 'Offline'
  | 'Maintenance'
  | 'Reserved';

export interface Connector {
  id: string;
  evseId: string;
  portNumber: number;
  type: ConnectorType;
  maxPowerKw: number;
  status: PortStatus;
  currentPowerKw: number;
  voltageV: number;
  currentA: number;
  currentSoc?: number;
  targetSoc?: number;
  timeTo80Min?: number;
  etaFullMin?: number;
  activeSessionId?: string;
  cableLocked: boolean;
  lockoutReason?: string; // e.g., "Locked out by Port 1 power priority"
  meterValuesCount?: number; // Number of MeterValues received for this active transaction (OCPP 1.6-J state transition)
}

export interface EVSE {
  id: string;
  evseNumber: number;
  maxPowerKw: number;
  currentLoadKw: number;
  connectors: Connector[];
  isMutuallyExclusive: boolean; // if true, only 1 connector can charge at a time
}

export interface HardwareHealth {
  contactor: 'Closed' | 'Open';
  cabinetTempC: number;
  eStop: 'OK' | 'Triggered';
  groundFault: 'Clear' | 'Tripped';
  gunLock: 'Engaged' | 'Unlocked' | 'Error';
  lastError: string;
  lastErrorCode: string;
  firmwareVersion: string;
}

export interface ChargingStation {
  id: string;
  name: string;
  model: string;
  vendor: string;
  siteId: string;
  siteName: string;
  type: 'DCFC' | 'AC_L2';
  totalCapacityKw: number;
  currentLoadKw: number;
  isSimultaneous: boolean; // Dynamic power sharing across ports
  isEmulated: boolean;
  wsStatus: 'connected' | 'lag' | 'disconnected';
  lastHeartbeatSecondsAgo: number;
  evses: EVSE[];
  health: HardwareHealth;
  ocppVersion: '1.6-J' | '2.0.1';
  ipAddress: string;
  webhookUrl?: string; // Webhook endpoint connecting charger with CPMS
  webhookSecret?: string; // HMAC authentication key
  cloudConnectionMode?: 'direct_ocpp' | 'webhook_bridge' | 'mqtt_iot';
  isDatabasePersisted?: boolean; // Persisted in Firestore
  createdAt?: string;
  createdBy?: string;
}

export type OcppDirection = 'CP_TO_CS' | 'CS_TO_CP';

export interface OcppMessage {
  id: string;
  timestamp: string;
  stationId: string;
  direction: OcppDirection;
  action: string;
  messageTypeId: number; // 2=Call, 3=CallResult, 4=CallError
  payload: Record<string, unknown>;
}

export type StopReason =
  | 'Local'
  | 'Remote'
  | 'EVDisconnected'
  | 'GroundFailure'
  | 'EmergencyStop'
  | 'PowerLoss'
  | 'Timeout';

// --------------------------------------------------------------------------
// Multi-Level User Account Management (Admin, Site Manager, Technician, Viewer)
// --------------------------------------------------------------------------
export type UserLevel = 'admin' | 'site_manager' | 'technician' | 'viewer';

export interface CpmsUserAccount {
  id: string;
  username: string;
  email: string;
  displayName: string;
  role: UserLevel;
  password?: string; // Stored securely in account registry
  mustChangePassword: boolean; // True on 1st login for initial admin or forced reset
  assignedSiteIds: string[]; // Site IDs user has jurisdiction over
  status: 'active' | 'invited' | 'suspended';
  inviteToken?: string;
  inviteSentAt?: string;
  inviteAcceptedAt?: string;
  createdAt: string;
  updatedAt?: string;
  lastLoginAt?: string;
  notes?: string;
}

export interface InviteEmailRecord {
  id: string;
  recipientEmail: string;
  recipientName: string;
  role: UserLevel;
  inviteToken: string;
  inviteUrl: string;
  sentAt: string;
  status: 'delivered' | 'opened' | 'accepted';
  assignedSiteNames: string[];
  expiresAt: string;
}

// --------------------------------------------------------------------------
// OCPI 2.2.1 Roaming Data Models
// --------------------------------------------------------------------------
export type OcpiRole = 'CPO' | 'eMSP' | 'HUB';
export type OcpiConnectionStatus = 'Connected' | 'Pending' | 'Suspended' | 'Offline';

export interface OcpiPartner {
  id: string;
  name: string;
  role: OcpiRole;
  countryCode: string; // ISO 3166-1 alpha-2, e.g. "US", "DE", "NL"
  partyId: string;     // 3-char code, e.g. "HUB", "CPT", "SHL", "EVG"
  status: OcpiConnectionStatus;
  versionsUrl: string;
  tokenA?: string;
  tokenB?: string;
  tokenC?: string;
  ocpiVersion: '2.2.1' | '2.1.1';
  lastSync: string;
  autoSync: boolean;
  syncStats: {
    locationsCount: number;
    evsesCount: number;
    tariffsCount: number;
    cdrsCount: number;
  };
  contactEmail: string;
  endpointPrefix?: string;
}

export interface OcpiLocationSummary {
  id: string;
  name: string;
  address: string;
  city: string;
  country: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  evsesCount: number;
  status: 'OPERATIVE' | 'INOPERATIVE' | 'PLANNED';
  tariffsIds: string[];
}

export interface OcpiTariffElement {
  priceComponents: {
    type: 'ENERGY' | 'FLAT' | 'TIME' | 'PARKING_TIME';
    price: number;
    stepSize?: number;
    vat?: number;
  }[];
}

export interface OcpiTariff {
  id: string;
  currency: string;
  elements: OcpiTariffElement[];
  countryCode: string;
  partyId: string;
  lastUpdated: string;
  title: string;
}

export interface OcpiCdr {
  id: string;
  partnerId: string;
  partnerPartyId: string;
  partnerName: string;
  startDateTime: string;
  stopDateTime: string;
  durationMinutes: number;
  totalEnergyKwh: number;
  totalCost: number;
  currency: string;
  tariffId: string;
  authMethod: 'AUTH_REQUEST' | 'WHITELIST';
  tokenUid: string;
  stationId: string;
  stationName: string;
  evseId: string;
  status: 'Draft' | 'Sent' | 'Approved' | 'Reconciled';
  creditNoteId?: string;
}

export interface OcpiToken {
  uid: string;
  type: 'RFID' | 'APP_USER' | 'OTHER';
  contractId: string;
  visualNumber: string;
  issuer: string;
  valid: boolean;
  whitelist: 'ALWAYS' | 'ALLOWED' | 'NEVER';
  lastUpdated: string;
  countryCode: string;
  partyId: string;
}

export interface OcpiSyncLog {
  id: string;
  timestamp: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  partnerName: string;
  statusCode: number; // HTTP status code, e.g. 200, 201
  ocpiCode: number;   // OCPI code: 1000 = Generic success, 2000 = Client error
  statusMessage: string;
  latencyMs: number;
  payloadSummary?: string;
  direction: 'INBOUND' | 'OUTBOUND';
}

export interface Session {
  id: string;
  stationId: string;
  stationName: string;
  evseId: string;
  portNumber: number;
  connectorType: ConnectorType;
  siteId: string;
  siteName: string;
  userTag: string;
  authMethod: 'RFID' | 'App' | 'OperatorOverride' | 'AutoCharge';
  vehicleModel?: string;
  startTime: string;
  endTime?: string;
  durationMinutes: number;
  energyKwh: number;
  currentKw: number;
  peakKw: number;
  status: 'active' | 'completed';
  stopReason?: StopReason;
  costTotal: number;
  costBreakdown: {
    energyFee: number;
    timeFee: number;
    idleFee: number;
  };
  socStart?: number;
  socCurrent?: number;
  lastMeterValueTimestamp?: number; // ms timestamp of last received MeterValue
  meterStart?: number; // Starting meter value in Wh or kWh
  lastMeterRegister?: number; // Most recent raw meter register
  meterValuesCount?: number; // Number of MeterValues frames received (OCPP 1.6-J changes state to Charging on 1st MeterValues)
}

export interface Site {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  transformerLimitKw: number;
  currentLoadKw: number;
  peakDemandKw24h: number;
  totalChargers: number;
  activeSessionsCount: number;
  offlineCount: number;
  todayRevenue: number;
  todayEnergyKwh: number;
}

export interface ToUPeriod {
  name: string;
  hours: string;
  ratePerKwh: number;
  isCurrent?: boolean;
}

export interface TariffProfile {
  type: 'DCFC' | 'AC_L2';
  title: string;
  baseRatePerKwh: number;
  touPeriods: ToUPeriod[];
  idleFeePerMin: number;
  gracePeriodMinutes: number;
  connectionFee: number;
}

export interface SystemAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  timestamp: string;
  targetTab: 'home' | 'chargers' | 'sessions' | 'sites' | 'pricing' | 'settings';
  targetStationId?: string;
  targetSiteId?: string;
  filterStatus?: PortStatus;
}
