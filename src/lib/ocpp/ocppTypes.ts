/**
 * OCPP Protocol Definitions, Types & Schemas
 * Supporting both OCPP 1.6-J and OCPP 2.0.1 specifications.
 */

export type OcppProfile = 'ocpp1.6' | 'ocpp1.6j' | 'ocpp2.0.1' | 'ocpp2.0';
export type OcppVersionString = '1.6-J' | '2.0.1';

export const OCPP_MESSAGE_TYPES = {
  CALL: 2,
  CALL_RESULT: 3,
  CALL_ERROR: 4,
} as const;

export type OcppMessageTypeId = (typeof OCPP_MESSAGE_TYPES)[keyof typeof OCPP_MESSAGE_TYPES];

export interface OcppRawFrame {
  messageTypeId: OcppMessageTypeId;
  uniqueId: string;
  action?: string;
  payload: Record<string, any>;
  errorCode?: string;
  errorDescription?: string;
  errorDetails?: Record<string, any>;
}

export interface OcppTransactionState {
  transactionId: number | string;
  connectorId: number;
  evseId?: number;
  idTag: string;
  startTime: string;
  lastMeterValueTime: number;
  meterStart?: number;
  meterValuesCount: number;
  chargingState?: string;
}

export interface ParseResult {
  success: boolean;
  ocppProfile: OcppProfile | string;
  ocppVersion: OcppVersionString;
  action: string;
  uniqueId: string;
  responsePayload: Record<string, any>;
  responseFrame?: [number, string, Record<string, any>] | [number, string, string, string, Record<string, any>];
  uiBroadcasts: Array<{
    type: string;
    [key: string]: any;
  }>;
  transactionUpdate?: {
    action: 'start' | 'update' | 'stop';
    transactionId: number | string;
    state?: Partial<OcppTransactionState>;
  };
  errorMessage?: string;
  errorCode?: string;
}

export interface MeterValueSample {
  measurand?: string;
  value: number | string;
  unit?: string;
  phase?: string;
  context?: string;
  location?: string;
}

export interface ParsedTelemetry {
  powerKw?: number;
  voltageV?: number;
  currentA?: number;
  socPercent?: number;
  energyKwh?: number;
  temperatureC?: number;
  frequencyHz?: number;
}
