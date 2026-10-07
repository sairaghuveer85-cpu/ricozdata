import React from 'react';
import { Search, X, Filter } from 'lucide-react';
import { DOMAINS } from '../../utils/constants';

const STATUS_FILTERS = [
  { value: 'All Statuses', label: 'All Statuses' },
  { value: 'approved', label: '● Approved' },
  { value: 'draft', label: '● Draft' },
  { value: 'deprecated', label: '● Deprecated' },
  { value: 'archived', label: '● Archived' },
];

export default function GlossaryFilters({
  searchTerm,
  setSearchTerm,
  selectedDomain,
  setSelectedDomain,
  selectedStatus = 'All Statuses',
  setSelectedStatus,
  onReset,
  totalCount,
}) {
  const hasActiveFilters =
    Boolean(searchTerm && searchTerm.trim().length > 0) ||
    (selectedDomain && selectedDomain !== 'All Domains') ||
    (selectedStatus && selectedStatus !== 'All Statuses');

  return (
    <div className="space-y-2.5">
      {/* Primary Dominant Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search terms, definitions, synonyms, or tags..."
          className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1421] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-2xs"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            title="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter Row: Domain, Status, Clear Filters, and Result Count */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          {/* Domain Filter */}
          <div className="relative min-w-[140px] sm:min-w-[160px]">
            <select
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1421] text-slate-700 dark:text-slate-300 py-1.5 px-2.5 pr-7 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-2xs appearance-none"
            >
              {DOMAINS.map((d) => (
                <option key={d} value={d} className="bg-white dark:bg-[#0c1421] text-slate-900 dark:text-white">
                  {d === 'All Domains' ? 'Domain: All Domains' : `Domain: ${d}`}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-slate-400">
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
              </svg>
            </div>
          </div>

          {/* Status Filter */}
          {setSelectedStatus && (
            <div className="relative min-w-[130px] sm:min-w-[150px]">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1421] text-slate-700 dark:text-slate-300 py-1.5 px-2.5 pr-7 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-2xs appearance-none"
              >
                {STATUS_FILTERS.map((s) => (
                  <option key={s.value} value={s.value} className="bg-white dark:bg-[#0c1421] text-slate-900 dark:text-white">
                    {s.value === 'All Statuses' ? 'Status: All' : s.label}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-slate-400">
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                  <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                </svg>
              </div>
            </div>
          )}

          {/* Clear Filters */}
          {hasActiveFilters && onReset && (
            <button
              type="button"
              onClick={onReset}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 px-2 py-1 font-medium transition-colors flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear filters</span>
            </button>
          )}
        </div>

        {/* Result Count Indicator */}
        {totalCount !== undefined && totalCount !== null && (
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span className="text-slate-800 dark:text-slate-200 font-semibold">{totalCount}</span>{' '}
            {totalCount === 1 ? 'term' : 'terms'}
          </div>
        )}
      </div>
    </div>
  );
}
