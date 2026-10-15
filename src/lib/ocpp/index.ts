/**
 * Central OCPP Parser & Protocol Router
 * Dispatches messages to either OCPP 1.6-J or OCPP 2.0.1 parsers
 * strictly based on the negotiated WebSocket subprotocol profile.
 */

export type * from './ocppTypes.ts';
export { OCPP_MESSAGE_TYPES } from './ocppTypes.ts';
export { parseOcpp16Message, extract16Telemetry, normalize16Status } from './ocpp16Parser.ts';
export { parseOcpp201Message, extract201Telemetry, normalize201Status, extract201PortNumber } from './ocpp201Parser.ts';

import type { OcppProfile, OcppTransactionState, ParseResult } from './ocppTypes.ts';
import { parseOcpp16Message } from './ocpp16Parser.ts';
import { parseOcpp201Message } from './ocpp201Parser.ts';

/**
 * Resolves whether a WebSocket subprotocol or version string corresponds to OCPP 2.0.1 or OCPP 1.6-J
 */
export function resolveOcppProfile(subprotocolOrVersion?: string): {
  profile: OcppProfile;
  version: '1.6-J' | '2.0.1';
  isVersion201: boolean;
} {
  const norm = String(subprotocolOrVersion || '').toLowerCase().trim();
  if (norm.includes('2.0.1') || norm.includes('2.0') || norm === 'ocpp2.0.1' || norm === 'ocpp2.0') {
    return {
      profile: 'ocpp2.0.1',
      version: '2.0.1',
      isVersion201: true,
    };
  }
  return {
    profile: 'ocpp1.6',
    version: '1.6-J',
    isVersion201: false,
  };
}

/**
 * Main dispatcher: parses and processes any OCPP message by using the correct
 * protocol parser according to the active WebSocket profile.
 */
export function dispatchOcppMessage(params: {
  stationId: string;
  uniqueId: string;
  action: string;
  payload: Record<string, any>;
  activeTransactions: Map<number | string, OcppTransactionState>;
  wsProfile?: string;
  chargerVersion?: string;
}): ParseResult {
  const { wsProfile, chargerVersion } = params;
  const profileInfo = resolveOcppProfile(wsProfile || chargerVersion);

  if (profileInfo.isVersion201) {
    return parseOcpp201Message({
      stationId: params.stationId,
      uniqueId: params.uniqueId,
      action: params.action,
      payload: params.payload,
      activeTransactions: params.activeTransactions,
      subprotocol: wsProfile || 'ocpp2.0.1',
    });
  } else {
    return parseOcpp16Message({
      stationId: params.stationId,
      uniqueId: params.uniqueId,
      action: params.action,
      payload: params.payload,
      activeTransactions: params.activeTransactions,
      subprotocol: wsProfile || 'ocpp1.6',
    });
  }
}
