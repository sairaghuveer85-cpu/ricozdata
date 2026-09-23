import React from 'react';

export default function Badge({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  className = '',
  status
}) {
  let styleClasses;
  let dotColor = 'bg-slate-400';

  if (status) {
    switch (status) {
      case 'Certified':
      case 'Active':
      case 'active':
      case 'Resolved':
      case 'resolved':
      case 'Compliant':
        styleClasses = 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/80';
        dotColor = 'bg-emerald-500';
        break;
      case 'In Review':
      case 'In Progress':
      case 'investigating':
      case 'Warning':
      case 'Medium':
        styleClasses = 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/80';
        dotColor = 'bg-amber-500';
        break;
      case 'Open':
      case 'open':
      case 'High':
      case 'Danger':
        styleClasses = 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800/80';
        dotColor = 'bg-rose-500';
        break;
      case 'Low':
        styleClasses = 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
        dotColor = 'bg-slate-500';
        break;
      case 'Inactive':
      case 'Not Certified':
        styleClasses = 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';
        dotColor = 'bg-slate-400';
        break;
      default:
        styleClasses = 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
        dotColor = 'bg-slate-400';
    }
  } else {
    const variants = {
      default: 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
      primary: 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/80',
      success: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/80',
      warning: 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/80',
      danger: 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800/80',
      purple: 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/80',
      tag: 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-900/50 font-normal'
    };
    styleClasses = variants[variant] || variants.default;
  }

  const sizes = {
    xs: 'text-[10px] px-1.5 py-0.5',
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-0.5',
    lg: 'text-xs px-3 py-1'
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-md border ${styleClasses} ${sizes[size] || sizes.md} ${className}`}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} aria-hidden="true" />
      )}
      <span>{children || status}</span>
    </span>
  );
}
