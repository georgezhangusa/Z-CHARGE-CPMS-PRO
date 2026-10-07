import React, { useState } from 'react';
import { AlertTriangle, X, ShieldAlert, Zap } from 'lucide-react';
import { ChargingStation } from '../types';

interface DangerousActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  station: ChargingStation;
  actionType: 'HardReset' | 'StopCharging' | 'EmergencyTrip';
  portNumber?: number;
  onConfirm: () => void;
}

export const DangerousActionModal: React.FC<DangerousActionModalProps> = ({
  isOpen,
  onClose,
  station,
  actionType,
  portNumber,
  onConfirm,
}) => {
  const [acknowledged, setAcknowledged] = useState(false);

  if (!isOpen) return null;

  const isHardReset = actionType === 'HardReset';
  const isEmergency = actionType === 'EmergencyTrip';
  const isStop = actionType === 'StopCharging';

  const title = isHardReset
    ? 'High Voltage Hard Reset Confirmation'
    : isEmergency
      ? 'Emergency Remote Disconnect'
      : `Stop Charging Port #${portNumber || 1}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div
        id="dangerous-action-modal"
        className="w-full max-w-lg bg-white border border-rose-200 rounded-2xl shadow-2xl overflow-hidden text-slate-800"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-rose-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-100 text-rose-700 border border-rose-200">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 tracking-tight">{title}</h3>
              <p className="text-xs text-rose-700">Safety Interlock & Two-Step Operator Verification</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-3d btn-3d-white p-1 rounded-lg text-slate-500 hover:text-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Target Station</span>
              <span className="font-mono text-slate-900 font-semibold">{station.id} ({station.name})</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Site Location</span>
              <span className="text-slate-800 font-medium">{station.siteName}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Current Power Load</span>
              <span className="font-mono font-bold text-amber-700 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-600" />
                {station.currentLoadKw > 0 ? `${station.currentLoadKw} kW Live Draw` : '0 kW (Idle)'}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs leading-relaxed">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              {isHardReset && (
                <p>
                  <strong>Warning:</strong> Hard rebooting a DC Fast Charger while active contactors are energized can cause contactor arcing, vehicle on-board isolation errors, or customer billing disputes. Ensure no vehicle is currently in a high-current charge cycle or confirm the emergency procedure.
                </p>
              )}
              {isStop && (
                <p>
                  <strong>Attention:</strong> Remotely stopping this session will initiate the OCPP <code className="text-rose-900 font-semibold">RemoteStopTransaction</code> sequence. The charger will ramp current down, open DC contactors, and unlock the charging gun.
                </p>
              )}
              {isEmergency && (
                <p>
                  <strong>EMERGENCY:</strong> Immediate command to trip electrical contactors and halt all energy delivery across all EVSEs.
                </p>
              )}
            </div>
          </div>

          {/* Verification checkbox */}
          <label className="flex items-start gap-3 cursor-pointer pt-2 select-none">
            <input
              type="checkbox"
              id="confirm-dangerous-ack"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-1 w-4 h-4 rounded-sm border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
            />
            <span className="text-xs text-slate-700 leading-normal">
              I verify I am an authorized operator and confirm execution of this command on <strong>{station.id}</strong>.
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            id="cancel-dangerous-action"
            onClick={onClose}
            className="btn-3d btn-3d-white px-4 py-2 text-xs font-bold text-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            id="execute-dangerous-action"
            disabled={!acknowledged}
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`btn-3d px-5 py-2 text-xs font-bold transition-all flex items-center gap-2 ${
              acknowledged
                ? 'btn-3d-rose text-white'
                : 'bg-slate-200 text-slate-400 border border-slate-300'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            {isHardReset ? 'Confirm Hard Reset' : isStop ? 'Confirm Remote Stop' : 'Confirm Trip'}
          </button>
        </div>
      </div>
    </div>
  );
};
