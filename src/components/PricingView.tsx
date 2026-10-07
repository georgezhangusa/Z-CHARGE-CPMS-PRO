import React, { useState } from 'react';
import {
  DollarSign,
  Clock,
  Zap,
  ShieldCheck,
  Check,
  AlertCircle,
  TrendingUp,
  Percent,
} from 'lucide-react';
import { TariffProfile } from '../types';
import { INITIAL_TARIFFS } from '../data/mockData';
import { formatCurrency } from '../utils';

export const PricingView: React.FC = () => {
  const [tariffs, setTariffs] = useState(INITIAL_TARIFFS);
  const [selectedType, setSelectedType] = useState<'DCFC' | 'AC_L2'>('DCFC');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const currentProfile = tariffs[selectedType];

  const handleUpdateBaseRate = (val: number) => {
    setTariffs((prev) => ({
      ...prev,
      [selectedType]: {
        ...prev[selectedType],
        baseRatePerKwh: val,
      },
    }));
  };

  const handleUpdateIdleFee = (val: number) => {
    setTariffs((prev) => ({
      ...prev,
      [selectedType]: {
        ...prev[selectedType],
        idleFeePerMin: val,
      },
    }));
  };

  const handleUpdateGracePeriod = (val: number) => {
    setTariffs((prev) => ({
      ...prev,
      [selectedType]: {
        ...prev[selectedType],
        gracePeriodMinutes: val,
      },
    }));
  };

  const handleSaveTariff = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Intro Header */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-amber-600" />
            Tariff Engineering, ToU Matrix & Idle Fee Controls
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure differential pricing for DC Fast vs AC Level 2, demand-charge mitigation, and grace periods.
          </p>
        </div>

        {savedSuccess && (
          <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold flex items-center gap-1.5 animate-in fade-in">
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            Tariff Profile Applied
          </span>
        )}
      </div>

      {/* Category Tabs: DC Fast Charging vs AC Level 2 */}
      <div className="flex rounded-xl bg-slate-100 p-1.5 border border-slate-200 text-xs gap-1.5">
        <button
          type="button"
          id="tab-tariff-dcfc"
          onClick={() => setSelectedType('DCFC')}
          className={`btn-3d flex-1 py-2.5 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
            selectedType === 'DCFC'
              ? 'btn-3d-cyan text-white'
              : 'bg-transparent text-slate-600 hover:text-slate-900 border-0 shadow-none'
          }`}
        >
          <Zap className="w-4 h-4 text-white" />
          <span>DC Fast Charging (CCS1 / NACS)</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-cyan-900/40 rounded-sm text-white font-semibold">High kW</span>
        </button>

        <button
          type="button"
          id="tab-tariff-acl2"
          onClick={() => setSelectedType('AC_L2')}
          className={`btn-3d flex-1 py-2.5 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
            selectedType === 'AC_L2'
              ? 'btn-3d-white text-emerald-800'
              : 'bg-transparent text-slate-600 hover:text-slate-900 border-0 shadow-none'
          }`}
        >
          <Clock className="w-4 h-4 text-emerald-600" />
          <span>AC Level 2 Commercial (J1772)</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-200 rounded-sm text-slate-700 font-semibold">Low kW</span>
        </button>
      </div>

      {/* Active Tariff Form */}
      <form onSubmit={handleSaveTariff} className="space-y-6">
        {/* Base Energy Rate & Idle Fee Settings */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Base Rate */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-2">
            <label className="text-xs font-semibold text-slate-700 block">
              Base Energy Rate ($/kWh)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">$</span>
              <input
                type="number"
                step="0.01"
                min="0.05"
                max="1.50"
                value={currentProfile.baseRatePerKwh}
                onChange={(e) => handleUpdateBaseRate(parseFloat(e.target.value) || 0)}
                className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono text-slate-900 font-bold focus:outline-hidden focus:border-cyan-500"
              />
            </div>
            <p className="text-[10px] text-slate-500">Standard daytime energy tariff</p>
          </div>

          {/* Idle Fee */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-2">
            <label className="text-xs font-semibold text-slate-700 block">
              Overstay Idle Fee ($/min)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">$</span>
              <input
                type="number"
                step="0.05"
                min="0"
                max="2.00"
                value={currentProfile.idleFeePerMin}
                onChange={(e) => handleUpdateIdleFee(parseFloat(e.target.value) || 0)}
                className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono text-slate-900 font-bold focus:outline-hidden focus:border-cyan-500"
              />
            </div>
            <p className="text-[10px] text-slate-500">Billed when charge completed at 0 kW</p>
          </div>

          {/* Grace Period Input (Crucial Improvement) */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-2">
            <label className="text-xs font-semibold text-slate-700 block flex items-center justify-between">
              <span>Grace Period Duration</span>
              <span className="text-[10px] text-emerald-700 font-mono font-semibold">No Fee Window</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="1"
                min="0"
                max="60"
                value={currentProfile.gracePeriodMinutes}
                onChange={(e) => handleUpdateGracePeriod(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono text-slate-900 font-bold focus:outline-hidden focus:border-cyan-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">minutes</span>
            </div>
            <p className="text-[10px] text-slate-500">Driver has {currentProfile.gracePeriodMinutes}m to unplug before idle fee begins</p>
          </div>
        </div>

        {/* Time-of-Use (ToU) Schedule Visualizer */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-600" />
                Time-of-Use (ToU) Rate Schedule
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Dynamic pricing tiers to reflect utility on-peak demand charges and encourage off-peak utilization.
              </p>
            </div>
            <span className="text-xs font-mono text-cyan-700 font-semibold">
              {currentProfile.touPeriods.length} Rate Tiers Active
            </span>
          </div>

          {/* Rate Tiers Table */}
          <div className="space-y-2.5">
            {currentProfile.touPeriods.map((tier) => (
              <div
                key={tier.name}
                className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                  tier.isCurrent
                    ? 'bg-cyan-50/70 border-cyan-300 text-cyan-900 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-cyan-600" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-xs">{tier.name}</span>
                      {tier.isCurrent && (
                        <span className="px-1.5 py-0.5 rounded-sm bg-cyan-100 text-cyan-800 text-[9px] font-mono uppercase font-bold border border-cyan-200">
                          Current Tier
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono">{tier.hours}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 sm:justify-end">
                  <div className="text-right">
                    <span className="text-slate-500 block text-[10px] font-medium">RATE</span>
                    <span className="font-mono text-sm font-bold text-slate-900">
                      ${tier.ratePerKwh.toFixed(2)} / kWh
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            id="save-tariff-config-btn"
            className="btn-3d btn-3d-cyan px-6 py-2.5 text-white font-bold text-xs flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>Publish Tariff Configuration</span>
          </button>
        </div>
      </form>
    </div>
  );
};
