import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar, NavTab } from './components/Sidebar';
import { HomeOperationsView } from './components/HomeOperationsView';
import { ChargersFleetView } from './components/ChargersFleetView';
import { SessionsView } from './components/SessionsView';
import { SitesView } from './components/SitesView';
import { PricingView } from './components/PricingView';
import { RoamingView } from './components/RoamingView';
import { AdminUsersView } from './components/AdminUsersView';
import { SimulatorSettingsView } from './components/SimulatorSettingsView';
import { ChargerDetailDrawer } from './components/ChargerDetailDrawer';
import { DangerousActionModal } from './components/DangerousActionModal';
import { StartChargingModal } from './components/StartChargingModal';
import { AddChargerModal } from './components/AddChargerModal';
import { AddSiteModal } from './components/AddSiteModal';
import { EditChargerModal } from './components/EditChargerModal';
import { ConfirmDeleteModal } from './components/ConfirmDeleteModal';
import { ForceChangePasswordModal } from './components/ForceChangePasswordModal';
import { FirstTimeSetupModal } from './components/FirstTimeSetupModal';
import { LoginModal } from './components/LoginModal';
import {
  saveChargerToFirestore,
  deleteChargerFromFirestore,
  subscribeToFirestoreChargers,
} from './lib/chargersService';
import {
  saveSiteToFirestore,
  deleteSiteFromFirestore,
  subscribeToFirestoreSites,
} from './lib/sitesService';
import { useCpmsWebSocket, OnlineChargerSocketInfo } from './lib/useCpmsWebSocket';
import { useAuth } from './lib/AuthContext';
import {
  INITIAL_CHARGERS,
  INITIAL_SITES,
  INITIAL_SESSIONS,
  INITIAL_ALERTS,
  INITIAL_OCPP_MESSAGES,
} from './data/mockData';
import {
  ChargingStation,
  Site,
  Session,
  SystemAlert,
  OcppMessage,
  PortStatus,
  StopReason,
} from './types';

