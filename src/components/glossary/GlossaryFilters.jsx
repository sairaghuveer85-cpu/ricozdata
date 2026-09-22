import React from 'react';
import SearchBar from '../common/SearchBar';
import { DOMAINS } from '../../utils/constants';

export default function GlossaryFilters({
  searchTerm,
  setSearchTerm,
  selectedDomain,
  setSelectedDomain
}) {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
      <div className="flex-1">
        <SearchBar
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search for a term..."
        />
      </div>

      <div className="w-full sm:w-48">
        <select
          value={selectedDomain}
          onChange={(e) => setSelectedDomain(e.target.value)}
          className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] text-xs text-slate-800 dark:text-slate-200 py-2 px-3 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-2xs"
        >
          {DOMAINS.map(d => (
            <option key={d} value={d} className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-white">{d}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
