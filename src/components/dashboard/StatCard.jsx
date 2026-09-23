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
    <div className="p-3 sm:p-5 flex flex-col justify-between min-w-0">
      <div className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
        {title}
      </div>

      <div className="my-1 sm:my-1.5">
        <div className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-slate-900 dark:text-white truncate">
          {value}
        </div>
      </div>

      <div className={`text-[11px] sm:text-xs ${getTrendColor()} font-medium flex items-center gap-1`}>
        <span className="truncate">{comparisonText}</span>
      </div>
    </div>
  );
}