export default function App() {
  const {
    userProfile,
    currentAccount,
    isAdmin,
    mustChangePassword,
    isAdminPasswordChanged,
    isRegularLoginOpen,
    closeRegularLogin,
    openRegularLogin,
    activeInviteToken,
    clearActiveInvite,
    openInviteForToken,
  } = useAuth();
  const [isManualChangePassOpen, setIsManualChangePassOpen] = useState(false);
  const [chargers, setChargers] = useState<ChargingStation[]>(INITIAL_CHARGERS);
  const [sites, setSites] = useState<Site[]>(INITIAL_SITES);
  const [sessions, setSessions] = useState<Session[]>(INITIAL_SESSIONS);
  const [alerts, setAlerts] = useState<SystemAlert[]>(INITIAL_ALERTS);
  const [ocppMessages, setOcppMessages] = useState<OcppMessage[]>(INITIAL_OCPP_MESSAGES);

  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [selectedStation, setSelectedStation] = useState<ChargingStation | null>(null);

  // Security guard: Prohibit non-admin level users from viewing or navigating to the admin page
  useEffect(() => {
    if (currentTab === 'admin' && !isAdmin) {
      setCurrentTab('home');
    }
  }, [currentTab, isAdmin]);

  // Filters passed to ChargersFleetView
  const [chargersFilterStatus, setChargersFilterStatus] = useState<PortStatus | 'All'>('All');
  const [chargersSearchQuery, setChargersSearchQuery] = useState<string>('');

  // Add Modals state
  const [isAddChargerOpen, setIsAddChargerOpen] = useState(false);
  const [isAddSiteOpen, setIsAddSiteOpen] = useState(false);

  // Edit & Delete states for Charger
  const [editingStation, setEditingStation] = useState<ChargingStation | null>(null);
  const [deletingStation, setDeletingStation] = useState<ChargingStation | null>(null);

  // Modals
  const [dangerousModal, setDangerousModal] = useState<{
    isOpen: boolean;
    station: ChargingStation | null;
    actionType: 'HardReset' | 'StopCharging' | 'EmergencyTrip';
    portNumber?: number;
  }>({
    isOpen: false,
    station: null,
    actionType: 'HardReset',
  });

  const [startModal, setStartModal] = useState<{
    isOpen: boolean;
    station: ChargingStation | null;
    portNumber?: number;
  }>({
    isOpen: false,
    station: null,
    portNumber: 1,
  });

  // Real-time Full-Stack WebSocket stream for external chargers on the internet
  const {
    isWsConnected,
    isOcppServerActive,
    toggleOcppServer,
    onlineChargers,
    serverEndpoint,
    sendRemoteCommand,
  } = useCpmsWebSocket({
    onOcppMessageReceived: (msg) => {
      setOcppMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [msg, ...prev];
      });
      if (!msg.stationId) return;

      const stationId = msg.stationId;
      const action = String(msg.action || '');
      const payload = (msg.payload || {}) as Record<string, any>;

      // Directly follow state changes reported in OCPP messages from the charger
      if (action.includes('StatusNotification')) {
        const rawConnId =
          payload.connectorId !== undefined
            ? Number(payload.connectorId)
            : payload.evseId !== undefined
              ? Number(payload.evseId)
              : 1;
        const targetPort = isNaN(rawConnId) ? 1 : rawConnId;
        const rawStatus = String(
          payload.connectorStatus ||
          payload.status ||
          (payload.transactionInfo as any)?.chargingState ||
          'Available'
        ).trim().toLowerCase();

        let newStatus: PortStatus = 'Available';
        if (rawStatus.includes('charg')) newStatus = 'Charging';
        else if (rawStatus.includes('prepar') || rawStatus === 'occupied' || rawStatus.includes('evconnect')) newStatus = 'Occupied';
        else if (rawStatus.includes('suspendedevse') || rawStatus.includes('suspendedsystem')) newStatus = 'SuspendedSystem';
        else if (rawStatus.includes('suspendedev') || rawStatus.includes('suspended')) newStatus = 'SuspendedEV';
        else if (rawStatus.includes('finish')) newStatus = 'Finishing';
        else if (rawStatus.includes('fault')) newStatus = 'Faulted';
        else if (rawStatus.includes('unavail') || rawStatus.includes('offlin')) newStatus = 'Offline';
        else if (rawStatus.includes('reserv')) newStatus = 'Reserved';
        else if (rawStatus.includes('avail')) newStatus = 'Available';

        setChargers((prev) =>
          prev.map((c) => {
            if (c.id !== stationId) return c;
            const updatedEvses = c.evses.map((evse) => ({
              ...evse,
              connectors: evse.connectors.map((conn) => {
                const isTarget =
                  targetPort === 0
                    ? newStatus === 'Faulted' || newStatus === 'Offline'
                    : conn.portNumber === targetPort;
                if (!isTarget) return conn;
                const isCharging = newStatus === 'Charging';
                return {
                  ...conn,
                  status: newStatus,
                  currentPowerKw: isCharging
                    ? (conn.currentPowerKw > 0 ? conn.currentPowerKw : 0)
                    : 0,
                  cableLocked: isCharging || newStatus === 'Occupied' || newStatus === 'Finishing',
                  activeSessionId:
                    !isCharging && newStatus !== 'Occupied' && newStatus !== 'SuspendedEV'
                      ? undefined
                      : conn.activeSessionId,
                };
              }),
            }));

            const newTotalLoad = updatedEvses
              .flatMap((e) => e.connectors)
              .reduce((sum, conn) => sum + (conn.status === 'Charging' ? conn.currentPowerKw : 0), 0);

            return {
              ...c,
              wsStatus: 'connected',
              lastHeartbeatSecondsAgo: 0,
              currentLoadKw: newTotalLoad,
              evses: updatedEvses,
            };
          })
        );
      } else if (
        action.includes('TransactionEvent') &&
        String(payload.eventType || '').toLowerCase() === 'updated'
      ) {
        const rawConnId =
          payload.connectorId !== undefined
            ? Number(payload.connectorId)
            : payload.evseId !== undefined
              ? Number(payload.evseId)
              : 1;
        const targetPort = isNaN(rawConnId) || rawConnId <= 0 ? 1 : rawConnId;
        const chargingState = String(
          (payload.transactionInfo as any)?.chargingState || ''
        ).toLowerCase();

        let updatedStatus: PortStatus = 'Charging';
        if (chargingState.includes('charg')) updatedStatus = 'Charging';
        else if (chargingState.includes('evconnect') || chargingState.includes('prepar') || chargingState === 'occupied') updatedStatus = 'Occupied';
        else if (chargingState.includes('finish')) updatedStatus = 'Finishing';
        else if (chargingState.includes('suspendedevse') || chargingState.includes('suspendedsystem')) updatedStatus = 'SuspendedSystem';
        else if (chargingState.includes('suspended')) updatedStatus = 'SuspendedEV';
        else if (chargingState.includes('idle') || chargingState.includes('avail')) updatedStatus = 'Available';

        setChargers((prev) =>
          prev.map((c) => {
            if (c.id !== stationId) return c;
            const updatedEvses = c.evses.map((evse) => ({
              ...evse,
              connectors: evse.connectors.map((conn) => {
                if (conn.portNumber !== targetPort) return conn;
                const isCharging = updatedStatus === 'Charging';
                return {
                  ...conn,
                  status: updatedStatus,
                  currentPowerKw: isCharging
                    ? (conn.currentPowerKw > 0 ? conn.currentPowerKw : 0)
                    : 0,
                  cableLocked: isCharging || updatedStatus === 'Occupied' || updatedStatus === 'Finishing',
                };
              }),
            }));

            return {
              ...c,
              wsStatus: 'connected',
              lastHeartbeatSecondsAgo: 0,
              currentLoadKw: updatedEvses
                .flatMap((e) => e.connectors)
                .reduce((sum, conn) => sum + (conn.status === 'Charging' ? conn.currentPowerKw : 0), 0),
              evses: updatedEvses,
            };
          })
        );
      } else if (
        action.includes('StartTransaction') ||
        (action.includes('TransactionEvent') && String(payload.eventType || '').toLowerCase() === 'started')
      ) {
        const rawConnId =
          payload.connectorId !== undefined
            ? Number(payload.connectorId)
            : payload.evseId !== undefined
              ? Number(payload.evseId)
              : 1;
        const targetPort = isNaN(rawConnId) || rawConnId <= 0 ? 1 : rawConnId;

        setChargers((prev) =>
          prev.map((c) => {
            if (c.id !== stationId) return c;
            const updatedEvses = c.evses.map((evse) => ({
              ...evse,
              connectors: evse.connectors.map((conn) => {
                if (conn.portNumber !== targetPort) return conn;
                // Power starts at 0 kW until charger reports real Power.Active.Import via MeterValues
                const powerKw = conn.currentPowerKw > 0 ? conn.currentPowerKw : 0;
                return {
                  ...conn,
                  status: 'Charging' as PortStatus,
                  currentPowerKw: powerKw,
                  cableLocked: true,
                };
              }),
            }));

            return {
              ...c,
              wsStatus: 'connected',
              lastHeartbeatSecondsAgo: 0,
              currentLoadKw: updatedEvses
                .flatMap((e) => e.connectors)
                .reduce((sum, conn) => sum + (conn.status === 'Charging' ? conn.currentPowerKw : 0), 0),
              evses: updatedEvses,
            };
          })
        );
      } else if (
        action.includes('StopTransaction') ||
        (action.includes('TransactionEvent') && String(payload.eventType || '').toLowerCase() === 'ended')
      ) {
        const rawConnId =
          payload.connectorId !== undefined
            ? Number(payload.connectorId)
            : payload.evseId !== undefined
              ? Number(payload.evseId)
              : 1;
        const targetPort = isNaN(rawConnId) || rawConnId <= 0 ? 1 : rawConnId;

        setChargers((prev) =>
          prev.map((c) => {
            if (c.id !== stationId) return c;
            const updatedEvses = c.evses.map((evse) => ({
              ...evse,
              connectors: evse.connectors.map((conn) => {
                if (conn.portNumber !== targetPort) return conn;
                return {
                  ...conn,
                  status: 'Available' as PortStatus,
                  currentPowerKw: 0,
                  cableLocked: false,
                  activeSessionId: undefined,
                };
              }),
            }));

            return {
              ...c,
              wsStatus: 'connected',
              lastHeartbeatSecondsAgo: 0,
              currentLoadKw: updatedEvses
                .flatMap((e) => e.connectors)
                .reduce((sum, conn) => sum + (conn.status === 'Charging' ? conn.currentPowerKw : 0), 0),
              evses: updatedEvses,
            };
          })
        );
      } else {
        setChargers((prev) =>
          prev.map((c) =>
            c.id === stationId
              ? { ...c, wsStatus: 'connected', lastHeartbeatSecondsAgo: 0 }
              : c
          )
        );
      }
    },
    onChargerConnected: ({ stationId, ip, ocppVersion }) => {
      setChargers((prev) => {
        const existing = prev.find((c) => c.id === stationId);
        if (existing) {
          return prev.map((c) =>
            c.id === stationId
              ? {
                  ...c,
                  wsStatus: 'connected',
                  ipAddress: ip,
                  ocppVersion: (ocppVersion as any) || c.ocppVersion,
                  lastHeartbeatSecondsAgo: 0,
                }
              : c
          );
        }
        // Auto-register external physical charger into CPMS fleet
        const newDynamicCharger: ChargingStation = {
          id: stationId,
          name: `Internet Charger (${stationId})`,
          model: 'Internet-Connected EVSE',
          vendor: 'OCPP Client',
          siteId: sites[0]?.id || 'site-houston-03',
          siteName: sites[0]?.name || 'Energy Corridor Hub',
          type: 'DCFC',
          totalCapacityKw: 180,
          currentLoadKw: 0,
          isSimultaneous: true,
          isEmulated: false,
          wsStatus: 'connected',
          lastHeartbeatSecondsAgo: 0,
          ocppVersion: (ocppVersion as any) || '1.6-J',
          ipAddress: ip,
          evses: [
            {
              id: `EVSE-${stationId}-1`,
              evseNumber: 1,
              maxPowerKw: 180,
              currentLoadKw: 0,
              isMutuallyExclusive: false,
              connectors: [
                {
                  id: `CONN-${stationId}-1`,
                  evseId: `EVSE-${stationId}-1`,
                  portNumber: 1,
                  type: 'CCS1',
                  maxPowerKw: 180,
                  status: 'Available',
                  currentPowerKw: 0,
                  voltageV: 400,
                  currentA: 0,
                  cableLocked: false,
                },
              ],
            },
          ],
          health: {
            contactor: 'Open',
            cabinetTempC: 28,
            eStop: 'OK',
            groundFault: 'Clear',
            gunLock: 'Unlocked',
            lastError: 'NoError',
            lastErrorCode: '0x00',
            firmwareVersion: 'v1.0.0',
          },
        };
        return [newDynamicCharger, ...prev];
      });

      setAlerts((prev) => [
        {
          id: `ALT-WS-${Date.now()}`,
          severity: 'info',
          title: `Hardware Charger Connected via WebSocket: ${stationId}`,
          description: `Remote charger opened live WebSocket connection from ${ip} using ${ocppVersion}.`,
          timestamp: 'Just now',
          targetTab: 'chargers',
          targetStationId: stationId,
        },
        ...prev,
      ]);
    },
    onChargerDisconnected: (stationId) => {
      setChargers((prev) =>
        prev.map((c) =>
          c.id === stationId ? { ...c, wsStatus: 'disconnected', lastHeartbeatSecondsAgo: 999 } : c
        )
      );
    },
    onConnectorStatusChanged: ({ stationId, connectorId, status }) => {
      const raw = String(status || 'Available');
      const statusMap: Record<string, PortStatus> = {
        available: 'Available',
        charging: 'Charging',
        preparing: 'Occupied',
        occupied: 'Occupied',
        suspendedev: 'SuspendedEV',
        suspendedevse: 'SuspendedSystem',
        suspendedsystem: 'SuspendedSystem',
        finishing: 'Finishing',
        reserved: 'Reserved',
        unavailable: 'Offline',
        offline: 'Offline',
        faulted: 'Faulted',
        maintenance: 'Maintenance',
      };
      const normStatus: PortStatus = statusMap[raw.toLowerCase()] || (raw as PortStatus) || 'Available';

      setChargers((prev) =>
        prev.map((c) => {
          if (c.id !== stationId) return c;
          const updatedEvses = c.evses.map((evse) => ({
            ...evse,
            connectors: evse.connectors.map((conn) => {
              const isTarget =
                connectorId === 0
                  ? normStatus === 'Faulted' || normStatus === 'Offline'
                  : conn.portNumber === connectorId;
              if (!isTarget) return conn;

              const isCharging = normStatus === 'Charging';
              const newPower = isCharging
                ? (conn.currentPowerKw > 0 ? conn.currentPowerKw : 0)
                : 0;

              return {
                ...conn,
                status: normStatus,
                currentPowerKw: newPower,
                cableLocked: isCharging || normStatus === 'Occupied' || normStatus === 'Preparing' || normStatus === 'Finishing',
                activeSessionId:
                  !isCharging && normStatus !== 'Occupied' && normStatus !== 'Preparing' && normStatus !== 'SuspendedEV' && normStatus !== 'SuspendedSystem'
                    ? undefined
                    : conn.activeSessionId,
              };
            }),
          }));

          const newTotalLoad = updatedEvses
            .flatMap((e) => e.connectors)
            .reduce((sum, conn) => sum + (conn.status === 'Charging' ? conn.currentPowerKw : 0), 0);

          return {
            ...c,
            wsStatus: 'connected',
            lastHeartbeatSecondsAgo: 0,
            currentLoadKw: newTotalLoad,
            evses: updatedEvses,
          };
        })
      );
    },
    onTelemetryReceived: ({ stationId, connectorId, transactionId, meterValues }) => {
      const mvList = Array.isArray(meterValues) ? meterValues : meterValues ? [meterValues] : [];
      if (mvList.length === 0) return;

      let kw: number | undefined;
      let soc: number | undefined;
      let v: number | undefined;
      let a: number | undefined;
      let energyRegisterKwh: number | undefined;
      let energyIntervalKwh: number | undefined;

      for (const mv of mvList) {
        const sampled = Array.isArray(mv.sampledValue) ? mv.sampledValue : [];
        for (const s of sampled) {
          const rawMeas = String(s.measurand || '').trim();
          const meas = rawMeas.toLowerCase();
          const unit = String(s.unit || s.unitOfMeasure?.unit || '').toLowerCase().trim();
          const multiplier = typeof s.unitOfMeasure?.multiplier === 'number' ? s.unitOfMeasure.multiplier : 0;
          let val = typeof s.value === 'number' ? s.value : parseFloat(String(s.value || ''));
          if (isNaN(val)) continue;

          if (multiplier !== 0) {
            val = val * Math.pow(10, multiplier);
          }

          // Per OCPP 1.6 & 2.0.1: default measurand when omitted is 'Energy.Active.Import.Register'
          if (
            meas === '' ||
            meas === 'energy.active.import.register' ||
            meas === 'energy.active.import' ||
            meas === 'energy' ||
            (meas.includes('energy') && !meas.includes('interval') && !meas.includes('power'))
          ) {
            // Energy register reading
            // Default unit in OCPP is 'Wh'. If unit is 'kwh', it's kWh. If 'wh' or default or val > 500, convert from Wh.
            if (unit === 'kwh') {
              energyRegisterKwh = val;
            } else if (unit === 'wh' || val > 500) {
              energyRegisterKwh = val / 1000;
            } else {
              energyRegisterKwh = val;
            }
          } else if (meas.includes('interval')) {
            energyIntervalKwh = unit === 'kwh' ? val : (unit === 'wh' || val > 500) ? val / 1000 : val;
          } else if (
            meas.includes('power.active') ||
            meas.includes('power.offered') ||
            meas === 'power'
          ) {
            const isWatts = unit === 'w' || unit === 'va' || unit === 'var' || (unit !== 'kw' && val > 1000);
            kw = isWatts ? val / 1000 : val;
          } else if (
            meas.includes('soc') ||
            meas.includes('stateofcharge') ||
            meas === 'percent' ||
            unit.includes('percent') ||
            unit === '%'
          ) {
            soc = val;
          } else if (meas.includes('voltage')) {
            v = val;
          } else if (meas.includes('current')) {
            a = val;
          }
        }

        // Direct fallback fields if passed on mv
        if (soc === undefined && typeof (mv as any).soc === 'number') {
          soc = (mv as any).soc;
        }
        if (kw === undefined && typeof (mv as any).powerKw === 'number') {
          kw = (mv as any).powerKw;
        }
        if (energyRegisterKwh === undefined && typeof (mv as any).energyKwh === 'number') {
          energyRegisterKwh = (mv as any).energyKwh;
        }
      }

      setChargers((prev) =>
        prev.map((c) => {
          if (c.id !== stationId) return c;
          return {
            ...c,
            wsStatus: 'connected',
            lastHeartbeatSecondsAgo: 0,
            currentLoadKw: kw !== undefined ? kw : c.currentLoadKw,
            evses: c.evses.map((evse) => ({
              ...evse,
              connectors: evse.connectors.map((conn) => {
                const isTarget = connectorId ? conn.portNumber === connectorId : conn.portNumber === 1;
                if (!isTarget) return conn;
                const newStatus: PortStatus =
                  conn.status === 'Faulted'
                    ? 'Faulted'
                    : kw !== undefined && kw > 0.1
                      ? 'Charging'
                      : conn.status;
                return {
                  ...conn,
                  status: newStatus,
                  currentPowerKw: kw !== undefined ? kw : conn.currentPowerKw,
                  currentSoc: soc !== undefined ? soc : conn.currentSoc,
                  voltageV: v !== undefined ? v : conn.voltageV,
                  currentA: a !== undefined ? a : conn.currentA,
                };
              }),
            })),
          };
        })
      );

      // Update active session metrics: energy delivered and cost are ALWAYS calculated by the last MeterValue from the charger
      setSessions((prev) =>
        prev.map((s) => {
          const matchTx = transactionId ? s.id.includes(String(transactionId)) : s.stationId === stationId;
          if (matchTx && s.status === 'active') {
            const currentPower = kw !== undefined ? kw : s.currentKw;
            const peakPower = Math.max(s.peakKw, currentPower);
            const newSoc = soc !== undefined ? soc : s.socCurrent;

            // Calculate delivered energy strictly from this MeterValue message
            let newEnergyKwh = s.energyKwh;
            if (energyRegisterKwh !== undefined) {
              let startKwh = 0;
              if (s.meterStart !== undefined && s.meterStart > 0) {
                startKwh = s.meterStart > 500 ? s.meterStart / 1000 : s.meterStart;
              }
              if (energyRegisterKwh >= startKwh) {
                newEnergyKwh = Number((energyRegisterKwh - startKwh).toFixed(2));
              } else {
                newEnergyKwh = Number(energyRegisterKwh.toFixed(2));
              }
            } else if (energyIntervalKwh !== undefined) {
              newEnergyKwh = Number((s.energyKwh + energyIntervalKwh).toFixed(2));
            }

            // Calculate cost strictly from delivered energy using standard rate ($0.49/kWh)
            const rate = 0.49;
            const newCost = Number((newEnergyKwh * rate).toFixed(2));

            return {
              ...s,
              currentKw: currentPower,
              peakKw: peakPower,
              socCurrent: newSoc,
              energyKwh: newEnergyKwh,
              costTotal: newCost,
              costBreakdown: {
                ...s.costBreakdown,
                energyFee: newCost,
              },
              lastMeterValueTimestamp: Date.now(),
              lastMeterRegister: energyRegisterKwh,
            };
          }
          return s;
        })
      );
    },
    onHeartbeatReceived: ({ stationId }) => {
      setChargers((prev) =>
        prev.map((c) =>
          c.id === stationId
            ? { ...c, wsStatus: 'connected', lastHeartbeatSecondsAgo: 0 }
            : c
        )
      );
    },
    onSessionStarted: ({ stationId, connectorId, transactionId, idTag, meterStart }) => {
      const portNumber = connectorId || 1;
      const targetStation = chargers.find((c) => c.id === stationId);
      const targetConn = targetStation?.evses.flatMap((e) => e.connectors).find((c) => c.portNumber === portNumber);
      const rawMeterStart = meterStart !== undefined ? Number(meterStart) : 0;

      const newLiveSession: Session = {
        id: `TXN-${transactionId || Math.floor(100000 + Math.random() * 900000)}`,
        stationId,
        stationName: targetStation?.name || `Station ${stationId}`,
        evseId: targetStation?.evses[0]?.id || `EVSE-${stationId}-1`,
        portNumber,
        connectorType: targetConn?.type || (targetStation?.type === 'DCFC' ? 'CCS1' : 'J1772'),
        siteId: targetStation?.siteId || sites[0]?.id || 'site-main',
        siteName: targetStation?.siteName || sites[0]?.name || 'Main Charging Hub',
        userTag: idTag || 'RFID-USER',
        authMethod: idTag?.startsWith('APP') ? 'App' : 'RFID',
        vehicleModel: targetStation?.type === 'DCFC' ? 'Connected EV (DC Fast)' : 'Connected EV (Level 2)',
        startTime: new Date().toISOString(),
        durationMinutes: 0,
        energyKwh: 0,
        // Start power strictly at 0 kW (or last known real reading); never invent 120 kW phantom power
        currentKw: targetConn?.currentPowerKw && targetConn.currentPowerKw > 0 ? targetConn.currentPowerKw : 0,
        peakKw: targetConn?.currentPowerKw && targetConn.currentPowerKw > 0 ? targetConn.currentPowerKw : 0,
        status: 'active',
        costTotal: 0,
        costBreakdown: {
          energyFee: 0,
          timeFee: 0,
          idleFee: 0,
        },
        socStart: targetConn?.currentSoc || 25,
        socCurrent: targetConn?.currentSoc || 25,
        meterStart: rawMeterStart,
        lastMeterValueTimestamp: Date.now(),
      };

      setSessions((prev) => [newLiveSession, ...prev]);

      setChargers((prev) =>
        prev.map((c) => {
          if (c.id !== stationId) return c;
          return {
            ...c,
            wsStatus: 'connected',
            lastHeartbeatSecondsAgo: 0,
            currentLoadKw: newLiveSession.currentKw,
            evses: c.evses.map((evse) => ({
              ...evse,
              connectors: evse.connectors.map((conn) =>
                conn.portNumber === portNumber
                  ? {
                      ...conn,
                      status: 'Charging' as PortStatus,
                      currentPowerKw: newLiveSession.currentKw,
                      activeSessionId: newLiveSession.id,
                    }
                  : conn
              ),
            })),
          };
        })
      );
    },
    onSessionStopped: ({ stationId, transactionId, meterStop, reason }) => {
      setSessions((prev) =>
        prev.map((s) => {
          const matchTx = transactionId ? s.id.includes(String(transactionId)) : s.stationId === stationId && s.status === 'active';
          if (matchTx && s.status === 'active') {
            const startMs = new Date(s.startTime).getTime();
            const durationMin = Math.max(1, Math.round((Date.now() - startMs) / 60000));
            let finalEnergy = s.energyKwh;
            if (meterStop !== undefined && Number(meterStop) > 0) {
              const stopRaw = Number(meterStop);
              const stopKwh = stopRaw > 500 ? stopRaw / 1000 : stopRaw;
              let startKwh = 0;
              if (s.meterStart !== undefined && s.meterStart > 0) {
                startKwh = s.meterStart > 500 ? s.meterStart / 1000 : s.meterStart;
              }
              if (stopKwh >= startKwh) {
                finalEnergy = stopKwh - startKwh;
              } else {
                finalEnergy = stopKwh;
              }
            }
            const rate = 0.49;
            const cost = Number((finalEnergy * rate).toFixed(2));
            return {
              ...s,
              status: 'completed',
              endTime: new Date().toISOString(),
              durationMinutes: durationMin,
              energyKwh: Number(finalEnergy.toFixed(2)),
              currentKw: 0,
              stopReason: (reason as StopReason) || 'Remote',
              costTotal: cost,
              costBreakdown: {
                energyFee: cost,
                timeFee: 0,
                idleFee: 0,
              },
            };
          }
          return s;
        })
      );

      setChargers((prev) =>
        prev.map((c) => {
          if (c.id !== stationId) return c;
          return {
            ...c,
            wsStatus: 'connected',
            lastHeartbeatSecondsAgo: 0,
            currentLoadKw: 0,
            evses: c.evses.map((evse) => ({
              ...evse,
              connectors: evse.connectors.map((conn) =>
                conn.status === 'Charging'
                  ? { ...conn, status: 'Available' as PortStatus, currentPowerKw: 0, activeSessionId: undefined }
                  : conn
              ),
            })),
          };
        })
      );
    },
  });

  // Real-time Firestore sync for persisted chargers
  useEffect(() => {
    const onlineMap = new Map<string, OnlineChargerSocketInfo>();
    onlineChargers.forEach((c) => onlineMap.set(c.stationId, c));
    const unsubscribe = subscribeToFirestoreChargers((dbChargers) => {
      setChargers((prev) => {
        const adjustedDb = dbChargers.map((c) => {
          const existing = prev.find((p) => p.id === c.id);
          const socket = onlineMap.get(c.id);
          const isLiveSocket = !!socket;
          return {
            ...c,
            wsStatus: isLiveSocket
              ? ('connected' as const)
              : existing?.wsStatus || c.wsStatus || ('disconnected' as const),
            lastHeartbeatSecondsAgo: isLiveSocket ? 0 : existing?.lastHeartbeatSecondsAgo ?? c.lastHeartbeatSecondsAgo ?? 999,
            currentLoadKw: existing?.currentLoadKw ?? c.currentLoadKw,
            evses: c.evses.map((evse, eIdx) => {
              const existingEvse = existing?.evses[eIdx];
              return {
                ...evse,
                currentLoadKw: existingEvse?.currentLoadKw ?? evse.currentLoadKw,
                connectors: evse.connectors.map((conn, cIdx) => {
                  const existingConn =
                    existingEvse?.connectors[cIdx] ||
                    existing?.evses.flatMap((e) => e.connectors).find((cn) => cn.portNumber === conn.portNumber);
                  const baseStatus = existingConn?.status || conn.status;
                  const normalizedStatus: PortStatus =
                    baseStatus === 'Preparing' ? 'Occupied' : (baseStatus as PortStatus);
                  if (existingConn) {
                    return {
                      ...conn,
                      status: normalizedStatus,
                      currentPowerKw: existingConn.currentPowerKw,
                      currentSoc: existingConn.currentSoc ?? conn.currentSoc,
                      activeSessionId: existingConn.activeSessionId ?? conn.activeSessionId,
                      cableLocked: existingConn.cableLocked ?? conn.cableLocked,
                    };
                  }
                  return {
                    ...conn,
                    status: normalizedStatus,
                  };
                }),
              };
            }),
          };
        });
        const dbIds = new Set(adjustedDb.map((c) => c.id));
        const liveSockets = prev.filter((c) => !dbIds.has(c.id) && c.wsStatus === 'connected');
        return [...adjustedDb, ...liveSockets];
      });
    });

    return () => unsubscribe();
  }, [onlineChargers]);

  // Synchronize live WebSocket online state with fleet chargers and calculate real elapsed heartbeat seconds
  useEffect(() => {
    const updateRealConnectionStates = () => {
      const now = Date.now();
      const onlineMap = new Map<string, OnlineChargerSocketInfo>();
      onlineChargers.forEach((c) => onlineMap.set(c.stationId, c));

      setChargers((prev) => {
        let changed = false;
        const next = prev.map((charger) => {
          const socketInfo = onlineMap.get(charger.id);
          if (socketInfo) {
            const lastPingTime = socketInfo.lastPing ? new Date(socketInfo.lastPing).getTime() : now;
            const elapsed = Math.max(0, Math.floor((now - lastPingTime) / 1000));
            const realWsStatus = elapsed > 35 ? ('lag' as const) : ('connected' as const);

            if (
              charger.wsStatus !== realWsStatus ||
              charger.lastHeartbeatSecondsAgo !== elapsed ||
              charger.ipAddress !== (socketInfo.ip || charger.ipAddress)
            ) {
              changed = true;
              return {
                ...charger,
                wsStatus: realWsStatus,
                lastHeartbeatSecondsAgo: elapsed,
                ipAddress: socketInfo.ip || charger.ipAddress,
              };
            }
          } else if (charger.wsStatus === 'connected' || charger.wsStatus === 'lag') {
            changed = true;
            return {
              ...charger,
              wsStatus: 'disconnected' as const,
              lastHeartbeatSecondsAgo:
                charger.lastHeartbeatSecondsAgo < 999
                  ? charger.lastHeartbeatSecondsAgo + 1
                  : 999,
            };
          }
          return charger;
        });

        return changed ? next : prev;
      });
    };

    updateRealConnectionStates();
    const ticker = setInterval(updateRealConnectionStates, 1000);
    return () => clearInterval(ticker);
  }, [onlineChargers]);

  // Real-time Firestore sync for persisted sites
  useEffect(() => {
    const unsubscribe = subscribeToFirestoreSites((dbSites) => {
      setSites(
        dbSites.map((s) => ({
          ...s,
          totalChargers: chargers.filter(
            (c) => c.siteId === s.id || (c.siteName && s.name && c.siteName.toLowerCase() === s.name.toLowerCase())
          ).length,
        }))
      );
    });

    return () => unsubscribe();
  }, [chargers]);

  // Synchronize site charger counts whenever fleet chargers change
  useEffect(() => {
    setSites((prevSites) =>
      prevSites.map((s) => {
        const count = chargers.filter(
          (c) => c.siteId === s.id || (c.siteName && s.name && c.siteName.toLowerCase() === s.name.toLowerCase())
        ).length;
        if (s.totalChargers !== count) {
          return { ...s, totalChargers: count };
        }
        return s;
      })
    );
  }, [chargers]);

  // Real-time live session timeout monitor: 1 min timeout without MeterValues
  useEffect(() => {
    const sessionTicker = setInterval(() => {
      const now = Date.now();
      const timedOutSessions: { stationId: string; portNumber: number; sessionId: string }[] = [];

      setSessions((prev) => {
        const hasActive = prev.some((s) => s.status === 'active');
        if (!hasActive) return prev;

        return prev.map((s) => {
          if (s.status !== 'active') return s;
          const startMs = new Date(s.startTime).getTime();
          const elapsedSec = Math.max(1, Math.floor((now - startMs) / 1000));
          const elapsedMin = Math.floor(elapsedSec / 60);

          // Check time since last MeterValue (or session start if no MeterValue received yet)
          const lastMvTime = s.lastMeterValueTimestamp || startMs;
          const msSinceLastMeterValue = now - lastMvTime;

          // 1 minute timeout (60,000 ms) without any MeterValue message from the charger
          if (msSinceLastMeterValue >= 60000) {
            timedOutSessions.push({
              stationId: s.stationId,
              portNumber: s.portNumber,
              sessionId: s.id,
            });

            return {
              ...s,
              status: 'completed' as const,
              stopReason: 'Timeout' as const,
              endTime: new Date().toISOString(),
              durationMinutes: Math.max(1, elapsedMin),
              currentKw: 0,
              // Note: Energy and cost remain strictly as calculated from the last MeterValue from the charger
            };
          }

          // Within 1 min: keep the charging state!
          // Real-time duration ticks, but energy delivered and cost are strictly calculated from MeterValues
          return {
            ...s,
            durationMinutes: elapsedMin,
          };
        });
      });

      // Free up charger ports when sessions time out after 1 min with no MeterValues
      if (timedOutSessions.length > 0) {
        setChargers((prev) =>
          prev.map((charger) => {
            const matches = timedOutSessions.filter((t) => t.stationId === charger.id);
            if (matches.length === 0) return charger;
            const timedOutPorts = new Set(matches.map((m) => m.portNumber));

            return {
              ...charger,
              currentLoadKw: 0,
              evses: charger.evses.map((evse) => ({
                ...evse,
                connectors: evse.connectors.map((conn) => {
                  if (timedOutPorts.has(conn.portNumber)) {
                    return {
                      ...conn,
                      status: 'Available' as PortStatus,
                      currentPowerKw: 0,
                      activeSessionId: undefined,
                      cableLocked: false,
                    };
                  }
                  return conn;
                }),
              })),
            };
          })
        );
      }
    }, 1000);

    return () => clearInterval(sessionTicker);
  }, []);

  // Keep selectedStation synced with state
  useEffect(() => {
    if (selectedStation) {
      const updated = chargers.find((c) => c.id === selectedStation.id);
      if (updated && updated !== selectedStation) {
        setSelectedStation(updated);
      }
    }
  }, [chargers, selectedStation]);

  // Helper to append OCPP message
  const logOcppMessage = useCallback(
    (
      stationId: string,
      direction: 'CP_TO_CS' | 'CS_TO_CP',
      action: string,
      payload: Record<string, unknown>
    ) => {
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];
      const newMsg: OcppMessage = {
        id: `OCPP-${Date.now().toString().slice(-4)}`,
        timestamp: timeStr,
        stationId,
        direction,
        action,
        messageTypeId: direction === 'CP_TO_CS' ? 2 : 3,
        payload,
      };
      setOcppMessages((prev) => [newMsg, ...prev]);
    },
    []
  );

  // Triggering actions from Drawer
  const handleTriggerAction = (
    action: 'SoftReset' | 'HardReset' | 'StopCharging' | 'StartCharging' | 'UnlockCable' | 'ToggleMaintenance',
    portNumber: number = 1
  ) => {
    if (!selectedStation) return;

    if (action === 'HardReset') {
      setDangerousModal({
        isOpen: true,
        station: selectedStation,
        actionType: 'HardReset',
        portNumber,
      });
      return;
    }

    if (action === 'StopCharging') {
      setDangerousModal({
        isOpen: true,
        station: selectedStation,
        actionType: 'StopCharging',
        portNumber,
      });
      return;
    }

    if (action === 'StartCharging') {
      setStartModal({
        isOpen: true,
        station: selectedStation,
        portNumber,
      });
      return;
    }

    if (action === 'SoftReset') {
      sendRemoteCommand(selectedStation.id, 'Reset', { type: 'Soft' });
      logOcppMessage(selectedStation.id, 'CS_TO_CP', 'Reset', { type: 'Soft' });
      logOcppMessage(selectedStation.id, 'CP_TO_CS', 'ResetResponse', { status: 'Accepted' });
      setAlerts((prev) => [
        {
          id: `ALT-RST-${Date.now()}`,
          severity: 'info',
          title: `Soft Reset Dispatched`,
          description: `Soft reset command issued to ${selectedStation.id} via WebSocket. Microcontroller restarted safely.`,
          timestamp: 'Just now',
          targetTab: 'chargers',
          targetStationId: selectedStation.id,
        },
        ...prev,
      ]);
    }

    if (action === 'UnlockCable') {
      sendRemoteCommand(selectedStation.id, 'UnlockConnector', { connectorId: portNumber });
      logOcppMessage(selectedStation.id, 'CS_TO_CP', 'UnlockConnector', {
        connectorId: portNumber,
      });
      logOcppMessage(selectedStation.id, 'CP_TO_CS', 'UnlockConnectorResponse', {
        status: 'Unlocked',
      });

      // Update state
      setChargers((prev) =>
        prev.map((c) => {
          if (c.id !== selectedStation.id) return c;
          return {
            ...c,
            evses: c.evses.map((evse) => ({
              ...evse,
              connectors: evse.connectors.map((conn) => {
                if (conn.portNumber === portNumber) {
                  return { ...conn, cableLocked: false };
                }
                return conn;
              }),
            })),
          };
        })
      );
    }

    if (action === 'ToggleMaintenance') {
      setChargers((prev) =>
        prev.map((c) => {
          if (c.id !== selectedStation.id) return c;
          const currentStatus = c.evses[0]?.connectors[0]?.status;
          const newStatus: PortStatus = currentStatus === 'Maintenance' ? 'Available' : 'Maintenance';
          return {
            ...c,
            evses: c.evses.map((evse) => ({
              ...evse,
              connectors: evse.connectors.map((conn) => ({
                ...conn,
                status: newStatus,
                currentPowerKw: 0,
              })),
            })),
          };
        })
      );
    }
  };

  // Add / Commission new EV Charger with Webhook and Database persistence
  const handleAddCharger = async (newCharger: ChargingStation) => {
    // 1. Save to Firestore database
    await saveChargerToFirestore(newCharger, userProfile?.uid, userProfile?.email);

    // 2. Update local state
    setChargers((prev) => [newCharger, ...prev.filter((c) => c.id !== newCharger.id)]);

    // 3. Log initial BootNotification & Webhook Registration in OCPP stream
    const now = new Date();
    logOcppMessage(newCharger.id, 'CP_TO_CS', 'BootNotification', {
      chargePointVendor: newCharger.vendor,
      chargePointModel: newCharger.model,
      chargePointSerialNumber: `SN-${newCharger.id}-HW`,
      firmwareVersion: newCharger.health.firmwareVersion,
      iccid: '89014103211118510720',
      imsi: '310410123456789',
      meterType: newCharger.type === 'DCFC' ? 'DC-BiDirectional' : 'AC-RevenueGrade',
      webhookEndpoint: newCharger.webhookUrl,
      connectionMode: newCharger.cloudConnectionMode,
    });

    logOcppMessage(newCharger.id, 'CS_TO_CP', 'BootNotificationResponse', {
      status: 'Accepted',
      currentTime: now.toISOString(),
      interval: 10,
      heartbeatInterval: 10,
    });

    // 4. Update Site totalChargers count
    setSites((prev) =>
      prev.map((s) => {
        if (s.id === newCharger.siteId) {
          return { ...s, totalChargers: (s.totalChargers || 0) + 1 };
        }
        return s;
      })
    );

    // 5. Add notification alert
    setAlerts((prev) => [
      {
        id: `ALT-NEW-${Date.now()}`,
        severity: 'info',
        title: `Charger ${newCharger.id} Commissioned`,
        description: `${newCharger.name} (${newCharger.type}, ${newCharger.totalCapacityKw} kW) registered and saved in database with webhook bridge.`,
        timestamp: 'Just now',
        targetTab: 'chargers',
        targetStationId: newCharger.id,
      },
      ...prev,
    ]);
  };

  // Update existing charger in Firestore and state
  const handleUpdateCharger = async (updatedCharger: ChargingStation) => {
    try {
      await saveChargerToFirestore(updatedCharger, userProfile?.uid, userProfile?.email);
    } catch (err) {
      console.warn('Could not save charger update to Firestore:', err);
    }

    setChargers((prev) => prev.map((c) => (c.id === updatedCharger.id ? updatedCharger : c)));
    if (selectedStation?.id === updatedCharger.id) {
      setSelectedStation(updatedCharger);
    }

    setAlerts((prev) => [
      {
        id: `ALT-CHG-UPD-${Date.now()}`,
        severity: 'info',
        title: `Charger ${updatedCharger.id} Configuration Updated`,
        description: `${updatedCharger.name} (${updatedCharger.type}, ${updatedCharger.totalCapacityKw} kW) updated successfully.`,
        timestamp: 'Just now',
        targetTab: 'chargers',
        targetStationId: updatedCharger.id,
      },
      ...prev,
    ]);
  };

  // Delete / Decommission charger
  const handleDeleteCharger = async (stationId: string) => {
    try {
      await deleteChargerFromFirestore(stationId);
    } catch (err) {
      console.warn('Could not delete from Firestore (might be mock station):', err);
    }

    // Decrement site totalChargers count
    const targetCharger = chargers.find((c) => c.id === stationId);
    if (targetCharger?.siteId) {
      setSites((prev) =>
        prev.map((s) =>
          s.id === targetCharger.siteId
            ? { ...s, totalChargers: Math.max(0, (s.totalChargers || 1) - 1) }
            : s
        )
      );
    }

    setChargers((prev) => prev.filter((c) => c.id !== stationId));
    if (selectedStation?.id === stationId) {
      setSelectedStation(null);
    }

    setAlerts((prev) => [
      {
        id: `ALT-DEL-${Date.now()}`,
        severity: 'warning',
        title: `Charger ${stationId} Decommissioned`,
        description: `Charger record ${stationId} has been decommissioned from CPMS and removed from database.`,
        timestamp: 'Just now',
        targetTab: 'chargers',
      },
      ...prev,
    ]);
  };

  // Add new charging site to Firestore database and local state
  const handleAddSite = async (newSite: Site) => {
    await saveSiteToFirestore(newSite, userProfile?.uid, userProfile?.email);
    setSites((prev) => [newSite, ...prev.filter((s) => s.id !== newSite.id)]);
    setAlerts((prev) => [
      {
        id: `ALT-SITE-${Date.now()}`,
        severity: 'info',
        title: `Site ${newSite.name} Registered`,
        description: `Site located at ${newSite.address}, ${newSite.city}, ${newSite.state} registered with ${newSite.transformerLimitKw} kW utility transformer limit.`,
        timestamp: 'Just now',
        targetTab: 'sites',
      },
      ...prev,
    ]);
  };

  // Update existing charging site in Firestore and state
  const handleUpdateSite = async (updatedSite: Site) => {
    try {
      await saveSiteToFirestore(updatedSite, userProfile?.uid, userProfile?.email);
    } catch (err) {
      console.warn('Could not save site update to Firestore:', err);
    }

    setSites((prev) => prev.map((s) => (s.id === updatedSite.id ? updatedSite : s)));
    setChargers((prev) =>
      prev.map((c) => (c.siteId === updatedSite.id ? { ...c, siteName: updatedSite.name } : c))
    );

    setAlerts((prev) => [
      {
        id: `ALT-SITE-UPD-${Date.now()}`,
        severity: 'info',
        title: `Site ${updatedSite.name} Updated`,
        description: `Site electrical service (${updatedSite.transformerLimitKw} kW limit) updated in database.`,
        timestamp: 'Just now',
        targetTab: 'sites',
      },
      ...prev,
    ]);
  };

  // Delete / decommission site from Firestore
  const handleDeleteSite = async (siteId: string) => {
    const targetSite = sites.find((s) => s.id === siteId);
    const assignedChargers = chargers.filter(
      (c) => c.siteId === siteId || (targetSite && c.siteName && targetSite.name && c.siteName.toLowerCase() === targetSite.name.toLowerCase())
    );
    if (assignedChargers.length > 0) {
      setAlerts((prev) => [
        {
          id: `ALT-ERR-SITE-${Date.now()}`,
          severity: 'critical',
          title: 'Cannot Decommission Site',
          description: `Site ${targetSite?.name || siteId} has ${assignedChargers.length} active charger(s) assigned in database. A site can only be decommissioned when it has zero chargers.`,
          timestamp: 'Just now',
          targetTab: 'sites',
        },
        ...prev,
      ]);
      return;
    }

    try {
      await deleteSiteFromFirestore(siteId);
    } catch (err) {
      console.warn('Could not delete site from Firestore:', err);
    }
    setSites((prev) => prev.filter((s) => s.id !== siteId));
    setAlerts((prev) => [
      {
        id: `ALT-DEL-SITE-${Date.now()}`,
        severity: 'warning',
        title: `Site Decommissioned`,
        description: `Site record ${siteId} has been decommissioned from CPMS and removed from database.`,
        timestamp: 'Just now',
        targetTab: 'sites',
      },
      ...prev,
    ]);
  };

  // Execute Dangerous Action
  const handleExecuteDangerousAction = () => {
    if (!dangerousModal.station) return;
    const stationId = dangerousModal.station.id;
    const isHardReset = dangerousModal.actionType === 'HardReset';
    const isStop = dangerousModal.actionType === 'StopCharging';

    if (isHardReset) {
      sendRemoteCommand(stationId, 'Reset', { type: 'Hard' });
      logOcppMessage(stationId, 'CS_TO_CP', 'Reset', { type: 'Hard' });
      logOcppMessage(stationId, 'CP_TO_CS', 'ResetResponse', { status: 'Accepted' });
      logOcppMessage(stationId, 'CP_TO_CS', 'BootNotification', {
        chargePointModel: dangerousModal.station.model,
        chargePointVendor: dangerousModal.station.vendor,
        firmwareVersion: dangerousModal.station.health.firmwareVersion,
      });

      setChargers((prev) =>
        prev.map((c) => {
          if (c.id !== stationId) return c;
          return {
            ...c,
            currentLoadKw: 0,
            health: {
              ...c.health,
              contactor: 'Open',
              lastError: 'NoError (Rebooted)',
              lastErrorCode: '0x00',
            },
            evses: c.evses.map((evse) => ({
              ...evse,
              currentLoadKw: 0,
              connectors: evse.connectors.map((conn) => ({
                ...conn,
                status: 'Available',
                currentPowerKw: 0,
                cableLocked: false,
                activeSessionId: undefined,
              })),
            })),
          };
        })
      );
    } else if (isStop) {
      sendRemoteCommand(stationId, 'RemoteStopTransaction', { transactionId: 9821 });
      logOcppMessage(stationId, 'CS_TO_CP', 'RemoteStopTransaction', {
        transactionId: 9821,
      });
      logOcppMessage(stationId, 'CP_TO_CS', 'StopTransaction', {
        idTag: 'REMOTE-STOP',
        reason: 'Remote',
        meterStop: 54200,
        timestamp: new Date().toISOString(),
      });

      // Mark sessions completed
      setSessions((prev) =>
        prev.map((s) => {
          if (s.stationId === stationId && s.status === 'active') {
            return {
              ...s,
              status: 'completed',
              stopReason: 'Remote',
              currentKw: 0,
            };
          }
          return s;
        })
      );

      // Free port to Finishing / Available
      setChargers((prev) =>
        prev.map((c) => {
          if (c.id !== stationId) return c;
          return {
            ...c,
            currentLoadKw: 0,
            health: { ...c.health, contactor: 'Open' },
            evses: c.evses.map((evse) => ({
              ...evse,
              currentLoadKw: 0,
              connectors: evse.connectors.map((conn) => ({
                ...conn,
                status: 'Finishing',
                currentPowerKw: 0,
              })),
            })),
          };
        })
      );
    }
  };

  // Remote Start Execution
  const handleExecuteStartCharging = (
    portNumber: number,
    authType: 'OperatorOverride' | 'RFID' | 'App',
    idTag: string,
    maxPowerKw?: number
  ) => {
    if (!startModal.station) return;
    const stationId = startModal.station.id;
    const powerKw = maxPowerKw || (startModal.station.type === 'DCFC' ? 180 : 11.5);

    sendRemoteCommand(stationId, 'RemoteStartTransaction', {
      connectorId: portNumber,
      idTag,
      chargingProfile: {
        chargingProfilePurpose: 'TxDefaultProfile',
        limit: powerKw,
      },
    });

    logOcppMessage(stationId, 'CS_TO_CP', 'RemoteStartTransaction', {
      connectorId: portNumber,
      idTag,
      chargingProfile: {
        chargingProfilePurpose: 'TxDefaultProfile',
        limit: powerKw,
      },
    });
    logOcppMessage(stationId, 'CP_TO_CS', 'StartTransaction', {
      connectorId: portNumber,
      idTag,
      meterStart: 1200,
      timestamp: new Date().toISOString(),
    });

    const newSessionId = `SES-${Math.floor(1000 + Math.random() * 9000)}`;

    // Create session
    const newSession: Session = {
      id: newSessionId,
      stationId,
      stationName: startModal.station.name,
      evseId: `EVSE-${stationId}-1`,
      portNumber,
      connectorType: startModal.station.evses[0]?.connectors[0]?.type || 'CCS1',
      siteId: startModal.station.siteId,
      siteName: startModal.station.siteName,
      userTag: idTag,
      authMethod: authType,
      vehicleModel: 'Connected EV',
      startTime: new Date().toISOString(),
      durationMinutes: 0,
      energyKwh: 0,
      currentKw: 0,
      peakKw: 0,
      status: 'active',
      costTotal: 0,
      costBreakdown: {
        energyFee: 0,
        timeFee: 0,
        idleFee: 0,
      },
      socStart: 20,
      socCurrent: 20,
      meterStart: 1200,
      lastMeterValueTimestamp: Date.now(),
    };

    setSessions((prev) => [newSession, ...prev]);

    // Update charger
    setChargers((prev) =>
      prev.map((c) => {
        if (c.id !== stationId) return c;
        return {
          ...c,
          currentLoadKw: 0,
          health: { ...c.health, contactor: 'Closed' },
          evses: c.evses.map((evse) => ({
            ...evse,
            connectors: evse.connectors.map((conn) => {
              if (conn.portNumber === portNumber) {
                return {
                  ...conn,
                  status: 'Charging',
                  currentPowerKw: 0,
                  cableLocked: true,
                  activeSessionId: newSessionId,
                  currentSoc: 22,
                  targetSoc: 80,
                  timeTo80Min: 18,
                  etaFullMin: 35,
                };
              }
              return conn;
            }),
          })),
        };
      })
    );
  };

  const handleNavigateWithFilter = (
    tab: 'chargers' | 'sessions' | 'sites' | 'pricing' | 'settings',
    filter?: string
  ) => {
    setCurrentTab(tab);
    if (tab === 'chargers' && filter) {
      setChargersFilterStatus(filter as PortStatus);
    }
  };

  const criticalAlertsCount = alerts.filter((a) => a.severity === 'critical').length;
  const activeSessionsCount = sessions.filter((s) => s.status === 'active').length;
  const totalChargersFromSites = sites.reduce((sum, s) => sum + (s.totalChargers || 0), 0);
  const onlineChargersCount = chargers.filter((c) => c.wsStatus === 'connected').length;
  const fleetOnlinePercent = chargers.length > 0
    ? ((onlineChargersCount / chargers.length) * 100).toFixed(1)
    : '100.0';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-cyan-100 selection:text-cyan-900">
      {/* Top Navigation */}
      <Navbar
        alertsCount={alerts.length}
        onOpenAlerts={() => setCurrentTab('home')}
        onOpenSimulator={() => setCurrentTab('settings')}
        onRequestChangePassword={() => setIsManualChangePassOpen(true)}
        fleetOnlinePercent={fleetOnlinePercent}
        hubsCount={sites.length}
        isWsConnected={isWsConnected}
        isOcppServerActive={isOcppServerActive}
        wsClientsCount={onlineChargers.length}
      />

      {/* Main Layout Body */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onTabChange={(tab) => {
            setCurrentTab(tab);
            if (tab === 'chargers') {
              setChargersFilterStatus('All');
              setChargersSearchQuery('');
            }
          }}
          chargersCount={chargers.length}
          activeSessionsCount={activeSessionsCount}
          criticalAlertsCount={criticalAlertsCount}
          sitesCount={sites.length}
          isOcppServerActive={isOcppServerActive}
        />

        {/* View Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
          {currentTab === 'home' && (
            <HomeOperationsView
              chargers={chargers}
              sites={sites}
              sessions={sessions}
              alerts={alerts}
              onNavigateToTab={handleNavigateWithFilter}
              onSelectStation={(st) => setSelectedStation(st)}
              onOpenSimulator={() => setCurrentTab('settings')}
              onOpenAddCharger={() => setIsAddChargerOpen(true)}
              onOpenAddSite={() => setIsAddSiteOpen(true)}
            />
          )}

          {currentTab === 'chargers' && (
            <ChargersFleetView
              chargers={chargers}
              sessions={sessions}
              onSelectStation={(st) => setSelectedStation(st)}
              onEditStation={(st) => setEditingStation(st)}
              onDeleteStation={(st) => setDeletingStation(st)}
              onOpenSession={() => setCurrentTab('sessions')}
              initialFilterStatus={chargersFilterStatus}
              initialSearchQuery={chargersSearchQuery}
              onOpenAddCharger={() => setIsAddChargerOpen(true)}
            />
          )}

          {currentTab === 'sessions' && (
            <SessionsView
              sessions={sessions}
              onOpenStation={(stId) => {
                const target = chargers.find((c) => c.id === stId);
                if (target) setSelectedStation(target);
              }}
              onStopSession={(sessionId) => {
                const s = sessions.find((x) => x.id === sessionId);
                if (!s) return;
                const station = chargers.find((c) => c.id === s.stationId);
                if (station) {
                  setDangerousModal({
                    isOpen: true,
                    station,
                    actionType: 'StopCharging',
                    portNumber: s.portNumber,
                  });
                }
              }}
              onStartNewSession={() => setCurrentTab('chargers')}
            />
          )}

          {currentTab === 'sites' && (
            <SitesView
              sites={sites}
              chargers={chargers}
              onOpenStation={(st) => setSelectedStation(st)}
              onNavigateToChargers={(siteId) => {
                setCurrentTab('chargers');
                const s = sites.find((x) => x.id === siteId);
                if (s) setChargersSearchQuery(s.name.slice(0, 7));
              }}
              onOpenAddSite={() => setIsAddSiteOpen(true)}
              onUpdateSite={handleUpdateSite}
              onDeleteSite={handleDeleteSite}
            />
          )}

          {currentTab === 'pricing' && <PricingView />}

          {currentTab === 'roaming' && (
            <RoamingView
              chargers={chargers}
              sites={sites}
              sessions={sessions}
            />
          )}

          {currentTab === 'admin' && (
            <AdminUsersView
              sites={sites}
              onRequestChangeAdminPassword={() => setIsManualChangePassOpen(true)}
              onOpenAssigneeSetup={(token) => openInviteForToken(token)}
              onNavigateHome={() => setCurrentTab('home')}
            />
          )}

          {currentTab === 'settings' && (
            <SimulatorSettingsView
              chargers={chargers}
              isWsConnected={isWsConnected}
              isOcppServerActive={isOcppServerActive}
              onToggleWsServer={toggleOcppServer}
              onlineChargers={onlineChargers}
              serverEndpoint={serverEndpoint}
            />
          )}
        </main>
      </div>

      {/* Slide-out Contextual Charger Detail Drawer */}
      <ChargerDetailDrawer
        station={selectedStation}
        isOpen={!!selectedStation}
        onClose={() => setSelectedStation(null)}
        ocppMessages={ocppMessages}
        sessions={sessions}
        onTriggerAction={handleTriggerAction}
        onEditCharger={(st) => setEditingStation(st)}
        onRequestDelete={(st) => {
          setSelectedStation(null);
          setDeletingStation(st);
        }}
        onDeleteCharger={handleDeleteCharger}
        onOpenSession={(sId) => {
          setSelectedStation(null);
          setCurrentTab('sessions');
        }}
      />

      {/* Add New EV Charger Commissioning Modal (Firestore Database + Internet Webhook) */}
      <AddChargerModal
        isOpen={isAddChargerOpen}
        onClose={() => setIsAddChargerOpen(false)}
        sites={sites}
        onAddCharger={handleAddCharger}
      />

      {/* Add New Site Commissioning Modal (Firestore Database) */}
      <AddSiteModal
        isOpen={isAddSiteOpen}
        onClose={() => setIsAddSiteOpen(false)}
        onAddSite={handleAddSite}
      />

      {/* Dangerous Action Safety Confirmation Modal (Two-step confirmation) */}
      {dangerousModal.station && (
        <DangerousActionModal
          isOpen={dangerousModal.isOpen}
          onClose={() => setDangerousModal({ ...dangerousModal, isOpen: false })}
          station={dangerousModal.station}
          actionType={dangerousModal.actionType}
          portNumber={dangerousModal.portNumber}
          onConfirm={handleExecuteDangerousAction}
        />
      )}

      {/* Remote Start Charging Authorization Modal */}
      {startModal.station && (
        <StartChargingModal
          isOpen={startModal.isOpen}
          onClose={() => setStartModal({ ...startModal, isOpen: false })}
          station={startModal.station}
          selectedPortNumber={startModal.portNumber}
          onStart={handleExecuteStartCharging}
        />
      )}

      {/* Edit Charger Modal */}
      {editingStation && (
        <EditChargerModal
          isOpen={!!editingStation}
          onClose={() => setEditingStation(null)}
          station={editingStation}
          sites={sites}
          onSaveCharger={handleUpdateCharger}
          onRequestDelete={(st) => {
            setEditingStation(null);
            setDeletingStation(st);
          }}
        />
      )}

      {/* Confirm Decommission Modal for Charger */}
      {deletingStation && (
        <ConfirmDeleteModal
          isOpen={!!deletingStation}
          onClose={() => setDeletingStation(null)}
          title="Decommission EV Charger"
          itemType="charger"
          itemId={deletingStation.id}
          itemName={deletingStation.name}
          warningText={`Permanently decommission charger ${deletingStation.id} (${deletingStation.name}) at ${deletingStation.siteName}. This will disconnect the station from CPMS, cancel any active charging sessions, and remove it from the fleet.`}
          onConfirm={async () => {
            if (deletingStation) {
              await handleDeleteCharger(deletingStation.id);
              setDeletingStation(null);
            }
          }}
        />
      )}

      {/* Force Change Password Modal (Mandatory on 1st login ONLY if admin password has NOT been changed yet) */}
      <ForceChangePasswordModal
        isOpen={(!isAdminPasswordChanged && mustChangePassword) || isManualChangePassOpen}
      />

      {/* Regular Login Modal (shown after re-open if default admin password has been changed already) */}
      <LoginModal
        isOpen={isRegularLoginOpen}
        onClose={closeRegularLogin}
      />

      {/* Assignee 1st Time Login Setup Modal */}
      <FirstTimeSetupModal
        inviteToken={activeInviteToken}
        onClose={() => {
          clearActiveInvite();
          setCurrentTab('admin');
        }}
      />
    </div>
  );
}
