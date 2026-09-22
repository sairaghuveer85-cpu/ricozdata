export function filterBySearch(items, searchTerm, fields) {
  if (!searchTerm || !searchTerm.trim()) return items;
  const term = searchTerm.toLowerCase().trim();
  
  return items.filter(item => {
    return fields.some(field => {
      const val = item[field];
      if (typeof val === 'string') {
        return val.toLowerCase().includes(term);
      }
      if (Array.isArray(val)) {
        return val.some(v => typeof v === 'string' && v.toLowerCase().includes(term));
      }
      return false;
    });
  });
}

export function generateId(prefix = 'item') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
}

export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
