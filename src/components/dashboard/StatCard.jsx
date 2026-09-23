import React from 'react';
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

export default function StatCard({
  title,
  value,
  comparisonText,
  isPositive = true,
  trendType = 'positive'
}) {
  const getTrendStyle = () => {
    if (trendType === 'warning') {
      return {
        text: 'text-amber-700 dark:text-amber-400',
        bg: 'bg-amber-50 dark:bg-amber-950/40',
        border: 'border-amber-200 dark:border-amber-900/50',
        icon: AlertTriangle
      };
    }
    if (isPositive) {
      return {
        text: 'text-emerald-700 dark:text-emerald-400',
        bg: 'bg-emerald-50 dark:bg-emerald-950/40',
        border: 'border-emerald-200 dark:border-emerald-900/50',
        icon: TrendingUp
      };
    }
    return {
      text: 'text-rose-700 dark:text-rose-400',
      bg: 'bg-rose-50 dark:bg-rose-950/40',
      border: 'border-rose-200 dark:border-rose-900/50',
      icon: TrendingDown
    };
  };

  const trend = getTrendStyle();
  const TrendIcon = trend.icon;

  return (
    <div className="p-3.5 sm:p-4 flex flex-col justify-between min-w-0 transition-colors">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate select-none">
        {title}
      </div>

      <div className="my-1.5 flex items-baseline gap-2">
        <span className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white truncate tabular-nums">
          {value}
        </span>
      </div>

      <div className="flex items-center gap-1.5 text-[11px] truncate">
        <span
          className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-xs font-semibold border ${trend.bg} ${trend.text} ${trend.border} shrink-0`}
        >
          <TrendIcon className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
          <span>{comparisonText.split(' ')[0]}</span>
        </span>
        <span className="text-slate-400 dark:text-slate-500 truncate">
          {comparisonText.split(' ').slice(1).join(' ')}
        </span>
      </div>
    </div>
  );
}
