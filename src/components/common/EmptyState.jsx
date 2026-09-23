import React from 'react';
import Button from './Button';
import { Database } from 'lucide-react';

export default function EmptyState({
  icon: Icon = Database,
  title = 'No items found',
  description = 'Try adjusting your search query or active filter criteria.',
  actionLabel,
  onAction,
  actionIcon,
  className = ''
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center p-8 sm:p-10 text-center bg-white dark:bg-[#0D1828] rounded-lg border border-slate-200 dark:border-[#1D3047] shadow-2xs ${className}`}
    >
      <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-[#111E30] flex items-center justify-center text-slate-400 dark:text-slate-500 mb-3" aria-hidden="true">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-[#F8FAFC]">{title}</h3>
      <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <div className="mt-4">
          <Button size="sm" onClick={onAction} icon={actionIcon}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
