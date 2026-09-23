import React, { useState } from 'react';
import { Key, Shield, Search } from 'lucide-react';

export default function DatasetSchema({ schema = [] }) {
  const [filter, setFilter] = useState('');

  const filteredSchema = schema.filter(col => 
    col.name.toLowerCase().includes(filter.toLowerCase()) ||
    col.type.toLowerCase().includes(filter.toLowerCase()) ||
    (col.description && col.description.toLowerCase().includes(filter.toLowerCase()))
  );

  return (
    <div className="theme-card rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Schema Definition ({schema.length} fields)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Field names, types, constraints, and classification tags</p>
        </div>

        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Filter columns..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-2.5" />
        </div>
      </div>

      {/* Mobile Schema Cards (< md) */}
      <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
        {filteredSchema.map((col, idx) => (
          <div key={idx} className="p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-900 dark:text-white">
                {col.primaryKey && (
                  <Key className="w-3.5 h-3.5 text-amber-500 shrink-0" title="Primary Key" />
                )}
                <span>{col.name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {col.type}
                </span>
                {col.pii && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50">
                    <Shield className="w-3 h-3 text-rose-500" />
                    PII
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 gap-2">
              <span className="shrink-0">{col.nullable ? 'Nullable' : 'NOT NULL'}</span>
              <span className="text-right truncate">{col.description || 'No description provided'}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table (>= md) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <th className="py-2.5 px-4">Column Name</th>
              <th className="py-2.5 px-4">Data Type</th>
              <th className="py-2.5 px-4">Constraints</th>
              <th className="py-2.5 px-4">Classification</th>
              <th className="py-2.5 px-4">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {filteredSchema.map((col, idx) => (
              <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                <td className="py-2.5 px-4 font-mono font-medium text-slate-900 dark:text-white">
                  <div className="flex items-center gap-1.5">
                    {col.primaryKey && (
                      <span title="Primary Key">
                        <Key className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      </span>
                    )}
                    <span>{col.name}</span>
                  </div>
                </td>
                <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-400">
                  {col.type}
                </td>
                <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">
                  <span className="text-[11px]">
                    {col.nullable ? 'Nullable' : 'NOT NULL'}
                  </span>
                </td>
                <td className="py-2.5 px-4">
                  {col.pii ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50">
                      <Shield className="w-3 h-3 text-rose-500" />
                      PII
                    </span>
                  ) : (
                    <span className="text-slate-400 text-[11px]">-</span>
                  )}
                </td>
                <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400">
                  {col.description || 'No description provided'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
