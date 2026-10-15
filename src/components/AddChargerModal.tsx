import React, { useState, useEffect } from 'react';
import {
  X,
  Zap,
  Globe,
  Radio,
  ShieldCheck,
  Server,
  Key,
  Copy,
  Check,
  AlertCircle,
  HelpCircle,
  Sliders,
  Database,
  Lock,
} from 'lucide-react';
import { ChargingStation, Site, ConnectorType, EVSE, Connector } from '../types';
import { useAuth } from '../lib/AuthContext';
import { formatOcppWsUrl, formatHttpWebhookUrl } from '../utils';

interface AddChargerModalProps {
  isOpen: boolean;
  onClose: () => void;
  sites: Site[];
  onAddCharger: (newCharger: ChargingStation) => Promise<void>;
}

export const AddChargerModal: React.FC<AddChargerModalProps> = ({
  isOpen,
  onClose,
  sites,
  onAddCharger,
}) => {
  const { userProfile, permissions, role } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Form Fields
  const [chargerId, setChargerId] = useState(`CHG-${Math.floor(100 + Math.random() * 900)}`);
  const [name, setName] = useState('');
  const [siteId, setSiteId] = useState(sites[0]?.id || 'site-main');
  const [type, setType] = useState<'DCFC' | 'AC_L2'>('DCFC');
  const [vendor, setVendor] = useState('Alpitronic');
  const [model, setModel] = useState('Alpitronic Hypercharger HYC 400');
  const [totalCapacityKw, setTotalCapacityKw] = useState(300);
  const [ocppVersion, setOcppVersion] = useState<'1.6-J' | '2.0.1'>('1.6-J');
  const [isSimultaneous, setIsSimultaneous] = useState(true);
  const [isEmulated, setIsEmulated] = useState(false);
  const [connectorConfig, setConnectorConfig] = useState<'dual_ccs' | 'ccs_nacs' | 'dual_nacs' | 'single_j1772'>('ccs_nacs');
  
  // Webhook and internet connection fields
  const initialGeneratedId = `CHG-${Math.floor(100 + Math.random() * 900)}`;
  const [cloudConnectionMode, setCloudConnectionMode] = useState<'webhook_bridge' | 'direct_ocpp' | 'mqtt_iot'>('webhook_bridge');
  const [webhookEntryMode, setWebhookEntryMode] = useState<'wss' | 'https'>('wss');
  const [webhookUrl, setWebhookUrl] = useState(formatOcppWsUrl(initialGeneratedId, ocppVersion));
  const [webhookSecret, setWebhookSecret] = useState(`whsec_${Math.random().toString(36).substring(2, 15)}_${Date.now().toString(36)}`);
  const [ipAddress, setIpAddress] = useState(`192.168.10.${Math.floor(20 + Math.random() * 80)}`);
  const [generateTestHeartbeat, setGenerateTestHeartbeat] = useState(true);

  // Ensure webhookUrl dynamically follows the real entry URL for current chargerId, protocol mode, and ocppVersion
  useEffect(() => {
    const cleanId = chargerId.trim() || 'CHG-NEW';
    if (webhookEntryMode === 'https') {
      setWebhookUrl(formatHttpWebhookUrl(cleanId, ocppVersion));
    } else {
      setWebhookUrl(formatOcppWsUrl(cleanId, ocppVersion));
    }
  }, [chargerId, webhookEntryMode, ocppVersion]);

  useEffect(() => {
    if (sites.length > 0 && (!siteId || siteId === 'site-main')) {
      setSiteId(sites[0].id);
    }
  }, [sites, siteId]);

  if (!isOpen) return null;

  // Auto update defaults when switching type or vendor
  const handleTypeChange = (newType: 'DCFC' | 'AC_L2') => {
    setType(newType);
    if (newType === 'DCFC') {
      setVendor('Alpitronic');
      setModel('Alpitronic Hypercharger HYC 400');
      setTotalCapacityKw(300);
      setConnectorConfig('ccs_nacs');
      setIsSimultaneous(true);
    } else {
      setVendor('ChargePoint');
      setModel('ChargePoint CT4000 Commercial L2');
      setTotalCapacityKw(19.2);
      setConnectorConfig('single_j1772');
      setIsSimultaneous(false);
    }
  };

  const handleCopy = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const selectedSite = sites.find((s) => s.id === siteId) || sites[0];
      const actualSiteId = selectedSite?.id || siteId || 'site-main';
      const siteName = selectedSite ? selectedSite.name : 'Main Charging Hub';

      // Build EVSE & Connectors
      const evses: EVSE[] = [];
      if (type === 'DCFC') {
        const conn1Type: ConnectorType = connectorConfig === 'dual_nacs' ? 'NACS' : 'CCS1';
        const conn2Type: ConnectorType = connectorConfig === 'dual_ccs' ? 'CCS1' : 'NACS';
        const perPortKw = Math.round(totalCapacityKw / 2);

        const connectors: Connector[] = [
          {
            id: `${chargerId}-E1-C1`,
            evseId: `${chargerId}-E1`,
            portNumber: 1,
            type: conn1Type,
            maxPowerKw: totalCapacityKw,
            status: 'Offline',
            currentPowerKw: 0,
            voltageV: 800,
            currentA: 0,
            cableLocked: false,
          },
          {
            id: `${chargerId}-E1-C2`,
            evseId: `${chargerId}-E1`,
            portNumber: 2,
            type: conn2Type,
            maxPowerKw: totalCapacityKw,
            status: 'Offline',
            currentPowerKw: 0,
            voltageV: 800,
            currentA: 0,
            cableLocked: false,
          },
        ];

        evses.push({
          id: `${chargerId}-E1`,
          evseNumber: 1,
          maxPowerKw: totalCapacityKw,
          currentLoadKw: 0,
          connectors,
          isMutuallyExclusive: !isSimultaneous,
        });
      } else {
        // AC L2
        evses.push({
          id: `${chargerId}-E1`,
          evseNumber: 1,
          maxPowerKw: totalCapacityKw,
          currentLoadKw: 0,
          connectors: [
            {
              id: `${chargerId}-E1-C1`,
              evseId: `${chargerId}-E1`,
              portNumber: 1,
              type: 'J1772',
              maxPowerKw: totalCapacityKw,
              status: 'Offline',
              currentPowerKw: 0,
              voltageV: 240,
              currentA: 0,
              cableLocked: false,
            },
          ],
          isMutuallyExclusive: false,
        });
      }

      const newStation: ChargingStation = {
        id: chargerId.trim().toUpperCase(),
        name: name.trim(),
        model,
        vendor,
        siteId,
        siteName,
        type,
        totalCapacityKw,
        currentLoadKw: 0,
        isSimultaneous,
        isEmulated: false,
        wsStatus: 'disconnected',
        lastHeartbeatSecondsAgo: 0,
        evses,
        health: {
          contactor: 'Open',
          cabinetTempC: 28,
          eStop: 'OK',
          groundFault: 'Clear',
          gunLock: 'Unlocked',
          lastError: 'NoError',
          lastErrorCode: '0x00',
          firmwareVersion: 'v2.4.1-cloud-verified',
        },
        ocppVersion,
        ipAddress,
        webhookUrl,
        webhookSecret,
        cloudConnectionMode,
        isDatabasePersisted: true,
        createdAt: new Date().toISOString(),
        createdBy: userProfile?.uid || 'user',
      };

      await onAddCharger(newStation);
      const nextId = `CHG-${Math.floor(100 + Math.random() * 900)}`;
      setChargerId(nextId);
      setName('');
      setWebhookUrl(formatOcppWsUrl(nextId, ocppVersion));
      onClose();
    } catch (err: any) {
      console.error('Failed to create charger:', err);
      setErrorMsg(err.message || 'Failed to save charger record in database.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500 flex items-center justify-center text-white shadow-sm shadow-cyan-500/30">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold font-mono">Commission & Add New EV Charger</h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30 flex items-center gap-1">
                  <Database className="w-3 h-3" />
                  Firestore Database Sync
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Register real AC or DCFC charging hardware connected via internet webhooks to Z-CHARGE CPMS
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Access Warning if Viewer */}
        {!permissions.canAddCharger && (
          <div className="p-3 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs flex items-center gap-2 px-6">
            <Lock className="w-4 h-4 shrink-0" />
            <span>
              <strong>Read-Only Access:</strong> You are currently signed in as <strong>{role.toUpperCase()}</strong>. Adding hardware requires Operator, Technician, or Super Admin privileges.
            </span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Charger Classification (DCFC vs AC) */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Charger Architecture & Level
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleTypeChange('DCFC')}
                className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                  type === 'DCFC'
                    ? 'border-cyan-600 bg-cyan-50/50 ring-2 ring-cyan-500/20 shadow-xs'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100/70 text-slate-700'
                }`}
              >
                <div className={`p-2 rounded-lg ${type === 'DCFC' ? 'bg-cyan-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">DC Fast Charger (DCFC)</div>
                  <div className="text-[11px] text-slate-500">
                    High power 50 kW – 400 kW (CCS1, NACS), 800V DC contactors, dynamic split
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('AC_L2')}
                className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                  type === 'AC_L2'
                    ? 'border-cyan-600 bg-cyan-50/50 ring-2 ring-cyan-500/20 shadow-xs'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100/70 text-slate-700'
                }`}
              >
                <div className={`p-2 rounded-lg ${type === 'AC_L2' ? 'bg-cyan-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">AC Level 2 Commercial</div>
                  <div className="text-[11px] text-slate-500">
                    Single/Dual Port 7.2 kW – 19.2 kW (J1772, NACS), 208-240V AC
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Section 2: Identification & Site Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 mb-1 block">
                ChargeBox Station ID <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={chargerId}
                onChange={(e) => {
                  const newId = e.target.value;
                  setChargerId(newId);
                  const cleanId = newId.trim() || 'CHG-NEW';
                  if (webhookEntryMode === 'https') {
                    setWebhookUrl(formatHttpWebhookUrl(cleanId, ocppVersion));
                  } else {
                    setWebhookUrl(formatOcppWsUrl(cleanId, ocppVersion));
                  }
                }}
                placeholder="e.g. CHG-106, HYC-TX-04"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:border-cyan-500"
                required
              />
              <span className="text-[10px] text-slate-500">Used as OCPP Identity in BootNotification</span>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 mb-1 block">
                Friendly Display Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Bay #1 — Hypercharger 400"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:border-cyan-500"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 block">
                  Assigned Site Hub <span className="text-rose-500">*</span>
                </label>
                {sites.length === 0 && (
                  <span className="text-[10px] text-amber-600 font-semibold">No sites created yet (Default Site assigned)</span>
                )}
              </div>
              {sites.length > 0 ? (
                <select
                  value={siteId}
                  onChange={(e) => setSiteId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:border-cyan-500"
                >
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.city}, {s.state})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  readOnly
                  value="Default Charging Hub (site-main)"
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-600 font-mono font-medium"
                />
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 mb-1 block">
                Total Capacity (kW) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="3"
                  max="1000"
                  step="0.1"
                  value={totalCapacityKw}
                  onChange={(e) => setTotalCapacityKw(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:border-cyan-500"
                  required
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">
                  kW
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: Hardware Manufacturer & Connectors */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 mb-1 block">Vendor</label>
              <input
                type="text"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="e.g. Alpitronic, ABB, Tritium"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:border-cyan-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-slate-700 mb-1 block">Hardware Model</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. Terra 360, Hypercharger 400"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:border-cyan-500"
              />
            </div>
          </div>

          {type === 'DCFC' && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>DCFC Connector Configuration</span>
                <span className="text-[10px] text-cyan-700 font-mono">2 Dispensers</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setConnectorConfig('ccs_nacs')}
                  className={`p-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                    connectorConfig === 'ccs_nacs'
                      ? 'bg-cyan-600 text-white border-cyan-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  CCS1 + NACS (Combo)
                </button>
                <button
                  type="button"
                  onClick={() => setConnectorConfig('dual_nacs')}
                  className={`p-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                    connectorConfig === 'dual_nacs'
                      ? 'bg-cyan-600 text-white border-cyan-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Dual NACS (Tesla)
                </button>
                <button
                  type="button"
                  onClick={() => setConnectorConfig('dual_ccs')}
                  className={`p-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                    connectorConfig === 'dual_ccs'
                      ? 'bg-cyan-600 text-white border-cyan-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Dual CCS1
                </button>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chk-simultaneous"
                  checked={isSimultaneous}
                  onChange={(e) => setIsSimultaneous(e.target.checked)}
                  className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                />
                <label htmlFor="chk-simultaneous" className="text-xs text-slate-700 font-medium">
                  Support dynamic power sharing (charge 2 vehicles concurrently)
                </label>
              </div>
            </div>
          )}

          {/* Section 4: Internet Webhook & Cloud Gateway */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white space-y-3.5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-700/80 pb-2">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold font-mono text-cyan-300 uppercase tracking-wide">
                  Internet Webhook & Cloud CPMS Bridge
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold border border-emerald-500/30">
                HTTPS / WSS Ready
              </span>
            </div>

            <p className="text-[11px] text-slate-300">
              The charger connects to this CPMS through the internet using an encrypted HTTP/WebSocket Webhook bridge. Telemetry, StatusNotification, and Authorize requests route to this endpoint.
            </p>

            <div className="space-y-2">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-mono text-slate-300 font-semibold block">
                    Real Webhook Ingest URL (Active Entry Endpoint)
                  </label>
                  <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg p-0.5 text-[10px] font-mono">
                    <button
                      type="button"
                      onClick={() => setWebhookEntryMode('wss')}
                      className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                        webhookEntryMode === 'wss'
                          ? 'bg-cyan-500 text-slate-950 font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="WebSocket OCPP Gateway (Standard Central System URL)"
                    >
                      WSS (OCPP)
                    </button>
                    <button
                      type="button"
                      onClick={() => setWebhookEntryMode('https')}
                      className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                        webhookEntryMode === 'https'
                          ? 'bg-cyan-500 text-slate-950 font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="HTTPS REST Webhook Ingest (Event Push Bridge)"
                    >
                      HTTPS Webhook
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={webhookUrl}
                    className="w-full px-3 py-2 bg-slate-950 border border-cyan-500/50 rounded-lg text-xs font-mono font-bold text-cyan-300 selection:bg-cyan-900 focus:outline-hidden focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 shadow-inner transition-colors tracking-wide"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy(webhookUrl, 'url')}
                    className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                  >
                    {copiedKey === 'url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'url' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 font-mono flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>
                    Real live entry URL for <strong className="text-cyan-300">OCPP {ocppVersion === '2.0.1' ? '2.0.1' : '1.6'}</strong>: Paste into charger Central System settings.
                  </span>
                </p>
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">
                  Webhook Signature Secret (HMAC-SHA256 Token)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={webhookSecret}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-amber-300 selection:bg-amber-900"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy(webhookSecret, 'secret')}
                    className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                  >
                    {copiedKey === 'secret' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'secret' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[10px] font-mono text-slate-400 block mb-1">
                    OCPP Protocol Version
                  </label>
                  <select
                    value={ocppVersion}
                    onChange={(e) => {
                      const newVer = e.target.value as '1.6-J' | '2.0.1';
                      setOcppVersion(newVer);
                      const cleanId = chargerId.trim() || 'CHG-NEW';
                      if (webhookEntryMode === 'https') {
                        setWebhookUrl(formatHttpWebhookUrl(cleanId, newVer));
                      } else {
                        setWebhookUrl(formatOcppWsUrl(cleanId, newVer));
                      }
                    }}
                    className="w-full px-2.5 py-2 bg-slate-950 border border-cyan-500/50 rounded-lg text-xs font-mono font-semibold text-cyan-200 focus:outline-hidden focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 shadow-xs cursor-pointer transition-colors"
                  >
                    <option value="1.6-J">OCPP 1.6-JSON (Standard)</option>
                    <option value="2.0.1">OCPP 2.0.1 (ISO 15118 PnC)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-mono text-slate-400 block mb-1">
                    Station LAN / WAN IP
                  </label>
                  <input
                    type="text"
                    value={ipAddress}
                    onChange={(e) => setIpAddress(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 5: Database Persistence Badge & Options */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-cyan-600" />
              <span className="text-slate-700 font-semibold">
                Store record permanently in Firestore database
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono font-bold text-[11px]">
              Collection: /chargers
            </span>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500">
            Registered as operator: <span className="font-mono font-bold text-slate-700">{userProfile?.email || 'gzhang.v@gmail.com'}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-3d btn-3d-white px-4 py-2 text-xs font-bold text-slate-700 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting || !permissions.canAddCharger}
              onClick={handleSubmit}
              className={`btn-3d btn-3d-cyan px-5 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer ${
                submitting || !permissions.canAddCharger ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>{submitting ? 'Writing to Firestore...' : 'Register & Connect Charger'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
