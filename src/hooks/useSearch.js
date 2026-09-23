import { useState, useMemo } from 'react';

/**
 * Reusable search hook with configurable field matching.
 *
 * @param {Array} data - Array of objects to search
 * @param {string[]} fields - Object keys to search within
 * @param {Object} options - Optional initial search term
 * @returns {{ searchTerm, setSearchTerm, filteredData }}
 */
export default function useSearch(data = [], fields = [], options = {}) {
  const [searchTerm, setSearchTerm] = useState(options.initialTerm || '');

  const filteredData = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return data;

    return data.filter(item =>
      fields.some(field => {
        const value = item[field];
        if (value == null) return false;
        if (Array.isArray(value)) {
          return value.some(v => String(v).toLowerCase().includes(q));
        }
        return String(value).toLowerCase().includes(q);
      })
    );
  }, [data, searchTerm, fields]);

  return { searchTerm, setSearchTerm, filteredData };
}
