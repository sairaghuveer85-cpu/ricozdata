import React from 'react';

export function Skeleton({ className = '' }) {
  return (
    <div className={`skeleton-shimmer bg-slate-200/80 dark:bg-slate-800 rounded ${className}`} />
  );
}

export function MetricSkeleton() {
  return (
    <div className="bg-white dark:bg-[#0B1628] rounded-xl p-5 border border-slate-200 dark:border-slate-800 space-y-3">
      <div className="flex justify-between items-center">
        <Skeleton className="w-10 h-10 rounded-lg" />
        <Skeleton className="w-14 h-5 rounded-full" />
      </div>
      <Skeleton className="w-24 h-8 mt-3" />
      <Skeleton className="w-32 h-4" />
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 5 }) {
  return (
    <div className="bg-white dark:bg-[#0B1628] rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
      <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
        <Skeleton className="w-48 h-5" />
        <Skeleton className="w-24 h-8 rounded-lg" />
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 py-2">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white dark:bg-[#0B1628] rounded-xl p-5 border border-slate-200 dark:border-slate-800 space-y-4">
      <Skeleton className="w-36 h-5" />
      <Skeleton className="w-full h-32 rounded-lg" />
      <div className="space-y-2">
        <Skeleton className="w-3/4 h-4" />
        <Skeleton className="w-1/2 h-4" />
      </div>
    </div>
  );
}
