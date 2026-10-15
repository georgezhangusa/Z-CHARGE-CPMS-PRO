/**
 * OCPP 2.0.1 (JSON over WebSocket) Message Parser & Handler
 * Standard: Open Charge Point Protocol 2.0.1 (ISO 15118, Device Model & TransactionEvent)
 * WebSocket Subprotocol Profile: 'ocpp2.0.1' or 'ocpp2.0'
 */

import type {
  OcppProfile,
  OcppVersionString,
  OcppTransactionState,
  ParseResult,
  ParsedTelemetry,
} from './ocppTypes.ts';

/**
 * Extracts telemetry measurements from OCPP 2.0.1 MeterValues / TransactionEvent sampledValue array
 */
export function extract201Telemetry(sampledValue: any[]): ParsedTelemetry {
  const telemetry: ParsedTelemetry = {};
  if (!Array.isArray(sampledValue)) return telemetry;

  for (const sample of sampledValue) {
    if (!sample || sample.value === undefined) continue;
    const meas = String(sample.measurand || 'Energy.Active.Import.Register').toLowerCase();
    const unit = String(sample.unit || sample.unitOfMeasure?.unit || 'Wh').toLowerCase();
    const multiplier = typeof sample.unitOfMeasure?.multiplier === 'number' ? sample.unitOfMeasure.multiplier : 0;

    let rawVal = typeof sample.value === 'number' ? sample.value : parseFloat(String(sample.value));
    if (isNaN(rawVal)) continue;

    if (multiplier !== 0) {
      rawVal = rawVal * Math.pow(10, multiplier);
    }

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
 * Normalizes OCPP 2.0.1 connectorStatus to standard CPMS status
 * In OCPP 2.0.1: 'Available' | 'Occupied' | 'Reserved' | 'Unavailable' | 'Faulted'
 */
export function normalize201Status(raw: string): string {
  const lower = String(raw || 'Available').trim().toLowerCase();
  switch (lower) {
    case 'available':
      return 'Available';
    case 'occupied':
      return 'Occupied';
    case 'reserved':
      return 'Reserved';
    case 'unavailable':
      return 'Unavailable';
    case 'faulted':
      return 'Faulted';
    case 'charging':
      return 'Charging';
    case 'preparing':
      return 'Preparing';
    case 'suspendedev':
      return 'SuspendedEV';
    case 'suspendedevse':
      return 'SuspendedEVSE';
    case 'finishing':
      return 'Finishing';
    default:
      return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : 'Available';
  }
}

/**
 * Extracts target port / EVSE ID from OCPP 2.0.1 payload
 */
export function extract201PortNumber(payload: Record<string, any>): number {
  if (!payload || typeof payload !== 'object') return 1;
  const evseObj = payload.evse || {};

  const evseId = typeof evseObj.id === 'number' && !isNaN(evseObj.id) ? evseObj.id : undefined;
  const rawEvseId = payload.evseId !== undefined && !isNaN(Number(payload.evseId)) ? Number(payload.evseId) : undefined;
  const rawPort = payload.port !== undefined && !isNaN(Number(payload.port)) ? Number(payload.port) : undefined;
  const rawPortNumber = payload.portNumber !== undefined && !isNaN(Number(payload.portNumber)) ? Number(payload.portNumber) : undefined;
  const connectorId = typeof evseObj.connectorId === 'number' && !isNaN(evseObj.connectorId) ? evseObj.connectorId : undefined;
  const rawConnId = payload.connectorId !== undefined && !isNaN(Number(payload.connectorId)) ? Number(payload.connectorId) : undefined;

  if (evseId === 2 || rawEvseId === 2 || rawPort === 2 || rawPortNumber === 2 || connectorId === 2 || rawConnId === 2) {
    return 2;
  }
  if (evseId === 1 || rawEvseId === 1 || rawPort === 1 || rawPortNumber === 1 || connectorId === 1 || rawConnId === 1) {
    return 1;
  }
  return 1;
}

/**
 * Parses and processes an incoming OCPP 2.0.1 CALL action from a charger
 */
export function parseOcpp201Message(params: {
  stationId: string;
  uniqueId: string;
  action: string;
  payload: Record<string, any>;
  activeTransactions: Map<number | string, OcppTransactionState>;
  subprotocol?: string;
}): ParseResult {
  const { stationId, uniqueId, action, payload, activeTransactions, subprotocol = 'ocpp2.0.1' } = params;
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();
  const uiBroadcasts: Array<{ type: string; [key: string]: any }> = [];

  switch (action) {
    case 'BootNotification': {
      // In OCPP 2.0.1: { reason: "PowerUp", chargingStation: { vendorName, model, serialNumber, firmwareVersion } }
      const chargingStation = payload.chargingStation || {};
      const vendor = String(chargingStation.vendorName || payload.chargePointVendor || payload.vendor || 'Unknown Vendor');
      const model = String(chargingStation.model || payload.chargePointModel || payload.model || 'Unknown Model');
      const firmwareVersion = String(chargingStation.firmwareVersion || payload.firmwareVersion || 'v2.0.1');
      const serialNumber = chargingStation.serialNumber ? String(chargingStation.serialNumber) : undefined;

      uiBroadcasts.push({
        type: 'charger:updated',
        stationId,
        vendor,
        model,
        firmwareVersion,
        serialNumber,
        wsStatus: 'connected',
        ocppVersion: '2.0.1',
        subprotocol: 'ocpp2.0.1',
      });

      return {
        success: true,
        ocppProfile: 'ocpp2.0.1',
        ocppVersion: '2.0.1',
        action,
        uniqueId,
        responsePayload: {
          currentTime: nowIso,
          interval: 30,
          status: 'Accepted',
        },
        uiBroadcasts,
      };
    }

    case 'Heartbeat': {
      uiBroadcasts.push({
        type: 'charger:heartbeat',
        stationId,
        timestamp: nowIso,
        ocppVersion: '2.0.1',
      });

      return {
        success: true,
        ocppProfile: 'ocpp2.0.1',
        ocppVersion: '2.0.1',
        action,
        uniqueId,
        responsePayload: {
          currentTime: nowIso,
        },
        uiBroadcasts,
      };
    }

    case 'Authorize': {
      const idTokenObj = payload.idToken || {};
      const idToken = String(idTokenObj.idToken || payload.idTag || 'RFID-201');
      const tokenType = String(idTokenObj.type || 'ISO14443');

      return {
        success: true,
        ocppProfile: 'ocpp2.0.1',
        ocppVersion: '2.0.1',
        action,
        uniqueId,
        responsePayload: {
          idTokenInfo: {
            status: 'Accepted',
            type: tokenType,
          },
        },
        uiBroadcasts: [
          {
            type: 'charger:authorized',
            stationId,
            idTag: idToken,
            tokenType,
            status: 'Accepted',
            ocppVersion: '2.0.1',
          },
        ],
      };
    }

    case 'StatusNotification': {
      // In OCPP 2.0.1: { timestamp, connectorStatus, evseId, connectorId }
      const portNumber = extract201PortNumber(payload);
      const rawStatus = String(payload.connectorStatus || payload.status || 'Available');
      const status = normalize201Status(rawStatus);

      uiBroadcasts.push({
        type: 'connector:status',
        stationId,
        connectorId: portNumber,
        evseId: portNumber,
        status,
        errorCode: 'NoError',
        info: `OCPP 2.0.1 connectorStatus: ${rawStatus}`,
        ocppVersion: '2.0.1',
      });

      return {
        success: true,
        ocppProfile: 'ocpp2.0.1',
        ocppVersion: '2.0.1',
        action,
        uniqueId,
        responsePayload: {},
        uiBroadcasts,
      };
    }

    case 'TransactionEvent': {
      // Core OCPP 2.0.1 transaction management
      const eventType = String(payload.eventType || 'Updated');
      const transactionInfo = payload.transactionInfo || {};
      const txIdRaw = transactionInfo.transactionId || payload.transactionId;
      const transactionId =
        typeof txIdRaw === 'number'
          ? txIdRaw
          : parseInt(String(txIdRaw || '').replace(/\D/g, '') || String(Math.floor(100000 + Math.random() * 900000)), 10) || 100001;

      const portNumber = extract201PortNumber(payload);
      const idTokenObj = payload.idToken || {};
      const idTag = String(idTokenObj.idToken || payload.idTag || 'RFID-USER');
      const meterValues = payload.meterValue || payload.meterValues;

      let transactionUpdate: ParseResult['transactionUpdate'];

      if (eventType.toLowerCase() === 'started') {
        let meterStart = 0;
        if (Array.isArray(meterValues) && meterValues.length > 0) {
          const sampled = meterValues[0]?.sampledValue || [];
          const energySample = sampled.find((s: any) => String(s.measurand || '').toLowerCase().includes('energy'));
          if (energySample) {
            const val = parseFloat(energySample.value);
            if (!isNaN(val)) meterStart = val;
          }
        }

        const txState: OcppTransactionState = {
          transactionId,
          connectorId: portNumber,
          evseId: portNumber,
          idTag,
          startTime: nowIso,
          lastMeterValueTime: nowMs,
          meterStart,
          meterValuesCount: 0,
          chargingState: 'Charging',
        };

        uiBroadcasts.push({
          type: 'session:started',
          stationId,
          connectorId: portNumber,
          transactionId,
          idTag,
          meterStart,
          meterValuesCount: 0,
          ocppVersion: '2.0.1',
          timestamp: nowIso,
        });

        // Lifecycle rule: When transaction starts, state is Preparing until MeterValues / energy delivery begins
        uiBroadcasts.push({
          type: 'connector:status',
          stationId,
          connectorId: portNumber,
          status: 'Preparing',
          errorCode: 'NoError',
          info: 'OCPP 2.0.1: Transaction started; state is Preparing until MeterValues flow',
          ocppVersion: '2.0.1',
        });

        transactionUpdate = {
          action: 'start',
          transactionId,
          state: txState,
        };
      } else if (eventType.toLowerCase() === 'updated') {
        let matchedTx = activeTransactions.get(transactionId);
        if (!matchedTx) {
          for (const tx of activeTransactions.values()) {
            if (tx.connectorId === portNumber) {
              matchedTx = tx;
              break;
            }
          }
        }

        const count = matchedTx ? (matchedTx.meterValuesCount || 0) + 1 : 1;
        const chargingState = transactionInfo.chargingState ? String(transactionInfo.chargingState) : undefined;
        let mappedStatus = count >= 1 ? 'Charging' : 'Preparing';
        if (chargingState) {
          mappedStatus =
            chargingState === 'Charging'
              ? 'Charging'
              : chargingState === 'SuspendedEV' || chargingState === 'SuspendedEVSE'
                ? 'SuspendedEV'
                : chargingState === 'Idle'
                  ? 'Available'
                  : 'Preparing';
        }

        uiBroadcasts.push({
          type: 'connector:status',
          stationId,
          connectorId: portNumber,
          status: mappedStatus,
          errorCode: 'NoError',
          ocppVersion: '2.0.1',
        });

        transactionUpdate = matchedTx
          ? {
              action: 'update',
              transactionId: matchedTx.transactionId,
              state: {
                lastMeterValueTime: nowMs,
                meterValuesCount: count,
                chargingState: mappedStatus,
              },
            }
          : undefined;
      } else if (eventType.toLowerCase() === 'ended') {
        const activeTx = activeTransactions.get(transactionId);
        const resolvedConnectorId = activeTx ? activeTx.connectorId : portNumber;

        let meterStop: number | undefined;
        if (Array.isArray(meterValues) && meterValues.length > 0) {
          const sampled = meterValues[0]?.sampledValue || [];
          const energySample = sampled.find((s: any) => String(s.measurand || '').toLowerCase().includes('energy'));
          if (energySample) {
            const val = parseFloat(energySample.value);
            if (!isNaN(val)) meterStop = val;
          }
        }

        uiBroadcasts.push({
          type: 'session:stopped',
          stationId,
          connectorId: resolvedConnectorId,
          transactionId,
          meterStop,
          reason: transactionInfo.stoppedReason || payload.reason || 'Local',
          timestamp: nowIso,
          ocppVersion: '2.0.1',
        });

        uiBroadcasts.push({
          type: 'connector:status',
          stationId,
          connectorId: resolvedConnectorId,
          status: 'Available',
          errorCode: 'NoError',
          ocppVersion: '2.0.1',
        });

        transactionUpdate = {
          action: 'stop',
          transactionId,
        };
      }

      // Forward telemetry if meterValues included
      if (meterValues) {
        uiBroadcasts.push({
          type: 'telemetry:meter_values',
          stationId,
          connectorId: portNumber,
          transactionId,
          meterValues,
          ocppVersion: '2.0.1',
        });
      }

      return {
        success: true,
        ocppProfile: 'ocpp2.0.1',
        ocppVersion: '2.0.1',
        action,
        uniqueId,
        responsePayload: {
          totalCost: 0,
          idTokenInfo: {
            status: 'Accepted',
          },
        },
        uiBroadcasts,
        transactionUpdate,
      };
    }

    case 'MeterValues': {
      const portNumber = extract201PortNumber(payload);
      const meterValues = payload.meterValue || payload.meterValues;

      uiBroadcasts.push({
        type: 'telemetry:meter_values',
        stationId,
        connectorId: portNumber,
        meterValues,
        ocppVersion: '2.0.1',
      });

      return {
        success: true,
        ocppProfile: 'ocpp2.0.1',
        ocppVersion: '2.0.1',
        action,
        uniqueId,
        responsePayload: {},
        uiBroadcasts,
      };
    }

    case 'RequestStartTransaction': {
      return {
        success: true,
        ocppProfile: 'ocpp2.0.1',
        ocppVersion: '2.0.1',
        action,
        uniqueId,
        responsePayload: {
          status: 'Accepted',
        },
        uiBroadcasts: [],
      };
    }

    case 'RequestStopTransaction': {
      return {
        success: true,
        ocppProfile: 'ocpp2.0.1',
        ocppVersion: '2.0.1',
        action,
        uniqueId,
        responsePayload: {
          status: 'Accepted',
        },
        uiBroadcasts: [],
      };
    }

    case 'NotifyEvent':
    case 'NotifyReport': {
      return {
        success: true,
        ocppProfile: 'ocpp2.0.1',
        ocppVersion: '2.0.1',
        action,
        uniqueId,
        responsePayload: {},
        uiBroadcasts: [],
      };
    }

    case 'DataTransfer': {
      return {
        success: true,
        ocppProfile: 'ocpp2.0.1',
        ocppVersion: '2.0.1',
        action,
        uniqueId,
        responsePayload: {
          status: 'Accepted',
          data: 'CPMS_OCPP201_OK',
        },
        uiBroadcasts: [],
      };
    }

    // In case a legacy 1.6 StartTransaction is sent to a 2.0.1 socket
    case 'StartTransaction': {
      // Route gracefully to simulated 2.0.1 started event
      return parseOcpp201Message({
        stationId,
        uniqueId,
        action: 'TransactionEvent',
        payload: {
          eventType: 'Started',
          transactionInfo: { transactionId: payload.transactionId || Math.floor(100000 + Math.random() * 900000) },
          evse: { id: extract201PortNumber(payload), connectorId: 1 },
          idToken: { idToken: payload.idTag || 'RFID-TAG', type: 'ISO14443' },
          meterValue: [{ timestamp: nowIso, sampledValue: [{ value: payload.meterStart || 0, measurand: 'Energy.Active.Import.Register' }] }],
        },
        activeTransactions,
        subprotocol,
      });
    }

    case 'StopTransaction': {
      return parseOcpp201Message({
        stationId,
        uniqueId,
        action: 'TransactionEvent',
        payload: {
          eventType: 'Ended',
          transactionInfo: { transactionId: payload.transactionId, stoppedReason: payload.reason || 'Local' },
          meterValue: [{ timestamp: nowIso, sampledValue: [{ value: payload.meterStop || 0, measurand: 'Energy.Active.Import.Register' }] }],
        },
        activeTransactions,
        subprotocol,
      });
    }

    default: {
      return {
        success: true,
        ocppProfile: 'ocpp2.0.1',
        ocppVersion: '2.0.1',
        action,
        uniqueId,
        responsePayload: {},
        uiBroadcasts: [],
      };
    }
  }
}
