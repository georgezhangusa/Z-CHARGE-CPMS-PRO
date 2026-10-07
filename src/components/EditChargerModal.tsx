import React, { useState, useEffect } from 'react';
import {
  X,
  Zap,
  Globe,
  Radio,
  Sliders,
  AlertCircle,
  Trash2,
  Save,
  Cpu,
  Layers,
} from 'lucide-react';
import { ChargingStation, Site, ConnectorType } from '../types';
import { formatOcppWsUrl } from '../utils';

interface EditChargerModalProps {
  isOpen: boolean;
  onClose: () => void;
  station: ChargingStation | null;
  sites: Site[];
  onSaveCharger: (updated: ChargingStation) => Promise<void>;
  onRequestDelete?: (station: ChargingStation) => void;
}

export const EditChargerModal: React.FC<EditChargerModalProps> = ({
  isOpen,
  onClose,
  station,
  sites,
  onSaveCharger,
  onRequestDelete,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form Fields initialized from station
  const [name, setName] = useState('');
  const [siteId, setSiteId] = useState('');
  const [type, setType] = useState<'DCFC' | 'AC_L2'>('DCFC');
  const [vendor, setVendor] = useState('');
  const [model, setModel] = useState('');
  const [totalCapacityKw, setTotalCapacityKw] = useState(150);
  const [ocppVersion, setOcppVersion] = useState<'1.6-J' | '2.0.1'>('1.6-J');
  const [isSimultaneous, setIsSimultaneous] = useState(true);
  const [cloudConnectionMode, setCloudConnectionMode] = useState<'webhook_bridge' | 'direct_ocpp' | 'mqtt_iot'>('webhook_bridge');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [port1Type, setPort1Type] = useState<ConnectorType>('CCS1');
  const [port2Type, setPort2Type] = useState<ConnectorType>('NACS');

  useEffect(() => {
    if (station) {
      setName(station.name || '');
      setSiteId(station.siteId || (sites[0]?.id ?? ''));
      setType(station.type || 'DCFC');
      setVendor(station.vendor || '');
      setModel(station.model || '');
      setTotalCapacityKw(station.totalCapacityKw || (station.type === 'DCFC' ? 180 : 19.2));
      setOcppVersion(station.ocppVersion || '1.6-J');
      setIsSimultaneous(station.isSimultaneous ?? true);
      setCloudConnectionMode(station.cloudConnectionMode || 'webhook_bridge');
      setWebhookUrl(formatOcppWsUrl(station.id, station.webhookUrl));
      setIpAddress(station.ipAddress || '192.168.1.100');

      const c1 = station.evses[0]?.connectors[0];
      const c2 = station.evses.length > 1 ? station.evses[1]?.connectors[0] : station.evses[0]?.connectors[1];
      if (c1) setPort1Type(c1.type);
      if (c2) setPort2Type(c2.type);
    }
  }, [station, sites]);

  if (!isOpen || !station) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Charger name is required');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const selectedSite = sites.find((s) => s.id === siteId) || sites[0];
      const actualSiteId = selectedSite?.id || siteId || station.siteId;
      const actualSiteName = selectedSite ? selectedSite.name : station.siteName;

      // Update EVSEs and Connectors preserving live status and readings
      const updatedEvses = station.evses.map((evse, eIdx) => {
        return {
          ...evse,
          maxPowerKw: totalCapacityKw,
          connectors: evse.connectors.map((conn, cIdx) => {
            const isPort1 = conn.portNumber === 1 || (eIdx === 0 && cIdx === 0);
            return {
              ...conn,
              type: isPort1 ? port1Type : port2Type,
              maxPowerKw: isSimultaneous ? Math.round(totalCapacityKw / 2) : totalCapacityKw,
            };
          }),
        };
      });

      const updatedCharger: ChargingStation = {
        ...station,
        name: name.trim(),
        siteId: actualSiteId,
        siteName: actualSiteName,
        type,
        vendor: vendor.trim() || station.vendor,
        model: model.trim() || station.model,
        totalCapacityKw: Number(totalCapacityKw),
        ocppVersion,
        isSimultaneous,
        cloudConnectionMode,
        webhookUrl: webhookUrl.trim(),
        ipAddress: ipAddress.trim(),
        evses: updatedEvses,
        updatedAt: new Date().toISOString(),
      };

      await onSaveCharger(updatedCharger);
      onClose();
    } catch (err: any) {
      console.error('Error updating charger:', err);
      setErrorMsg(err.message || 'Failed to update charger');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div
        id="edit-charger-modal"
        className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden text-slate-800 my-8 animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-100 text-cyan-700 border border-cyan-200">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-sm tracking-tight">Edit Charger Configuration</h3>
                <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-bold">
                  {station.id}
                </span>
              </div>
              <p className="text-xs text-slate-500">Update hardware specifications, site assignment, and network parameters</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-3d btn-3d-white p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Basic & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Charger Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Downtown Plaza Hypercharger 01"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:border-cyan-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Site Facility *</label>
              <select
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:border-cyan-500 focus:bg-white"
              >
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.city}, {s.state})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 2: Power & Hardware */}
          <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 space-y-3">
            <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
              <Sliders className="w-3.5 h-3.5 text-cyan-600" />
              Power & Electrical Specifications
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Charger Level / Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as 'DCFC' | 'AC_L2')}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900"
                >
                  <option value="DCFC">DC Fast Charger (DCFC)</option>
                  <option value="AC_L2">AC Level 2 Commercial</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Total Capacity (kW)</label>
                <input
                  type="number"
                  min="3"
                  max="600"
                  step="1"
                  value={totalCapacityKw}
                  onChange={(e) => setTotalCapacityKw(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">OCPP Protocol Version</label>
                <select
                  value={ocppVersion}
                  onChange={(e) => setOcppVersion(e.target.value as '1.6-J' | '2.0.1')}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900"
                >
                  <option value="1.6-J">OCPP 1.6-J (JSON / WS)</option>
                  <option value="2.0.1">OCPP 2.0.1 (Modern)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Hardware Vendor</label>
                <input
                  type="text"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Model Name</label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900"
                />
              </div>
            </div>

            {/* Simultaneous sharing */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <div>
                <span className="font-semibold text-slate-800 block">Dynamic Power Sharing</span>
                <span className="text-[11px] text-slate-500">Allow dual vehicles to charge simultaneously by splitting available capacity.</span>
              </div>
              <input
                type="checkbox"
                checked={isSimultaneous}
                onChange={(e) => setIsSimultaneous(e.target.checked)}
                className="w-4 h-4 rounded-sm accent-cyan-600 cursor-pointer"
              />
            </div>
          </div>

          {/* Section 3: Connector Configuration */}
          <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 space-y-3">
            <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
              <Layers className="w-3.5 h-3.5 text-cyan-600" />
              Connector Types (Ports)
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Port 1 Connector</label>
                <select
                  value={port1Type}
                  onChange={(e) => setPort1Type(e.target.value as ConnectorType)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-mono"
                >
                  <option value="CCS1">CCS1 (Combo 1)</option>
                  <option value="NACS">NACS (Tesla / J3400)</option>
                  <option value="J1772">J1772 (Type 1 AC)</option>
                  <option value="CHAdeMO">CHAdeMO</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Port 2 Connector</label>
                <select
                  value={port2Type}
                  onChange={(e) => setPort2Type(e.target.value as ConnectorType)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-mono"
                >
                  <option value="NACS">NACS (Tesla / J3400)</option>
                  <option value="CCS1">CCS1 (Combo 1)</option>
                  <option value="J1772">J1772 (Type 1 AC)</option>
                  <option value="CHAdeMO">CHAdeMO</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: Network & Webhook */}
          <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 space-y-3">
            <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
              <Globe className="w-3.5 h-3.5 text-cyan-600" />
              Network & Integration Parameters
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Connection Mode</label>
                <select
                  value={cloudConnectionMode}
                  onChange={(e) => setCloudConnectionMode(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-mono"
                >
                  <option value="direct_ocpp">Direct OCPP WebSocket Gateway</option>
                  <option value="webhook_bridge">Webhook Bridge (HTTPS Event Push)</option>
                  <option value="mqtt_iot">MQTT AWS/Azure IoT Core</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Hardware IP Address</label>
                <input
                  type="text"
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-slate-600 font-medium">Webhook Target URL</label>
                <button
                  type="button"
                  onClick={() => setWebhookUrl(formatOcppWsUrl(station.id))}
                  className="text-[10px] text-cyan-600 hover:text-cyan-800 font-mono font-medium hover:underline cursor-pointer"
                >
                  Reset Real Entry URL
                </button>
              </div>
              <input
                type="text"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder={formatOcppWsUrl(station.id)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-hidden focus:border-cyan-500"
              />
              <p className="text-[10px] text-slate-500 mt-1 font-mono">
                Real Entry URL: {formatOcppWsUrl(station.id)}
              </p>
            </div>
          </div>

          {/* Danger Zone: Decommission Charger */}
          {onRequestDelete && (
            <div className="p-4 rounded-xl bg-rose-50/60 border border-rose-200 flex items-center justify-between gap-3">
              <div>
                <span className="font-bold text-rose-900 text-xs block">Decommission Charger</span>
                <span className="text-[11px] text-rose-700">
                  Permanently remove this charger from the fleet and database. You will be prompted to confirm.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onRequestDelete(station);
                }}
                className="btn-3d btn-3d-rose px-3 py-1.5 text-xs font-bold text-white shrink-0 flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Decommission Charger</span>
              </button>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="btn-3d btn-3d-white px-4 py-2 text-xs font-bold text-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-3d btn-3d-cyan px-5 py-2 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Save className="w-4 h-4" />
              <span>{submitting ? 'Saving Changes...' : 'Save Configuration'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
