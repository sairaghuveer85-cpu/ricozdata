import React from 'react';
import { Search, X } from 'lucide-react';

export default function SearchBar({
  value,
  onChange,
  placeholder = 'Search...',
  className = '',
  size = 'md',
  onClear
}) {
  const sizeClasses = {
    sm: 'py-1.5 pl-8 pr-7 text-xs',
    md: 'py-2 pl-9 pr-8 text-xs sm:text-sm',
    lg: 'py-2.5 pl-10 pr-9 text-sm sm:text-base'
  };

  const iconSizes = {
    sm: 'w-3.5 h-3.5 left-2.5',
    md: 'w-4 h-4 left-3',
    lg: 'w-5 h-5 left-3.5'
  };

  return (
    <div className={`relative flex items-center w-full ${className}`}>
      <div className={`absolute pointer-events-none text-slate-400 dark:text-slate-500 flex items-center ${iconSizes[size]}`}>
        <Search className="w-full h-full" />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${sizeClasses[size]}`}
        style={{
          backgroundColor: 'var(--input-bg)',
          border: '1px solid var(--border)',
          color: 'var(--text-primary)'
        }}
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange('');
            onClear && onClear();
          }}
          className="absolute right-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
