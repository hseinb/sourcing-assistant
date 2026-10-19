import React from 'react';
import { ContainerType } from '@/lib/types';
import { getContainerMaxCBM } from '@/lib/utils/formatters';

interface CBMUtilizationBarProps {
  currentCbm: number;
  containerType: ContainerType;
  customMaxCbm?: number;
  totalCartons?: number;
  totalWeightKg?: number;
}

export function CBMUtilizationBar({
  currentCbm,
  containerType,
  customMaxCbm,
  totalCartons = 0,
  totalWeightKg = 0,
}: CBMUtilizationBarProps) {
  const maxCbm = customMaxCbm || getContainerMaxCBM(containerType);
  const percentage = Math.min(Math.round((currentCbm / maxCbm) * 100), 100);
  const remainingCbm = Math.max(0, maxCbm - currentCbm);
  const isOverfilled = currentCbm > maxCbm;

  let colorClass = 'bg-blue-600';
  if (percentage >= 95 && !isOverfilled) colorClass = 'bg-emerald-500';
  else if (percentage >= 80) colorClass = 'bg-amber-500';
  else if (isOverfilled) colorClass = 'bg-rose-500';

  return (
    <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-lg border border-slate-800">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-bold uppercase tracking-wider">
            {containerType}
          </span>
          <h4 className="font-bold text-sm text-slate-200">Container Volume Utilization</h4>
        </div>

        <div className="text-right flex sm:block items-baseline justify-between">
          <span className="text-2xl font-black text-white tracking-tight">
            {currentCbm.toFixed(2)}{' '}
            <span className="text-xs font-medium text-slate-400">/ {maxCbm} CBM</span>
          </span>
          <span className={`text-xs font-bold ml-2 ${isOverfilled ? 'text-rose-400' : 'text-emerald-400'}`}>
            ({percentage}% full{isOverfilled ? ' - OVERFILLED!' : ''})
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      {/* Bottom Summary Stats */}
      <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800/80 text-center text-xs">
        <div>
          <span className="text-slate-400 block text-[11px]">Remaining Space</span>
          <span className="font-bold text-slate-200 text-sm">{remainingCbm.toFixed(2)} CBM</span>
        </div>
        <div>
          <span className="text-slate-400 block text-[11px]">Total Cartons</span>
          <span className="font-bold text-slate-200 text-sm">{totalCartons} ctns</span>
        </div>
        <div>
          <span className="text-slate-400 block text-[11px]">Gross Weight</span>
          <span className="font-bold text-slate-200 text-sm">{(totalWeightKg / 1000).toFixed(2)} Tons</span>
        </div>
      </div>
    </div>
  );
}
