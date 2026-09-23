import { useState, useMemo } from 'react';

/**
 * Reusable tri-state table sort hook.
 * Cycles: ascending → descending → none (default order).
 *
 * @param {Array} data - Array of objects to sort
 * @param {Object} options - Optional default sort key/direction
 * @returns {{ sortKey, sortDirection, handleSort, sortedData, resetSort }}
 */
export default function useTableSort(data = [], options = {}) {
  const [sortKey, setSortKey] = useState(options.defaultKey || null);
  const [sortDirection, setSortDirection] = useState(options.defaultDirection || null);

  const handleSort = (key) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDirection('asc');
    } else if (sortDirection === 'asc') {
      setSortDirection('desc');
    } else {
      setSortKey(null);
      setSortDirection(null);
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey || !sortDirection) return data;

    return [...data].sort((a, b) => {
      let aVal = a[sortKey];
      let bVal = b[sortKey];

      // Handle null/undefined
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      // Numeric comparison
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      // String comparison (case-insensitive)
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      const cmp = aStr.localeCompare(bStr);
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDirection]);

  const resetSort = () => {
    setSortKey(null);
    setSortDirection(null);
  };

  return { sortKey, sortDirection, handleSort, sortedData, resetSort };
}
