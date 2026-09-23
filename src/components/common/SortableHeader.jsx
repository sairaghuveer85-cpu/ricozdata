import React from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

/**
 * Accessible sortable table header button.
 * Shows tri-state indicator: none → asc ↑ → desc ↓
 */
export default function SortableHeader({
  label,
  sortKey,
  currentSortKey,
  currentDirection,
  onSort,
  className = ''
}) {
  const isActive = currentSortKey === sortKey;

  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      aria-label={`Sort by ${label}${isActive ? (currentDirection === 'asc' ? ', currently ascending' : ', currently descending') : ''}`}
      className={`inline-flex items-center gap-1 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-sm py-0.5 ${className}`}
      style={{ color: isActive ? 'var(--color-brand)' : undefined }}
    >
      <span>{label}</span>
      {isActive ? (
        currentDirection === 'asc' ? (
          <ArrowUp className="w-3 h-3" aria-hidden="true" />
        ) : (
          <ArrowDown className="w-3 h-3" aria-hidden="true" />
        )
      ) : (
        <ArrowUpDown className="w-3 h-3 opacity-40" aria-hidden="true" />
      )}
    </button>
  );
}
