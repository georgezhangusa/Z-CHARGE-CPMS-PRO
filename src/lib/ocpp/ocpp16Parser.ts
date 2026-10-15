/**
 * OCPP 1.6-J (JSON over WebSocket) Message Parser & Handler
 * Standard: Open Charge Point Protocol 1.6 Edition 2
 * WebSocket Subprotocol Profile: 'ocpp1.6' or 'ocpp1.6j'
 */

import type {
  OcppProfile,
  OcppVersionString,
  OcppTransactionState,
  ParseResult,
  ParsedTelemetry,
} from './ocppTypes.ts';

/**
 * Extracts telemetry measurements from OCPP 1.6 MeterValues sampledValue array
 */
export function extract16Telemetry(sampledValue: any[]): ParsedTelemetry {
  const telemetry: ParsedTelemetry = {};
  if (!Array.isArray(sampledValue)) return telemetry;

  for (const sample of sampledValue) {
    if (!sample || sample.value === undefined) continue;
    const meas = String(sample.measurand || 'Energy.Active.Import.Register').toLowerCase();
    const unit = String(sample.unit || 'Wh').toLowerCase();
    const rawVal = typeof sample.value === 'number' ? sample.value : parseFloat(String(sample.value));
    if (isNaN(rawVal)) continue;

    if (meas.includes('power.active') || meas.includes('power.offered') || meas === 'power') {
      const isWatts = unit === 'w' || unit === 'va' || unit === 'var' || (unit !== 'kw' && rawVal > 1000);
      telemetry.powerKw = isWatts ? Number((rawVal / 1000).toFixed(2)) : Number(rawVal.toFixed(2));
    } else if (meas.includes('voltage')) {
      telemetry.voltageV = Number(rawVal.toFixed(1));
    } else if (meas.includes('current.import') || meas.includes('current.offered') || meas === 'current') {
      telemetry.currentA = Number(rawVal.toFixed(1));
    } else if (meas.includes('soc') || meas.includes('stateofcharge')) {
      telemetry.socPercent = Math.min(100, Math.max(0, Number(rawVal.toFixed(1))));
    } else if (meas.includes('energy.active.import') || meas.includes('energy')) {
      const isWh = unit === 'wh' || (unit !== 'kwh' && rawVal > 1000);
      telemetry.energyKwh = isWh ? Number((rawVal / 1000).toFixed(3)) : Number(rawVal.toFixed(3));
    } else if (meas.includes('temperature')) {
      telemetry.temperatureC = Number(rawVal.toFixed(1));
    } else if (meas.includes('frequency')) {
      telemetry.frequencyHz = Number(rawVal.toFixed(1));
    }
  }

  return telemetry;
}

/**
 * Normalizes OCPP 1.6 status string to standard CPMS status
 */
export function normalize16Status(raw: string): string {
  const lower = String(raw || 'Available').trim().toLowerCase();
  const map: Record<string, string> = {
    available: 'Available',
    preparing: 'Preparing',
    charging: 'Charging',
    suspendedev: 'SuspendedEV',
    suspendedevse: 'SuspendedEVSE',
    finishing: 'Finishing',
    reserved: 'Reserved',
    unavailable: 'Unavailable',
    faulted: 'Faulted',
  };
  return map[lower] || (raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : 'Available');
}

/**
 * Parses and processes an incoming OCPP 1.6-J CALL action from a charger
 */
