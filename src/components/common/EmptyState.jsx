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
      className={`ui-empty-state flex flex-col items-center justify-center p-8 sm:p-10 text-center rounded-lg border ${className}`}
    >
      <div className="ui-empty-state__icon w-12 h-12 rounded-full flex items-center justify-center mb-3" aria-hidden="true">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="ui-empty-state__title text-sm font-semibold">{title}</h3>
      <p className="ui-empty-state__description mt-1.5 text-xs max-w-sm leading-relaxed">{description}</p>
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
