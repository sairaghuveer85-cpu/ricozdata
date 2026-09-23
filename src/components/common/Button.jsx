import React from 'react';
import { Loader2 } from 'lucide-react';

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  icon: Icon,
  iconPosition = 'left',
  disabled = false,
  loading = false,
  onClick,
  type = 'button',
  'aria-label': ariaLabel,
  ...props
}) {
  const baseStyles = 'inline-flex items-center justify-center font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#07111F] disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none cursor-pointer select-none';

  const variants = {
    primary: 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white border border-transparent shadow-xs',
    secondary: 'bg-white dark:bg-[#0D1828] hover:bg-slate-50 dark:hover:bg-[#111E30] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#1D3047] shadow-2xs',
    outline: 'bg-transparent border border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30',
    ghost: 'bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-300',
    danger: 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-xs border border-transparent',
    subtle: 'bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50'
  };

  const sizes = {
    xs: 'px-2 py-1 text-xs rounded-md gap-1',
    sm: 'px-2.5 py-1.5 text-xs rounded-md gap-1.5',
    md: 'px-3.5 py-1.5 text-xs sm:text-sm rounded-md gap-2',
    lg: 'px-4 py-2 text-sm rounded-md gap-2'
  };

  const iconSizes = {
    xs: 'w-3 h-3',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-4 h-4'
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading ? 'true' : undefined}
      aria-label={ariaLabel}
      onClick={onClick}
      className={`${baseStyles} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className={`animate-spin ${iconSizes[size] || 'w-4 h-4'}`} aria-hidden="true" />
      ) : (
        Icon && iconPosition === 'left' && <Icon className={iconSizes[size] || 'w-4 h-4'} aria-hidden="true" />
      )}
      {children !== undefined && children !== null && (
        <span className="truncate">{children}</span>
      )}
      {!loading && Icon && iconPosition === 'right' && (
        <Icon className={iconSizes[size] || 'w-4 h-4'} aria-hidden="true" />
      )}
    </button>
  );
}
