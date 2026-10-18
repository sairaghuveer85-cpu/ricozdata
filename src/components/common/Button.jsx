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
  const variants = {
    primary: 'ui-button--primary',
    secondary: 'ui-button--secondary',
    outline: 'ui-button--outline',
    ghost: 'ui-button--ghost',
    danger: 'ui-button--danger',
    subtle: 'ui-button--subtle'
  };

  const sizes = {
    xs: 'ui-button--xs',
    sm: 'ui-button--sm',
    md: 'ui-button--md',
    lg: 'ui-button--lg'
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
      className={`ui-button ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
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
