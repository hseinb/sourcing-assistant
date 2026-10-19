import React from 'react';
import { SourcingPurchaseOrder, ContainerType } from '@/lib/types';
import { getContainerMaxCBM, getContainerMaxPayloadKg, formatCNY } from '@/lib/utils/formatters';
import { Package, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface ContainerStuffingDiagramProps {
  containerType: ContainerType;
  maxCbm: number;
  linkedOrders: SourcingPurchaseOrder[];
  containerNumber?: string | null;
}

const SUPPLIER_PALETTE = [
  { bg: 'bg-blue-500', border: 'border-blue-600', text: 'text-blue-950', badge: 'bg-blue-100 text-blue-800' },
  { bg: 'bg-emerald-500', border: 'border-emerald-600', text: 'text-emerald-950', badge: 'bg-emerald-100 text-emerald-800' },
  { bg: 'bg-purple-500', border: 'border-purple-600', text: 'text-purple-950', badge: 'bg-purple-100 text-purple-800' },
  { bg: 'bg-amber-500', border: 'border-amber-600', text: 'text-amber-950', badge: 'bg-amber-100 text-amber-800' },
  { bg: 'bg-rose-500', border: 'border-rose-600', text: 'text-rose-950', badge: 'bg-rose-100 text-rose-800' },
  { bg: 'bg-cyan-500', border: 'border-cyan-600', text: 'text-cyan-950', badge: 'bg-cyan-100 text-cyan-800' },
  { bg: 'bg-indigo-500', border: 'border-indigo-600', text: 'text-indigo-950', badge: 'bg-indigo-100 text-indigo-800' },
];

export function ContainerStuffingDiagram({
  containerType,
  maxCbm,
  linkedOrders,
  containerNumber,
}: ContainerStuffingDiagramProps) {
  const effectiveMaxCbm = maxCbm || getContainerMaxCBM(containerType);
  const maxPayloadKg = getContainerMaxPayloadKg(containerType);

  const totalUsedCbm = linkedOrders.reduce((sum, po) => sum + Number(po.total_cbm || 0), 0);
  const totalCartons = linkedOrders.reduce((sum, po) => sum + Number(po.total_cartons || 0), 0);
  const totalWeightKg = linkedOrders.reduce((sum, po) => sum + Number(po.total_weight_kg || 0), 0);

  const totalWeightTons = totalWeightKg / 1000;
  const maxPayloadTons = maxPayloadKg / 1000;

  const usedPercentage = Math.min(Math.round((totalUsedCbm / effectiveMaxCbm) * 100), 100);
  const weightPercentage = Math.min(Math.round((totalWeightKg / maxPayloadKg) * 100), 100);

  const isOverfilledVolume = totalUsedCbm > effectiveMaxCbm;
  const isOverweight = totalWeightKg > maxPayloadKg;
  const remainingCbm = Math.max(0, effectiveMaxCbm - totalUsedCbm);

  return (
    <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl border border-slate-800 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-amber-500 text-slate-950 font-black rounded-lg text-xs tracking-wider uppercase">
            {containerType}
          </span>
          <div>
            <h3 className="font-bold text-base text-white tracking-tight">
              Interactive Container Stuffing & Volume Map
            </h3>
            <p className="text-xs text-slate-400">
              {containerNumber || 'Container'} • Max Capacity: {effectiveMaxCbm} CBM • Max Payload: {maxPayloadTons} Tons
            </p>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-2">
          {isOverweight ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-bold">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Overweight (+{(totalWeightTons - maxPayloadTons).toFixed(2)}T)</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Weight Compliant</span>
            </span>
          )}
        </div>
      </div>

      {/* 2D Container Cross-Section Stuffing Visualizer */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
          <span>Front (Door)</span>
          <span className="text-amber-400 font-bold">
            {totalUsedCbm.toFixed(2)} / {effectiveMaxCbm} CBM ({usedPercentage}%)
          </span>
          <span>Rear (Interior)</span>
        </div>

        {/* Physical Container Shell */}
        <div className="relative w-full h-24 bg-slate-950 rounded-xl border-2 border-slate-700 p-1 flex overflow-hidden shadow-inner">
          {linkedOrders.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
              Container is currently empty. Attach Purchase Orders below to visualize volume stuffing.
            </div>
          ) : (
            <>
              {linkedOrders.map((po, idx) => {
                const poCbm = Number(po.total_cbm || 0);
                const widthPercent = (poCbm / effectiveMaxCbm) * 100;
                const palette = SUPPLIER_PALETTE[idx % SUPPLIER_PALETTE.length];

                return (
                  <div
                    key={po.id}
                    style={{ width: `${widthPercent}%` }}
                    className={`h-full ${palette.bg} border-r-2 border-slate-950/80 p-2 flex flex-col justify-between overflow-hidden relative group hover:brightness-110 transition-all cursor-pointer`}
                    title={`${po.supplier?.name || 'Supplier'} (${po.po_number}): ${po.total_cbm.toFixed(2)} CBM (${widthPercent.toFixed(1)}%)`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-black text-slate-950 truncate block">
                        {po.supplier?.name || `PO ${idx + 1}`}
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-900 font-bold truncate">
                      {po.total_cartons} ctns • {po.total_cbm.toFixed(1)} m³
                    </div>
                  </div>
                );
              })}

              {/* Remaining Empty Space */}
              {remainingCbm > 0 && (
                <div
                  style={{ width: `${(remainingCbm / effectiveMaxCbm) * 100}%` }}
                  className="h-full bg-slate-800/40 border border-dashed border-slate-700/60 p-2 flex flex-col items-center justify-center text-center overflow-hidden"
                >
                  <span className="text-[11px] font-bold text-slate-400">
                    Empty Space
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {remainingCbm.toFixed(2)} CBM left
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Dual Progress Bars: Volume vs Weight */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        {/* Volume Utilization */}
        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400 font-medium">Volume Utilization (CBM)</span>
            <span className={`font-bold ${isOverfilledVolume ? 'text-rose-400' : 'text-amber-400'}`}>
              {totalUsedCbm.toFixed(2)} / {effectiveMaxCbm} m³ ({usedPercentage}%)
            </span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isOverfilledVolume ? 'bg-rose-500' : usedPercentage >= 90 ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
              style={{ width: `${Math.min(usedPercentage, 100)}%` }}
            />
          </div>
        </div>

        {/* Cargo Weight Payload */}
        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400 font-medium">Payload Weight (Max {maxPayloadTons}T)</span>
            <span className={`font-bold ${isOverweight ? 'text-rose-400' : 'text-blue-400'}`}>
              {totalWeightTons.toFixed(2)} / {maxPayloadTons} Tons ({weightPercentage}%)
            </span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isOverweight ? 'bg-rose-500' : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min(weightPercentage, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Supplier Color Legend Breakdown */}
      {linkedOrders.length > 0 && (
        <div className="pt-3 border-t border-slate-800/80 space-y-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Consolidated Supplier Breakdown
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {linkedOrders.map((po, idx) => {
              const palette = SUPPLIER_PALETTE[idx % SUPPLIER_PALETTE.length];
              const poCbm = Number(po.total_cbm || 0);
              const pct = ((poCbm / effectiveMaxCbm) * 100).toFixed(1);

              return (
                <div
                  key={po.id}
                  className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-3 h-3 rounded-full shrink-0 ${palette.bg}`} />
                    <div className="min-w-0">
                      <strong className="text-slate-200 block truncate">{po.supplier?.name || 'Supplier'}</strong>
                      <span className="text-[10px] text-slate-400 font-mono">{po.po_number}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <strong className="text-white font-mono block">{poCbm.toFixed(2)} CBM</strong>
                    <span className="text-[10px] text-amber-400 font-bold">{pct}% of load</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
