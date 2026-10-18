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
  let dotColor = 'ui-badge__dot--neutral';

  if (status) {
    switch (status) {
      case 'Certified':
      case 'Active':
      case 'active':
      case 'Resolved':
      case 'resolved':
      case 'Compliant':
        styleClasses = 'ui-badge--success';
        dotColor = 'ui-badge__dot--success';
        break;
      case 'In Review':
      case 'In Progress':
      case 'investigating':
      case 'Warning':
      case 'Medium':
        styleClasses = 'ui-badge--warning';
        dotColor = 'ui-badge__dot--warning';
        break;
      case 'Open':
      case 'open':
      case 'High':
      case 'Danger':
        styleClasses = 'ui-badge--danger';
        dotColor = 'ui-badge__dot--danger';
        break;
      case 'Low':
        styleClasses = 'ui-badge--neutral';
        dotColor = 'ui-badge__dot--neutral';
        break;
      case 'Inactive':
      case 'Not Certified':
        styleClasses = 'ui-badge--neutral';
        dotColor = 'ui-badge__dot--neutral';
        break;
      default:
        styleClasses = 'ui-badge--neutral';
        dotColor = 'ui-badge__dot--neutral';
    }
  } else {
    const variants = {
      default: 'ui-badge--neutral',
      primary: 'ui-badge--primary',
      success: 'ui-badge--success',
      warning: 'ui-badge--warning',
      danger: 'ui-badge--danger',
      purple: 'ui-badge--primary',
      tag: 'ui-badge--tag'
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
      className={`ui-badge inline-flex items-center gap-1.5 font-medium rounded-md border ${styleClasses} ${sizes[size] || sizes.md} ${className}`}
    >
      {dot && (
        <span className={`ui-badge__dot w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} aria-hidden="true" />
      )}
      <span>{children || status}</span>
    </span>
  );
}
