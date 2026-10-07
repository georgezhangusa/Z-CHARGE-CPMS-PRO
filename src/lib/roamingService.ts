import {
  OcpiPartner,
  OcpiCdr,
  OcpiTariff,
  OcpiToken,
  OcpiSyncLog,
  ChargingStation,
  Site,
} from '../types';

const STORAGE_PARTNERS_KEY = 'zcharge_cpms_roaming_partners_v3';
const STORAGE_CDRS_KEY = 'zcharge_cpms_roaming_cdrs_v3';
const STORAGE_LOGS_KEY = 'zcharge_cpms_roaming_logs_v3';
const STORAGE_TOKENS_KEY = 'zcharge_cpms_roaming_tokens_v3';

export const INITIAL_ROAMING_PARTNERS: OcpiPartner[] = [
  {
    id: 'partner-hubject',
    name: 'Hubject intercharge',
    role: 'HUB',
    countryCode: 'DE',
    partyId: 'HUB',
    status: 'Connected',
    versionsUrl: 'https://intercharge.hubject.com/ocpi/versions',
    tokenA: 'tok_a_hubject_98a72bf',
    tokenB: 'tok_b_hubject_45c11d2',
    tokenC: 'tok_c_hubject_77e90a1',
    ocpiVersion: '2.2.1',
    lastSync: '2 minutes ago',
    autoSync: true,
    syncStats: {
      locationsCount: 4,
      evsesCount: 16,
      tariffsCount: 2,
      cdrsCount: 48,
    },
    contactEmail: 'operations@hubject.com',
  },
  {
    id: 'partner-chargepoint',
    name: 'ChargePoint Roaming Network',
    role: 'eMSP',
    countryCode: 'US',
    partyId: 'CPT',
    status: 'Connected',
    versionsUrl: 'https://roaming.chargepoint.com/ocpi/versions',
    tokenA: 'tok_a_cpt_12d45a',
    tokenB: 'tok_b_cpt_88f91c',
    ocpiVersion: '2.2.1',
    lastSync: '14 minutes ago',
    autoSync: true,
    syncStats: {
      locationsCount: 4,
      evsesCount: 16,
      tariffsCount: 2,
      cdrsCount: 32,
    },
    contactEmail: 'roaming-support@chargepoint.com',
  },
  {
    id: 'partner-shell',
    name: 'Shell Recharge Solutions',
    role: 'eMSP',
    countryCode: 'NL',
    partyId: 'SHL',
    status: 'Connected',
    versionsUrl: 'https://api.shellrecharge.com/ocpi/versions',
    tokenA: 'tok_a_shell_9901bc',
    tokenB: 'tok_b_shell_3342da',
    ocpiVersion: '2.2.1',
    lastSync: '42 minutes ago',
    autoSync: true,
    syncStats: {
      locationsCount: 4,
      evsesCount: 16,
      tariffsCount: 2,
      cdrsCount: 21,
    },
    contactEmail: 'roaming@shellrecharge.com',
  },
  {
    id: 'partner-evgo',
    name: 'EVgo e-Mobility Network',
    role: 'eMSP',
    countryCode: 'US',
    partyId: 'EVG',
    status: 'Connected',
    versionsUrl: 'https://partner.evgo.com/ocpi/versions',
    tokenA: 'tok_a_evgo_6612ea',
    tokenB: 'tok_b_evgo_9941ac',
    ocpiVersion: '2.2.1',
    lastSync: '1 hour ago',
    autoSync: true,
    syncStats: {
      locationsCount: 4,
      evsesCount: 16,
      tariffsCount: 2,
      cdrsCount: 19,
    },
    contactEmail: 'interop@evgo.com',
  },
  {
    id: 'partner-plugsurfing',
    name: 'Plugsurfing Partner Gateway',
    role: 'eMSP',
    countryCode: 'DE',
    partyId: 'PSG',
    status: 'Connected',
    versionsUrl: 'https://api.plugsurfing.com/ocpi/versions',
    tokenA: 'tok_a_psg_7718ca',
    tokenB: 'tok_b_psg_2209da',
    ocpiVersion: '2.2.1',
    lastSync: '2 hours ago',
    autoSync: false,
    syncStats: {
      locationsCount: 4,
      evsesCount: 16,
      tariffsCount: 2,
      cdrsCount: 14,
    },
    contactEmail: 'connect@plugsurfing.com',
  },
];

