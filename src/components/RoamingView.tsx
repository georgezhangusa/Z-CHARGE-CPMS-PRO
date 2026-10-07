import React, { useState } from "react";
import {
  Globe,
  Network,
  Share2,
  Radio,
  Building,
  Zap,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ExternalLink,
  RefreshCw,
  Search,
  Filter,
  DollarSign,
  FileSpreadsheet,
  Download,
  Key,
  Shield,
  Activity,
  Code,
  Layers,
  ChevronDown,
  ArrowUpRight,
  Send,
  Plus,
} from "lucide-react";
import {
  OcpiPartner,
  OcpiCdr,
  OcpiTariff,
  OcpiToken,
  OcpiSyncLog,
  ChargingStation,
  Site,
  Session,
} from "../types";
import {
  roamingService,
  INITIAL_ROAMING_PARTNERS,
  INITIAL_ROAMING_CDRS,
  INITIAL_ROAMING_TARIFFS,
  INITIAL_ROAMING_TOKENS,
  INITIAL_ROAMING_LOGS,
} from "../lib/roamingService";
import { AddPartnerModal } from "./AddPartnerModal";

interface RoamingViewProps {
  chargers: ChargingStation[];
  sites: Site[];
  sessions: Session[];
}

export const RoamingView: React.FC<RoamingViewProps> = ({
  chargers,
  sites,
  sessions,
}) => {
  const [partners, setPartners] = useState<OcpiPartner[]>(
    roamingService.getPartners(),
  );
  const [cdrs, setCdrs] = useState<OcpiCdr[]>(roamingService.getCdrs());
  const [tariffs, setTariffs] = useState<OcpiTariff[]>(INITIAL_ROAMING_TARIFFS);
  const [tokens, setTokens] = useState<OcpiToken[]>(roamingService.getTokens());
  const [logs, setLogs] = useState<OcpiSyncLog[]>(roamingService.getLogs());

  const [activeTab, setActiveTab] = useState<
    "partners" | "locations" | "tariffs" | "cdrs" | "tokens" | "logs"
  >("partners");
  const [isAddPartnerOpen, setIsAddPartnerOpen] = useState(false);
  const [isPushingLocations, setIsPushingLocations] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Inspector modal for JSON or payload details
  const [viewingJson, setViewingJson] = useState<{
    title: string;
    data: any;
  } | null>(null);

  // Test Token Authorize tool state
  const [testTokenInput, setTestTokenInput] = useState("");
  const [testTokenResult, setTestTokenResult] = useState<{
    status: "Accepted" | "Blocked" | "Unknown";
    token?: OcpiToken;
    timestamp: string;
  } | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Metrics calculation
  const totalPartners = partners.length;
  const connectedPartners = partners.filter(
    (p) => p.status === "Connected",
  ).length;
  const totalCdrRevenue = cdrs.reduce((acc, c) => acc + c.totalCost, 0);
  const totalCdrKwh = cdrs.reduce((acc, c) => acc + c.totalEnergyKwh, 0);
  const totalEvsesBroadcast = chargers.reduce(
    (acc, c) => acc + c.evses.length,
    0,
  );

  // Trigger manual partner sync
  const handleSyncPartner = (partnerId: string) => {
    const updated = roamingService.triggerSync(partnerId);
    if (updated) {
      setPartners(roamingService.getPartners());
      setLogs(roamingService.getLogs());
      showToast(
        `Synchronized locations & tariffs with ${updated.name} (OCPI 2.2.1)`,
      );
    }
  };

  // Broadcast all locations and EVSEs to all connected partners
  const handleBroadcastAllLocations = () => {
    setIsPushingLocations(true);
    setTimeout(() => {
      partners.forEach((p) => {
        roamingService.addLog({
          endpoint: "/ocpi/2.2.1/cpo/locations",
          method: "PUT",
          partnerName: p.name,
          statusCode: 200,
          ocpiCode: 1000,
          statusMessage: "Broadcast Successful",
          latencyMs: Math.floor(35 + Math.random() * 45),
          direction: "OUTBOUND",
          payloadSummary: `Pushed ${sites.length} locations & ${totalEvsesBroadcast} EVSEs to ${p.partyId}`,
        });
      });
      setLogs(roamingService.getLogs());
      setIsPushingLocations(false);
      showToast(
        `Successfully broadcasted ${sites.length} locations to all ${partners.length} roaming partners!`,
      );
    }, 900);
  };

  // Test authorize query
  const handleAuthorizeTokenTest = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = testTokenInput.trim();
    if (!clean) return;

    const matched = tokens.find(
      (t) =>
        t.uid.toLowerCase() === clean.toLowerCase() ||
        t.visualNumber.toLowerCase() === clean.toLowerCase(),
    );

    const now = new Date().toLocaleTimeString();

    if (matched && matched.valid) {
      setTestTokenResult({
        status: "Accepted",
        token: matched,
        timestamp: now,
      });
      roamingService.addLog({
        endpoint: `/ocpi/2.2.1/cpo/tokens/${matched.countryCode}/${matched.partyId}/${matched.uid}/authorize`,
        method: "POST",
        partnerName: matched.issuer,
        statusCode: 200,
        ocpiCode: 1000,
        statusMessage: "Token Authorized: Allowed",
        latencyMs: 28,
        direction: "INBOUND",
        payloadSummary: `Live test auth: ${matched.uid} (${matched.contractId})`,
      });
      setLogs(roamingService.getLogs());
    } else {
      setTestTokenResult({ status: "Blocked", timestamp: now });
      roamingService.addLog({
        endpoint: `/ocpi/2.2.1/cpo/tokens/UNKNOWN/${clean}/authorize`,
        method: "POST",
        partnerName: "External eMSP",
        statusCode: 200,
        ocpiCode: 2001,
        statusMessage: "Token Rejected: Not in Whitelist",
        latencyMs: 31,
        direction: "INBOUND",
        payloadSummary: `Token ${clean} not found in authorized whitelist cache`,
      });
      setLogs(roamingService.getLogs());
    }
  };

  // Export CDRs
  const handleExportCdrs = () => {
    const jsonStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(cdrs, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", jsonStr);
    downloadAnchor.setAttribute(
      "download",
      `OCPI_CDRs_${new Date().toISOString().slice(0, 10)}.json`,
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast("Exported roaming CDRs to JSON file.");
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-indigo-500/40 flex items-center gap-2.5 text-xs font-mono animate-in fade-in slide-in-from-bottom-2 duration-150">
          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Roaming Banner */}
      <div className="bg-gradient-to-r from-indigo-50/90 via-white to-purple-50/70 rounded-2xl p-6 text-slate-900 border border-indigo-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 border border-indigo-300 text-indigo-900 text-xs font-mono font-bold tracking-wider uppercase flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-indigo-600" />
              <span>OCPI 2.2.1 Protocol</span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-cyan-100 border border-cyan-300 text-cyan-900 font-mono text-[10px] font-bold">
              CPO Role: US*ZCH
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-900 font-mono text-[10px] font-bold">
              Gateway: Active
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 mt-1.5 flex items-center gap-2">
            <Network className="w-6 h-6 text-indigo-600" />
            <span>OCPI Roaming Management</span>
          </h1>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
            Open Charge Point Interface (OCPI v2.2.1) cross-network roaming hub.
            Broadcast station locations, tariffs, and real-time EVSE
            availability to eMSPs (Hubject, ChargePoint, Shell Recharge, EVgo)
            and exchange standardized Charge Detail Records (CDRs).
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {/* Push Locations to All */}
          <button
            type="button"
            disabled={isPushingLocations}
            onClick={handleBroadcastAllLocations}
            className="btn-3d btn-3d-white flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-800"
            title="Push latest EVSE status to all eMSP partners"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-indigo-600 ${isPushingLocations ? "animate-spin" : ""}`}
            />
            <span>
              {isPushingLocations ? "Broadcasting..." : "Broadcast Locations"}
            </span>
          </button>

          {/* Connect Partner */}
          <button
            type="button"
            onClick={() => setIsAddPartnerOpen(true)}
            className="btn-3d btn-3d-cyan flex items-center gap-2 px-4 py-2 rounded-xl text-white text-xs font-bold shadow-md hover:brightness-105 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Roaming Partner</span>
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white border border-indigo-200 rounded-xl p-3 shadow-xs">
          <div className="text-[10px] uppercase font-mono font-bold text-indigo-700 flex items-center gap-1">
            <Network className="w-3 h-3 text-indigo-600" />
            <span>Connected Partners</span>
          </div>
          <div className="text-xl font-extrabold text-indigo-950 mt-0.5">
            {connectedPartners}
          </div>
          <div className="text-[10px] text-indigo-600 mt-0.5">
            eMSPs & Roaming Hubs
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
          <div className="text-[10px] uppercase font-mono font-bold text-slate-500 flex items-center gap-1">
            <Zap className="w-3 h-3 text-cyan-600" />
            <span>EVSEs Broadcast</span>
          </div>
          <div className="text-xl font-extrabold text-slate-900 mt-0.5">
            {totalEvsesBroadcast}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Live availability synced
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
          <div className="text-[10px] uppercase font-mono font-bold text-slate-500 flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-emerald-600" />
            <span>Roaming CDR Revenue</span>
          </div>
          <div className="text-xl font-extrabold text-emerald-700 mt-0.5">
            ${totalCdrRevenue.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {totalCdrKwh.toFixed(1)} kWh settled
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
          <div className="text-[10px] uppercase font-mono font-bold text-slate-500 flex items-center gap-1">
            <FileSpreadsheet className="w-3 h-3 text-amber-600" />
            <span>CDRs Exchanged</span>
          </div>
          <div className="text-xl font-extrabold text-slate-900 mt-0.5">
            {cdrs.length}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Automated billing records
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
          <div className="text-[10px] uppercase font-mono font-bold text-slate-500 flex items-center gap-1">
            <Key className="w-3 h-3 text-purple-600" />
            <span>Whitelisted Tokens</span>
          </div>
          <div className="text-xl font-extrabold text-slate-900 mt-0.5">
            {tokens.length}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            External RFID & app keys
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200 flex items-center gap-2 overflow-x-auto no-scrollbar">
        {[
          {
            id: "partners",
            label: `Partners Directory (${partners.length})`,
            icon: Network,
          },
          {
            id: "locations",
            label: `Locations & EVSEs (${sites.length})`,
            icon: Building,
          },
          {
            id: "tariffs",
            label: `Tariffs (${tariffs.length})`,
            icon: DollarSign,
          },
          {
            id: "cdrs",
            label: `CDRs & Settlement (${cdrs.length})`,
            icon: FileSpreadsheet,
          },
          {
            id: "tokens",
            label: `Tokens & Whitelist (${tokens.length})`,
            icon: Key,
          },
          {
            id: "logs",
            label: `Protocol Inspector (${logs.length})`,
            icon: Code,
          },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as any)}
              className={`px-3.5 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                isActive
                  ? "border-indigo-600 text-indigo-900 bg-indigo-50/50 rounded-t-lg"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Partners Directory */}
      {activeTab === "partners" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {partners.map((partner) => (
              <div
                key={partner.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:border-indigo-300 transition-all space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-slate-900">
                        {partner.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {partner.countryCode}*{partner.partyId}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                        {partner.role}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        OCPI {partner.ocpiVersion}
                      </span>
                    </div>
                  </div>

                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{partner.status}</span>
                  </span>
                </div>

                {/* Sync statistics */}
                <div className="grid grid-cols-4 gap-2 py-2 border-y border-slate-100 text-center text-xs">
                  <div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Locations
                    </div>
                    <div className="font-bold text-slate-800 mt-0.5">
                      {partner.syncStats.locationsCount}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      EVSEs
                    </div>
                    <div className="font-bold text-slate-800 mt-0.5">
                      {partner.syncStats.evsesCount}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Tariffs
                    </div>
                    <div className="font-bold text-slate-800 mt-0.5">
                      {partner.syncStats.tariffsCount}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      CDRs
                    </div>
                    <div className="font-bold text-indigo-700 mt-0.5">
                      {partner.syncStats.cdrsCount}
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 space-y-1">
                  <div className="flex items-center justify-between">
                    <span>Versions Endpoint:</span>
                    <span
                      className="font-mono text-slate-700 truncate max-w-[170px]"
                      title={partner.versionsUrl}
                    >
                      {partner.versionsUrl}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Last Sync:</span>
                    <span className="font-mono text-slate-700">
                      {partner.lastSync}
                    </span>
                  </div>
                </div>

                {/* Partner Actions */}
                <div className="pt-2 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setViewingJson({
                        title: `OCPI 2.2.1 Handshake Credentials: ${partner.name}`,
                        data: {
                          roles: [
                            {
                              role: partner.role,
                              party_id: partner.partyId,
                              country_code: partner.countryCode,
                            },
                          ],
                          url: partner.versionsUrl,
                          token: partner.tokenA,
                          endpoints: [
                            {
                              identifier: "credentials",
                              url: "/ocpi/2.2.1/credentials",
                            },
                            {
                              identifier: "locations",
                              url: "/ocpi/2.2.1/cpo/locations",
                            },
                            {
                              identifier: "tariffs",
                              url: "/ocpi/2.2.1/cpo/tariffs",
                            },
                            { identifier: "cdrs", url: "/ocpi/2.2.1/cpo/cdrs" },
                            {
                              identifier: "tokens",
                              url: "/ocpi/2.2.1/cpo/tokens",
                            },
                            {
                              identifier: "commands",
                              url: "/ocpi/2.2.1/cpo/commands",
                            },
                          ],
                        },
                      })
                    }
                    className="btn-3d btn-3d-neutral px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 text-slate-700"
                  >
                    <Code className="w-3.5 h-3.5" />
                    <span>Credentials</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSyncPartner(partner.id)}
                    className="btn-3d btn-3d-cyan px-3 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 shadow-xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Sync (Push)</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Locations & EVSEs */}
      {activeTab === "locations" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
            <div>
              <h3 className="text-xs font-bold text-slate-900">
                OCPI 2.2.1 Locations Broadcast Endpoint
                (/ocpi/2.2.1/cpo/locations)
              </h3>
              <p className="text-[11px] text-slate-500">
                Live EVSE availability published to roaming partners with
                real-time status updates.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setViewingJson({
                  title: "OCPI 2.2.1 Locations Response Payload",
                  data: {
                    status_code: 1000,
                    status_message: "Success",
                    timestamp: new Date().toISOString(),
                    data: sites.map((s) => ({
                      id: s.id,
                      type: "ON_STREET",
                      name: s.name,
                      address: s.address,
                      city: s.city,
                      country: "USA",
                      coordinates: { latitude: 29.7604, longitude: -95.3698 },
                      evses: chargers
                        .filter((c) => c.siteId === s.id)
                        .flatMap((c) =>
                          c.evses.map((e) => ({
                            uid: e.id,
                            evse_id: `US*ZCH*E${e.id}`,
                            status: e.connectors.some(
                              (conn) => conn.status === "Charging",
                            )
                              ? "CHARGING"
                              : "AVAILABLE",
                            capabilities: [
                              "REMOTE_START_STOP_CAPABLE",
                              "RFID_READER",
                            ],
                            connectors: e.connectors.map((cn) => ({
                              id: cn.id,
                              standard: cn.type,
                              format: "CABLE",
                              power_type:
                                cn.type === "J1772" ? "AC_1_PHASE" : "DC",
                              max_voltage: cn.voltageV,
                              max_amperage: cn.currentA || 350,
                              max_electric_power: cn.maxPowerKw * 1000,
                              tariff_ids: ["TAR-DCFC-ROAMING-01"],
                            })),
                          })),
                        ),
                    })),
                  },
                })
              }
              className="btn-3d btn-3d-neutral flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700"
            >
              <Code className="w-3.5 h-3.5 text-indigo-600" />
              <span>Inspect OCPI 2.2.1 JSON Schema</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sites.map((site) => {
              const siteChargers = chargers.filter((c) => c.siteId === site.id);
              const totalKw = siteChargers.reduce(
                (acc, c) => acc + c.totalCapacityKw,
                0,
              );

              return (
                <div
                  key={site.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900">
                        {site.name}
                      </h4>
                      <p className="text-xs text-slate-500 font-mono">
                        Location ID: {site.id} • {site.city}, {site.state}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                      OPERATIVE
                    </span>
                  </div>

                  {/* EVSEs summary */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                      <span>
                        Broadcasted EVSEs ({siteChargers.length} stations):
                      </span>
                      <span className="text-indigo-600 font-mono">
                        {totalKw} kW Capacity
                      </span>
                    </div>

                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {siteChargers.map((chg) => (
                        <div
                          key={chg.id}
                          className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                            <div>
                              <div className="font-bold text-slate-800">
                                {chg.name}
                              </div>
                              <div className="text-[10px] font-mono text-slate-400">
                                {chg.id} • {chg.model}
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="px-2 py-0.5 rounded bg-cyan-100 text-cyan-800 font-mono text-[10px] font-bold">
                              {chg.totalCapacityKw} kW
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 3: Tariffs */}
      {activeTab === "tariffs" && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-900">
                OCPI 2.2.1 Tariffs Broadcast Module (/ocpi/2.2.1/cpo/tariffs)
              </h3>
              <p className="text-[11px] text-slate-500">
                Tariffs broadcast to eMSP roaming partners for price
                transparency & driver billing.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tariffs.map((t) => (
              <div
                key={t.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900">
                      {t.title}
                    </h4>
                    <span className="font-mono text-xs text-indigo-700 font-bold">
                      {t.id}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded font-mono text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                    {t.currency}
                  </span>
                </div>

                <div className="space-y-2 py-2 border-y border-slate-100">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                    Tariff Price Elements:
                  </div>
                  {t.elements[0].priceComponents.map((pc, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="font-medium text-slate-700 capitalize">
                        {pc.type.toLowerCase().replace("_", " ")} Component:
                      </span>
                      <span className="font-mono font-bold text-slate-900">
                        ${pc.price.toFixed(2)}{" "}
                        {pc.type === "ENERGY"
                          ? "/ kWh"
                          : pc.type === "PARKING_TIME"
                            ? "/ min"
                            : " flat"}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>
                    Last Updated: {new Date(t.lastUpdated).toLocaleDateString()}
                  </span>
                  <span className="text-emerald-600 font-bold">
                    ✓ Published to Partners
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: CDRs & Settlements */}
      {activeTab === "cdrs" && (
        <div className="space-y-4">
          <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-900">
                Charge Detail Records (CDRs) Exchanged with eMSP Partners
              </h3>
              <p className="text-[11px] text-slate-500">
                Settlement records generated upon completion of roaming charging
                sessions.
              </p>
            </div>

            <button
              type="button"
              onClick={handleExportCdrs}
              className="btn-3d btn-3d-cyan flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-bold"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CDRs (JSON)</span>
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase">
                  <th className="py-3 px-4">CDR ID</th>
                  <th className="py-3 px-4">eMSP Partner</th>
                  <th className="py-3 px-4">Token UID</th>
                  <th className="py-3 px-4">Station / EVSE</th>
                  <th className="py-3 px-4">Energy (kWh)</th>
                  <th className="py-3 px-4">Amount ($)</th>
                  <th className="py-3 px-4">Settlement Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {cdrs.map((cdr) => (
                  <tr
                    key={cdr.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-indigo-900">
                      {cdr.id}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">
                        {cdr.partnerName}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {cdr.partnerPartyId}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                      {cdr.tokenUid}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">
                        {cdr.stationName}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {cdr.evseId}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {cdr.totalEnergyKwh.toFixed(1)} kWh
                    </td>
                    <td className="py-3 px-4 font-mono font-extrabold text-emerald-700">
                      ${cdr.totalCost.toFixed(2)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          cdr.status === "Reconciled"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                            : cdr.status === "Approved"
                              ? "bg-cyan-100 text-cyan-800 border-cyan-300"
                              : "bg-amber-100 text-amber-800 border-amber-300"
                        }`}
                      >
                        {cdr.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Tokens & RFID Whitelist */}
      {activeTab === "tokens" && (
        <div className="space-y-4">
          {/* Test Token Authorize Engine */}
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-5 rounded-2xl text-white border border-indigo-800/40 shadow-md">
            <h3 className="text-xs font-bold flex items-center gap-2">
              <Key className="w-4 h-4 text-indigo-400" />
              <span>Real-Time OCPI Token Authorization Simulator</span>
            </h3>
            <p className="text-[11px] text-indigo-200 mt-1">
              Test authorizing an external roaming driver card via{" "}
              <code className="bg-black/30 px-1 py-0.5 rounded font-mono text-white">
                POST /ocpi/2.2.1/cpo/tokens/{"{country}"}/{"{party}"}/
                {"{token}"}/authorize
              </code>
            </p>

            <form
              onSubmit={handleAuthorizeTokenTest}
              className="mt-3 flex items-center gap-2 max-w-lg"
            >
              <input
                type="text"
                value={testTokenInput}
                onChange={(e) => setTestTokenInput(e.target.value)}
                placeholder="Enter Token UID (e.g. 04A92F1AC908 or CPT-USER-89102)"
                className="flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-mono text-white placeholder-slate-400 focus:outline-none focus:border-indigo-400"
              />
              <button
                type="submit"
                className="btn-3d btn-3d-cyan px-4 py-2 rounded-xl text-white text-xs font-bold shrink-0"
              >
                <span>Authorize</span>
              </button>
            </form>

            {testTokenResult && (
              <div className="mt-3 p-3 rounded-xl bg-white/10 border border-white/15 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {testTokenResult.status === "Accepted" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                  )}
                  <span>
                    Status:{" "}
                    <strong
                      className={
                        testTokenResult.status === "Accepted"
                          ? "text-emerald-300"
                          : "text-rose-300"
                      }
                    >
                      {testTokenResult.status}
                    </strong>{" "}
                    {testTokenResult.token
                      ? `(${testTokenResult.token.issuer})`
                      : "(Not Whitelisted)"}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-300">
                  {testTokenResult.timestamp}
                </span>
              </div>
            )}
          </div>

          {/* Tokens Whitelist Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase">
                  <th className="py-3 px-4">Token UID</th>
                  <th className="py-3 px-4">Card / Pass Visual Number</th>
                  <th className="py-3 px-4">Contract ID</th>
                  <th className="py-3 px-4">Issuer (eMSP)</th>
                  <th className="py-3 px-4">Whitelist Policy</th>
                  <th className="py-3 px-4">Validity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {tokens.map((token) => (
                  <tr
                    key={token.uid}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-indigo-900">
                      {token.uid}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {token.visualNumber}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {token.contractId}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-900">
                        {token.issuer}
                      </span>
                      <span className="ml-1 text-[10px] font-mono text-slate-400">
                        ({token.countryCode}*{token.partyId})
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                        {token.whitelist}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Valid</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 6: Protocol Inspector / Logs */}
      {activeTab === "logs" && (
        <div className="space-y-4">
          <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-900">
                OCPI 2.2.1 Real-Time HTTP Protocol Traffic Stream
              </h3>
              <p className="text-[11px] text-slate-500">
                Inspect incoming queries and outgoing sync requests across
                roaming partners.
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase">
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Method & Endpoint</th>
                  <th className="py-3 px-4">Partner</th>
                  <th className="py-3 px-4">Status & OCPI Code</th>
                  <th className="py-3 px-4">Latency</th>
                  <th className="py-3 px-4">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {log.timestamp}
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-1.5 py-0.2 rounded font-mono text-[9px] font-extrabold ${
                            log.method === "GET"
                              ? "bg-cyan-100 text-cyan-800"
                              : log.method === "POST"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {log.method}
                        </span>
                        <span className="font-mono text-[11px] font-semibold text-slate-800 truncate max-w-[220px]">
                          {log.endpoint}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-medium text-slate-800">
                      {log.partnerName}
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold">
                          {log.statusCode} OK
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          (Code: {log.ocpiCode})
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {log.latencyMs}ms
                    </td>

                    <td className="py-3 px-4 text-slate-600 text-[11px] truncate max-w-[260px]">
                      {log.payloadSummary || "OCPI Request Processed"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Partner Modal */}
      <AddPartnerModal
        isOpen={isAddPartnerOpen}
        onClose={() => setIsAddPartnerOpen(false)}
        onAddPartner={(newP) => {
          const added = roamingService.addPartner(newP);
          setPartners(roamingService.getPartners());
          setLogs(roamingService.getLogs());
          showToast(`Successfully registered partner ${added.name}!`);
        }}
      />

      {/* JSON Inspector Modal */}
      {viewingJson && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in"
          role="dialog"
        >
          <div className="bg-slate-900 text-slate-100 rounded-2xl p-6 max-w-2xl w-full shadow-2xl border border-slate-800 space-y-3 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
                <Code className="w-4 h-4" />
                <span>{viewingJson.title}</span>
              </h3>
              <button
                type="button"
                onClick={() => setViewingJson(null)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Close
              </button>
            </div>

            <pre className="flex-1 overflow-auto bg-slate-950 p-4 rounded-xl text-[11px] font-mono text-cyan-300 border border-slate-800">
              {JSON.stringify(viewingJson.data, null, 2)}
            </pre>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(
                    JSON.stringify(viewingJson.data, null, 2),
                  );
                  showToast("Copied JSON payload to clipboard.");
                }}
                className="btn-3d btn-3d-cyan px-4 py-1.5 rounded-lg text-xs font-bold text-white"
              >
                Copy JSON
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
