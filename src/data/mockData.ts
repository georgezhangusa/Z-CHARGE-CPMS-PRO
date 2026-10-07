import {
  ChargingStation,
  Site,
  Session,
  TariffProfile,
  SystemAlert,
  OcppMessage,
} from '../types';

// Empty initial collections - all chargers and sites are registered via real Firestore / live OCPP connections
export const INITIAL_SITES: Site[] = [];
export const INITIAL_CHARGERS: ChargingStation[] = [];
export const INITIAL_SESSIONS: Session[] = [];
export const INITIAL_ALERTS: SystemAlert[] = [];
export const INITIAL_OCPP_MESSAGES: OcppMessage[] = [];

// Standard Utility Tariff Configuration for Time-of-Use & Idle Fee Billing
export const INITIAL_TARIFFS: Record<'DCFC' | 'AC_L2', TariffProfile> = {
  DCFC: {
    type: 'DCFC',
    title: 'DC Fast Charging (High Power CCS/NACS)',
    baseRatePerKwh: 0.49,
    touPeriods: [
      { name: 'Super Off-Peak', hours: '11:00 PM – 07:00 AM', ratePerKwh: 0.32 },
      { name: 'Mid-Peak (Standard)', hours: '07:00 AM – 04:00 PM', ratePerKwh: 0.49, isCurrent: true },
      { name: 'On-Peak (Utility Demand)', hours: '04:00 PM – 09:00 PM', ratePerKwh: 0.62 },
      { name: 'Evening Shoulder', hours: '09:00 PM – 11:00 PM', ratePerKwh: 0.42 },
    ],
    idleFeePerMin: 0.5,
    gracePeriodMinutes: 10,
    connectionFee: 1.0,
  },
  AC_L2: {
    type: 'AC_L2',
    title: 'AC Level 2 Commercial (J1772)',
    baseRatePerKwh: 0.26,
    touPeriods: [
      { name: 'Off-Peak Overnight', hours: '10:00 PM – 06:00 AM', ratePerKwh: 0.18 },
      { name: 'Standard Daytime', hours: '06:00 AM – 05:00 PM', ratePerKwh: 0.26, isCurrent: true },
      { name: 'Peak Hours', hours: '05:00 PM – 09:00 PM', ratePerKwh: 0.35 },
    ],
    idleFeePerMin: 0.15,
    gracePeriodMinutes: 20,
    connectionFee: 0.0,
  },
};
