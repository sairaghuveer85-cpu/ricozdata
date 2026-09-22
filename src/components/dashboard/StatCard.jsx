import React from 'react';

export default function StatCard({
  title,
  value,
  comparisonText,
  isPositive = true,
  trendType = 'neutral' // 'positive', 'negative', 'warning'
}) {
  const getTrendColor = () => {
    if (trendType === 'warning') return 'text-amber-600 dark:text-amber-400';
    if (isPositive) return 'text-emerald-600 dark:text-emerald-400';
    return 'text-rose-600 dark:text-rose-400';
  };

  return (
    <div className="p-4 sm:p-5 flex flex-col justify-between">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {title}
      </div>

      <div className="my-1.5">
        <div className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          {value}
        </div>
      </div>

      <div className={`text-xs ${getTrendColor()} font-medium flex items-center gap-1`}>
        <span>{comparisonText}</span>
      </div>
    </div>
  );
}
