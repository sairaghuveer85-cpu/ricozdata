import React from 'react';
import { DATA_HEALTH_SUMMARY } from '../../data/dashboard';

export default function DataHealthCard() {
  const { score, maxScore, status, dimensions } = DATA_HEALTH_SUMMARY;

  return (
    <div
      className="p-5 rounded-lg flex flex-col justify-between h-full"
      style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '8px'
      }}
    >
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          DATA HEALTH
        </div>

        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {score}
          </span>
          <span className="text-sm font-medium text-slate-400 dark:text-slate-500">
            / {maxScore}
          </span>
        </div>

        <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
          {status}
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
        {dimensions.map((dim) => (
          <div key={dim.name}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-600 dark:text-slate-300 font-medium">
                {dim.name}
              </span>
              <span className="text-slate-900 dark:text-white font-semibold">
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
