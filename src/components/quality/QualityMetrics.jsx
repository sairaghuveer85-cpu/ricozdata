import React from 'react';

export default function QualityMetrics({ dimensions = [] }) {
  return (
    <div
      className="theme-card rounded-lg p-6 shadow-2xs flex flex-col justify-center h-full border border-slate-200 dark:border-slate-800"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
          Quality Dimensions Breakdown
        </h3>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">Target: ≥ 95%</span>
      </div>

      <div className="space-y-3.5">
        {dimensions.map((dim, idx) => (
          <div key={idx}>
            <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
              <span className="text-slate-700 dark:text-slate-300">{dim.name}</span>
              <span className="font-semibold text-slate-900 dark:text-white">{dim.score}%</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-xs h-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-2 rounded-xs transition-all duration-500"
                style={{ width: `${dim.score}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