export function parseOcpp16Message(params: {
  stationId: string;
  uniqueId: string;
  action: string;
  payload: Record<string, any>;
  activeTransactions: Map<number | string, OcppTransactionState>;
  subprotocol?: string;
}): ParseResult {
  const { stationId, uniqueId, action, payload, activeTransactions, subprotocol = 'ocpp1.6' } = params;
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();
  const uiBroadcasts: Array<{ type: string; [key: string]: any }> = [];

  // OCPP 2.0.1 action received on OCPP 1.6 profile
  if (action === 'TransactionEvent' || action === 'NotifyReport' || action === 'NotifyEvent') {
    return {
      success: false,
      ocppProfile: 'ocpp1.6',
      ocppVersion: '1.6-J',
      action,
      uniqueId,
      responsePayload: {
        errorCode: 'NotImplemented',
        errorDescription: `Action '${action}' belongs to OCPP 2.0.1, but this connection is using OCPP 1.6-J profile (${subprotocol}). Please connect with subprotocol 'ocpp2.0.1'.`,
      },
      responseFrame: [
        4,
        uniqueId,
        'NotImplemented',
        `Action '${action}' is not valid for OCPP 1.6-J profile.`,
        { requestedAction: action, activeProfile: 'ocpp1.6' },
      ],
      uiBroadcasts: [],
      errorMessage: `Protocol mismatch: '${action}' sent on OCPP 1.6-J socket.`,
    };
  }

  switch (action) {
    case 'BootNotification': {
      const vendor = String(payload.chargePointVendor || payload.vendor || 'Unknown Vendor');
      const model = String(payload.chargePointModel || payload.model || 'Unknown Model');
      const firmwareVersion = String(payload.firmwareVersion || 'v1.0.0');
      const serialNumber = payload.chargePointSerialNumber ? String(payload.chargePointSerialNumber) : undefined;

      uiBroadcasts.push({
        type: 'charger:updated',
        stationId,
        vendor,
        model,
        firmwareVersion,
        serialNumber,
        wsStatus: 'connected',
        ocppVersion: '1.6-J',
        subprotocol: 'ocpp1.6',
      });

      return {
        success: true,
        ocppProfile: 'ocpp1.6',
        ocppVersion: '1.6-J',
        action,
        uniqueId,
        responsePayload: {
          status: 'Accepted',
          currentTime: nowIso,
          interval: 30, // 30s heartbeat interval
        },
        uiBroadcasts,
      };
    }

    case 'Heartbeat': {
      uiBroadcasts.push({
        type: 'charger:heartbeat',
        stationId,
        timestamp: nowIso,
        ocppVersion: '1.6-J',
      });

      return {
        success: true,
        ocppProfile: 'ocpp1.6',
        ocppVersion: '1.6-J',
        action,
        uniqueId,
        responsePayload: {
          currentTime: nowIso,
        },
        uiBroadcasts,
      };
    }

    case 'Authorize': {
      const idTag = String(payload.idTag || 'RFID-TAG');
      return {
        success: true,
        ocppProfile: 'ocpp1.6',
        ocppVersion: '1.6-J',
        action,
        uniqueId,
        responsePayload: {
          idTagInfo: {
            status: 'Accepted',
            expiryDate: new Date(Date.now() + 86400000).toISOString(),
            parentIdTag: 'ADMIN-FLEET',
          },
        },
        uiBroadcasts: [
          {
            type: 'charger:authorized',
            stationId,
            idTag,
            status: 'Accepted',
            ocppVersion: '1.6-J',
          },
        ],
      };
    }

    case 'StatusNotification': {
      // In OCPP 1.6: connectorId 0 = ChargePoint controller, 1 = Port 1, 2 = Port 2
      const rawConnId = payload.connectorId !== undefined ? Number(payload.connectorId) : 1;
      const connectorId = isNaN(rawConnId) ? 1 : rawConnId;
      const rawStatus = String(payload.status || 'Available');
      const status = normalize16Status(rawStatus);
      const errorCode = String(payload.errorCode || 'NoError');
      const info = payload.info ? String(payload.info) : undefined;

      uiBroadcasts.push({
        type: 'connector:status',
        stationId,
        connectorId: connectorId === 0 ? 1 : connectorId,
        status,
        errorCode,
        info,
        ocppVersion: '1.6-J',
      });

      return {
        success: true,
        ocppProfile: 'ocpp1.6',
        ocppVersion: '1.6-J',
        action,
        uniqueId,
        responsePayload: {},
        uiBroadcasts,
      };
    }

    case 'StartTransaction': {
      const rawConnId = payload.connectorId !== undefined ? Number(payload.connectorId) : 1;
      const connectorId = isNaN(rawConnId) ? 1 : rawConnId;
      const idTag = String(payload.idTag || 'RFID-TAG');
      const meterStart = Number(payload.meterStart || 0);
      const transactionId = Math.floor(100000 + Math.random() * 900000);

      const txState: OcppTransactionState = {
        transactionId,
        connectorId,
        idTag,
        startTime: nowIso,
        lastMeterValueTime: nowMs,
        meterStart,
        meterValuesCount: 0,
      };

      uiBroadcasts.push({
        type: 'session:started',
        stationId,
        connectorId,
        transactionId,
        idTag,
        meterStart,
        meterValuesCount: 0,
        ocppVersion: '1.6-J',
        timestamp: nowIso,
      });

      // Lifecycle rule: upon StartTransaction, connector transitions to 'Preparing' until 1st MeterValues
      uiBroadcasts.push({
        type: 'connector:status',
        stationId,
        connectorId,
        status: 'Preparing',
        errorCode: 'NoError',
        info: 'OCPP 1.6-J: Session started; state is Preparing until 1st MeterValues received',
        ocppVersion: '1.6-J',
      });

      return {
        success: true,
        ocppProfile: 'ocpp1.6',
        ocppVersion: '1.6-J',
        action,
        uniqueId,
        responsePayload: {
          transactionId,
          idTagInfo: {
            status: 'Accepted',
          },
        },
        uiBroadcasts,
        transactionUpdate: {
          action: 'start',
          transactionId,
          state: txState,
        },
      };
    }

    case 'MeterValues': {
      const rawConnId = payload.connectorId !== undefined ? Number(payload.connectorId) : 1;
      const connectorId = isNaN(rawConnId) ? 1 : rawConnId;
      const transactionId = payload.transactionId ? Number(payload.transactionId) : undefined;
      const meterValues = payload.meterValue || payload.meterValues;

      let matchedTx: OcppTransactionState | undefined;
      if (transactionId && activeTransactions.has(transactionId)) {
        matchedTx = activeTransactions.get(transactionId);
      } else {
        for (const tx of activeTransactions.values()) {
          if (tx.connectorId === connectorId) {
            matchedTx = tx;
            break;
          }
        }
      }

      const count = matchedTx ? (matchedTx.meterValuesCount || 0) + 1 : 1;
      if (matchedTx) {
        matchedTx.lastMeterValueTime = nowMs;
        matchedTx.meterValuesCount = count;
      }

      uiBroadcasts.push({
        type: 'telemetry:meter_values',
        stationId,
        connectorId,
        transactionId: transactionId || matchedTx?.transactionId,
        meterValues,
        meterValuesCount: count,
        ocppVersion: '1.6-J',
      });

      // When 1st MeterValues arrives, transition port status to 'Charging'
      if (count >= 1) {
        uiBroadcasts.push({
          type: 'connector:status',
          stationId,
          connectorId,
          status: 'Charging',
          errorCode: 'NoError',
          info: 'OCPP 1.6-J: 1st MeterValues received! Transitioning port to Charging',
          ocppVersion: '1.6-J',
        });
      }

      return {
        success: true,
        ocppProfile: 'ocpp1.6',
        ocppVersion: '1.6-J',
        action,
        uniqueId,
        responsePayload: {},
        uiBroadcasts,
        transactionUpdate: matchedTx
          ? {
              action: 'update',
              transactionId: matchedTx.transactionId,
              state: {
                lastMeterValueTime: nowMs,
                meterValuesCount: count,
              },
            }
          : undefined,
      };
    }

    case 'StopTransaction': {
      const txId = Number(payload.transactionId || 0);
      let targetTx = activeTransactions.get(txId);
      let resolvedTxId = txId;

      if (!targetTx) {
        for (const [tId, tx] of activeTransactions.entries()) {
          if (tId === txId || (payload.connectorId !== undefined && tx.connectorId === Number(payload.connectorId))) {
            targetTx = tx;
            resolvedTxId = Number(tId);
            break;
          }
        }
      }

      const connectorId = targetTx?.connectorId || (payload.connectorId !== undefined ? Number(payload.connectorId) : 1);

      uiBroadcasts.push({
        type: 'session:stopped',
        stationId,
        connectorId,
        transactionId: resolvedTxId,
        meterStop: payload.meterStop,
        reason: payload.reason || 'Local',
        timestamp: nowIso,
        ocppVersion: '1.6-J',
      });

      uiBroadcasts.push({
        type: 'connector:status',
        stationId,
        connectorId,
        status: 'Available',
        errorCode: 'NoError',
        info: 'OCPP 1.6-J: StopTransaction received; connector Available',
        ocppVersion: '1.6-J',
      });

      return {
        success: true,
        ocppProfile: 'ocpp1.6',
        ocppVersion: '1.6-J',
        action,
        uniqueId,
        responsePayload: {
          idTagInfo: {
            status: 'Accepted',
          },
        },
        uiBroadcasts,
        transactionUpdate: {
          action: 'stop',
          transactionId: resolvedTxId,
        },
      };
    }

    case 'DataTransfer': {
      return {
        success: true,
        ocppProfile: 'ocpp1.6',
        ocppVersion: '1.6-J',
        action,
        uniqueId,
        responsePayload: {
          status: 'Accepted',
          data: 'CPMS_OCPP16_OK',
        },
        uiBroadcasts: [],
      };
    }

    case 'DiagnosticsStatusNotification':
    case 'FirmwareStatusNotification': {
      return {
        success: true,
        ocppProfile: 'ocpp1.6',
        ocppVersion: '1.6-J',
        action,
        uniqueId,
        responsePayload: {},
        uiBroadcasts: [],
      };
    }

    default: {
      return {
        success: true,
        ocppProfile: 'ocpp1.6',
        ocppVersion: '1.6-J',
        action,
        uniqueId,
        responsePayload: {},
        uiBroadcasts: [],
      };
    }
  }
}
