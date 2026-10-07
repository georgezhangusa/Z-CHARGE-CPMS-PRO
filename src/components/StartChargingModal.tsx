import React, { useState } from 'react';
import { Play, X, KeyRound, Smartphone, ShieldCheck, Zap } from 'lucide-react';
import { ChargingStation, Connector } from '../types';
import { formatPortStatus } from '../utils';

interface StartChargingModalProps {
  isOpen: boolean;
  onClose: () => void;
  station: ChargingStation;
  selectedPortNumber?: number;
  onStart: (portNumber: number, authType: 'OperatorOverride' | 'RFID' | 'App', idTag: string, maxPowerKw?: number) => void;
}

export const StartChargingModal: React.FC<StartChargingModalProps> = ({
  isOpen,
  onClose,
  station,
  selectedPortNumber = 1,
  onStart,
}) => {
  const [port, setPort] = useState<number>(selectedPortNumber);
  const [authType, setAuthType] = useState<'OperatorOverride' | 'RFID' | 'App'>('OperatorOverride');
  const [idTag, setIdTag] = useState<string>('DISPATCH-ADMIN-OVERRIDE');
  const [maxPowerLimit, setMaxPowerLimit] = useState<number>(
    station.type === 'DCFC' ? 200 : 19.2
  );

  if (!isOpen) return null;

  // Find connectors
  const connectors: Connector[] = [];
  station.evses.forEach((evse) => {
    evse.connectors.forEach((conn) => connectors.push(conn));
  });

  const handleAuthChange = (type: 'OperatorOverride' | 'RFID' | 'App') => {
    setAuthType(type);
    if (type === 'OperatorOverride') {
      setIdTag('DISPATCH-ADMIN-OVERRIDE');
    } else if (type === 'RFID') {
      setIdTag('RFID-TX-88210');
    } else {
      setIdTag('APP-SIM-USER-404');
    }
  };

  const handleExecute = (e: React.FormEvent) => {
    e.preventDefault();
    onStart(port, authType, idTag, maxPowerLimit);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div
        id="start-charging-modal"
        className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden text-slate-800"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-100 text-cyan-700 border border-cyan-200">
              <Play className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 tracking-tight">Initiate Remote Start</h3>
              <p className="text-xs text-slate-500">OCPP RemoteStartTransaction Payload Setup</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-3d btn-3d-white p-1 rounded-lg text-slate-500 hover:text-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleExecute} className="p-6 space-y-4 text-xs">
          {/* Target Station Info */}
          <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div>
              <span className="text-slate-500 block">Station</span>
              <span className="font-mono text-slate-900 font-bold">{station.id} • {station.name}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block">OCPP Version</span>
              <span className="font-mono text-cyan-700 font-bold">{station.ocppVersion}</span>
            </div>
          </div>

          {/* Port Selection */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1.5">Select Connector / Port</label>
            <div className="grid grid-cols-2 gap-2">
              {connectors.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setPort(c.portNumber)}
                  className={`btn-3d p-3 rounded-xl text-left flex flex-col justify-between transition-all ${
                    port === c.portNumber
                      ? 'bg-cyan-50 text-cyan-950 border border-cyan-300 border-b-[3px] border-b-cyan-600 shadow-xs'
                      : 'btn-3d-white text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-xs w-full">
                    <span>Port {c.portNumber}</span>
                    <span className="font-mono text-slate-500">{c.type}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">Status: {formatPortStatus(c.status)}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Auth Method Selector */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1.5">Authorization Method</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleAuthChange('OperatorOverride')}
                className={`btn-3d p-2.5 rounded-xl text-center transition-all flex flex-col items-center ${
                  authType === 'OperatorOverride'
                    ? 'bg-cyan-50 text-cyan-950 border border-cyan-300 border-b-[3px] border-b-cyan-600 shadow-xs font-bold'
                    : 'btn-3d-white text-slate-700 font-medium'
                }`}
              >
                <ShieldCheck className="w-4 h-4 mx-auto mb-1 text-cyan-600" />
                <span className="block font-bold">Free Vend</span>
                <span className="text-[10px] text-slate-500">Override</span>
              </button>

              <button
                type="button"
                onClick={() => handleAuthChange('RFID')}
                className={`btn-3d p-2.5 rounded-xl text-center transition-all flex flex-col items-center ${
                  authType === 'RFID'
                    ? 'bg-cyan-50 text-cyan-950 border border-cyan-300 border-b-[3px] border-b-cyan-600 shadow-xs font-bold'
                    : 'btn-3d-white text-slate-700 font-medium'
                }`}
              >
                <KeyRound className="w-4 h-4 mx-auto mb-1 text-amber-600" />
                <span className="block font-bold">Virtual RFID</span>
                <span className="text-[10px] text-slate-500">idTag</span>
              </button>

              <button
                type="button"
                onClick={() => handleAuthChange('App')}
                className={`btn-3d p-2.5 rounded-xl text-center transition-all flex flex-col items-center ${
                  authType === 'App'
                    ? 'bg-cyan-50 text-cyan-950 border border-cyan-300 border-b-[3px] border-b-cyan-600 shadow-xs font-bold'
                    : 'btn-3d-white text-slate-700 font-medium'
                }`}
              >
                <Smartphone className="w-4 h-4 mx-auto mb-1 text-emerald-600" />
                <span className="block font-bold">Mobile App</span>
                <span className="text-[10px] text-slate-500">User Token</span>
              </button>
            </div>
          </div>

          {/* Identity Tag Input */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">OCPP idTag / Authorization Token</label>
            <input
              type="text"
              id="ocpp-id-tag-input"
              value={idTag}
              onChange={(e) => setIdTag(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 font-mono text-xs focus:outline-hidden focus:border-cyan-500"
            />
          </div>

          {/* Power Ceiling */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-slate-700 font-semibold">Max Power Limit (Profile Cap)</label>
              <span className="font-mono text-cyan-700 font-bold">{maxPowerLimit} kW</span>
            </div>
            <input
              type="range"
              min="10"
              max={station.totalCapacityKw}
              step="10"
              value={maxPowerLimit}
              onChange={(e) => setMaxPowerLimit(Number(e.target.value))}
              className="w-full accent-cyan-600 bg-slate-200 cursor-pointer h-1.5 rounded-lg"
            />
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="btn-3d btn-3d-white px-4 py-2 text-slate-800 text-xs font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="submit-remote-start"
              className="btn-3d btn-3d-cyan px-5 py-2 text-white text-xs font-bold flex items-center gap-2"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Dispatch Remote Start
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
