import React from 'react';
import { DATA_HEALTH_SUMMARY } from '../../data/dashboard';
import { useApp } from '../../context/AppContext';

export default function DataHealthCard() {
  const { dataHealthSummary } = useApp();
  const { score, maxScore, status, dimensions } = dataHealthSummary || DATA_HEALTH_SUMMARY;

  return (
    <div className="flex flex-col justify-between h-full">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 select-none">
          Reliability Index
        </div>

        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
            {score}
          </span>
          <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
            / {maxScore} Target
          </span>
        </div>

        <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          <span>{status} (SLA Met)</span>
        </div>
      </div>

      <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-[#1D3047] space-y-2.5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
          Quality Dimensions
        </div>
        {dimensions.map((dim) => (
          <div key={dim.name}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-600 dark:text-slate-300 font-medium">
                {dim.name}
              </span>
              <span className="text-slate-900 dark:text-white font-semibold tabular-nums text-xs">
                {dim.score}%
              </span>
            </div>
            <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-xs overflow-hidden">
              <div
                className="h-full bg-emerald-600 dark:bg-emerald-500 rounded-xs transition-all duration-300"
                style={{ width: `${dim.score}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