export const INITIAL_ROAMING_CDRS: OcpiCdr[] = [
  {
    id: 'CDR-2026-HUB-9011',
    partnerId: 'partner-hubject',
    partnerPartyId: 'HUB',
    partnerName: 'Hubject intercharge',
    startDateTime: '2026-03-28T14:15:00Z',
    stopDateTime: '2026-03-28T14:48:00Z',
    durationMinutes: 33,
    totalEnergyKwh: 48.6,
    totalCost: 26.24,
    currency: 'USD',
    tariffId: 'TAR-DCFC-ROAMING-01',
    authMethod: 'AUTH_REQUEST',
    tokenUid: '04A92F1AC908',
    stationId: 'CHG-HOU-01',
    stationName: 'Houston Corridor Supercharger #1',
    evseId: 'EVSE-HOU-01-1',
    status: 'Reconciled',
  },
  {
    id: 'CDR-2026-CPT-8422',
    partnerId: 'partner-chargepoint',
    partnerPartyId: 'CPT',
    partnerName: 'ChargePoint Roaming Network',
    startDateTime: '2026-03-28T11:02:00Z',
    stopDateTime: '2026-03-28T11:39:00Z',
    durationMinutes: 37,
    totalEnergyKwh: 54.2,
    totalCost: 29.27,
    currency: 'USD',
    tariffId: 'TAR-DCFC-ROAMING-01',
    authMethod: 'WHITELIST',
    tokenUid: 'CPT-USER-89102',
    stationId: 'CHG-HOU-02',
    stationName: 'Houston Corridor Supercharger #2',
    evseId: 'EVSE-HOU-02-1',
    status: 'Approved',
  },
  {
    id: 'CDR-2026-SHL-7621',
    partnerId: 'partner-shell',
    partnerPartyId: 'SHL',
    partnerName: 'Shell Recharge Solutions',
    startDateTime: '2026-03-28T09:20:00Z',
    stopDateTime: '2026-03-28T09:55:00Z',
    durationMinutes: 35,
    totalEnergyKwh: 51.0,
    totalCost: 27.54,
    currency: 'USD',
    tariffId: 'TAR-DCFC-ROAMING-01',
    authMethod: 'AUTH_REQUEST',
    tokenUid: 'SHL-CARD-99120',
    stationId: 'CHG-HOU-01',
    stationName: 'Houston Corridor Supercharger #1',
    evseId: 'EVSE-HOU-01-2',
    status: 'Sent',
  },
  {
    id: 'CDR-2026-EVG-5109',
    partnerId: 'partner-evgo',
    partnerPartyId: 'EVG',
    partnerName: 'EVgo e-Mobility Network',
    startDateTime: '2026-03-27T18:10:00Z',
    stopDateTime: '2026-03-27T18:42:00Z',
    durationMinutes: 32,
    totalEnergyKwh: 45.8,
    totalCost: 24.73,
    currency: 'USD',
    tariffId: 'TAR-DCFC-ROAMING-01',
    authMethod: 'WHITELIST',
    tokenUid: 'EVG-AUTOC-4410',
    stationId: 'CHG-HOU-03',
    stationName: 'Houston Fast Station #3',
    evseId: 'EVSE-HOU-03-1',
    status: 'Reconciled',
  },
];

export const INITIAL_ROAMING_TARIFFS: OcpiTariff[] = [
  {
    id: 'TAR-DCFC-ROAMING-01',
    currency: 'USD',
    title: 'Standard DC Fast Roaming Tariff (CPO Broadcast)',
    countryCode: 'US',
    partyId: 'ZCH',
    lastUpdated: '2026-03-20T00:00:00Z',
    elements: [
      {
        priceComponents: [
          { type: 'FLAT', price: 1.5, vat: 0.0 }, // Connection fee
          { type: 'ENERGY', price: 0.52, vat: 0.0, stepSize: 1 }, // $/kWh
          { type: 'PARKING_TIME', price: 0.6, vat: 0.0, stepSize: 60 }, // Idle $/min
        ],
      },
    ],
  },
  {
    id: 'TAR-AC-ROAMING-02',
    currency: 'USD',
    title: 'AC Level 2 Fleet Roaming Tariff',
    countryCode: 'US',
    partyId: 'ZCH',
    lastUpdated: '2026-03-20T00:00:00Z',
    elements: [
      {
        priceComponents: [
          { type: 'FLAT', price: 0.5, vat: 0.0 },
          { type: 'ENERGY', price: 0.29, vat: 0.0, stepSize: 1 },
          { type: 'PARKING_TIME', price: 0.2, vat: 0.0, stepSize: 60 },
        ],
      },
    ],
  },
];

export const INITIAL_ROAMING_TOKENS: OcpiToken[] = [
  {
    uid: '04A92F1AC908',
    type: 'RFID',
    contractId: 'DE-HUB-C00991823-1',
    visualNumber: 'INTERCHARGE-8812',
    issuer: 'Hubject / Porsche Charging',
    valid: true,
    whitelist: 'ALWAYS',
    lastUpdated: '2026-03-28T12:00:00Z',
    countryCode: 'DE',
    partyId: 'HUB',
  },
  {
    uid: 'CPT-USER-89102',
    type: 'APP_USER',
    contractId: 'US-CPT-C8910294-0',
    visualNumber: 'CHARGEPOINT-APP-PASS',
    issuer: 'ChargePoint eMSP',
    valid: true,
    whitelist: 'ALLOWED',
    lastUpdated: '2026-03-28T10:00:00Z',
    countryCode: 'US',
    partyId: 'CPT',
  },
  {
    uid: 'SHL-CARD-99120',
    type: 'RFID',
    contractId: 'NL-SHL-C7718290-9',
    visualNumber: 'SHELL-RECHARGE-TAG',
    issuer: 'Shell Recharge Solutions',
    valid: true,
    whitelist: 'ALWAYS',
    lastUpdated: '2026-03-27T16:00:00Z',
    countryCode: 'NL',
    partyId: 'SHL',
  },
];

export const INITIAL_ROAMING_LOGS: OcpiSyncLog[] = [
  {
    id: 'log-1',
    timestamp: 'Just now',
    endpoint: '/ocpi/2.2.1/cpo/locations',
    method: 'GET',
    partnerName: 'Hubject intercharge',
    statusCode: 200,
    ocpiCode: 1000,
    statusMessage: 'Success',
    latencyMs: 38,
    direction: 'INBOUND',
    payloadSummary: 'Fetched 4 locations and 16 EVSEs availability state',
  },
  {
    id: 'log-2',
    timestamp: '2 min ago',
    endpoint: '/ocpi/2.2.1/cpo/tokens/DE/HUB/04A92F1AC908/authorize',
    method: 'POST',
    partnerName: 'Hubject intercharge',
    statusCode: 200,
    ocpiCode: 1000,
    statusMessage: 'Success: Token Accepted',
    latencyMs: 44,
    direction: 'INBOUND',
    payloadSummary: 'Token authorized: DE-HUB-C00991823-1 (Allowed)',
  },
  {
    id: 'log-3',
    timestamp: '14 min ago',
    endpoint: '/ocpi/2.2.1/cpo/cdrs',
    method: 'POST',
    partnerName: 'ChargePoint Roaming Network',
    statusCode: 201,
    ocpiCode: 1000,
    statusMessage: 'CDR Created and Accepted',
    latencyMs: 76,
    direction: 'OUTBOUND',
    payloadSummary: 'CDR-2026-CPT-8422 (54.2 kWh, $29.27)',
  },
  {
    id: 'log-4',
    timestamp: '32 min ago',
    endpoint: '/ocpi/2.2.1/cpo/tariffs',
    method: 'GET',
    partnerName: 'EVgo e-Mobility Network',
    statusCode: 200,
    ocpiCode: 1000,
    statusMessage: 'Success',
    latencyMs: 32,
    direction: 'INBOUND',
    payloadSummary: 'Returned 2 active roaming tariffs',
  },
];

export const roamingService = {
  getPartners(): OcpiPartner[] {
    try {
      const raw = localStorage.getItem(STORAGE_PARTNERS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_ROAMING_PARTNERS;
  },

  savePartners(partners: OcpiPartner[]) {
    try {
      localStorage.setItem(STORAGE_PARTNERS_KEY, JSON.stringify(partners));
    } catch {}
  },

  addPartner(newPartner: Omit<OcpiPartner, 'id' | 'lastSync' | 'syncStats'>): OcpiPartner {
    const current = this.getPartners();
    const partner: OcpiPartner = {
      ...newPartner,
      id: `partner-${Date.now()}`,
      lastSync: 'Just now',
      syncStats: {
        locationsCount: 4,
        evsesCount: 16,
        tariffsCount: 2,
        cdrsCount: 0,
      },
    };
    const updated = [partner, ...current];
    this.savePartners(updated);
    this.addLog({
      endpoint: '/ocpi/2.2.1/credentials',
      method: 'POST',
      partnerName: partner.name,
      statusCode: 200,
      ocpiCode: 1000,
      statusMessage: 'Credentials Handshake Completed',
      latencyMs: 82,
      direction: 'OUTBOUND',
      payloadSummary: `Exchanged Token A/B with ${partner.name} (${partner.countryCode}*${partner.partyId})`,
    });
    return partner;
  },

  triggerSync(partnerId: string): OcpiPartner | null {
    const current = this.getPartners();
    const partner = current.find((p) => p.id === partnerId);
    if (!partner) return null;

    partner.lastSync = 'Just now';
    this.savePartners(current);

    this.addLog({
      endpoint: '/ocpi/2.2.1/cpo/locations',
      method: 'PUT',
      partnerName: partner.name,
      statusCode: 200,
      ocpiCode: 1000,
      statusMessage: 'Push Locations & Availability Synchronized',
      latencyMs: 64,
      direction: 'OUTBOUND',
      payloadSummary: `Broadcasted current EVSE statuses to ${partner.partyId}`,
    });

    return partner;
  },

  getCdrs(): OcpiCdr[] {
    try {
      const raw = localStorage.getItem(STORAGE_CDRS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_ROAMING_CDRS;
  },

  saveCdrs(cdrs: OcpiCdr[]) {
    try {
      localStorage.setItem(STORAGE_CDRS_KEY, JSON.stringify(cdrs));
    } catch {}
  },

  getTokens(): OcpiToken[] {
    try {
      const raw = localStorage.getItem(STORAGE_TOKENS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_ROAMING_TOKENS;
  },

  saveTokens(tokens: OcpiToken[]) {
    try {
      localStorage.setItem(STORAGE_TOKENS_KEY, JSON.stringify(tokens));
    } catch {}
  },

  addToken(token: OcpiToken) {
    const list = this.getTokens();
    const updated = [token, ...list];
    this.saveTokens(updated);
    this.addLog({
      endpoint: `/ocpi/2.2.1/cpo/tokens/${token.countryCode}/${token.partyId}/${token.uid}`,
      method: 'PUT',
      partnerName: token.issuer,
      statusCode: 200,
      ocpiCode: 1000,
      statusMessage: 'Token Stored in Whitelist',
      latencyMs: 25,
      direction: 'INBOUND',
      payloadSummary: `Whitelisted ${token.visualNumber} (${token.whitelist})`,
    });
  },

  getLogs(): OcpiSyncLog[] {
    try {
      const raw = localStorage.getItem(STORAGE_LOGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_ROAMING_LOGS;
  },

  addLog(log: Omit<OcpiSyncLog, 'id' | 'timestamp'>) {
    const current = this.getLogs();
    const newLog: OcpiSyncLog = {
      ...log,
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: 'Just now',
    };
    const next = [newLog, ...current].slice(0, 50);
    try {
      localStorage.setItem(STORAGE_LOGS_KEY, JSON.stringify(next));
    } catch {}
  },
};
