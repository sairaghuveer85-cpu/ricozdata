import React from 'react';
import { Database, CheckCircle2, ChevronRight } from 'lucide-react';
import DatasetRow from './DatasetRow';
import EmptyState from '../common/EmptyState';
import Badge from '../common/Badge';
import { useApp } from '../../context/AppContext';

export default function DatasetTable({
  datasets = [],
  selectedIds = [],
  setSelectedIds,
  onResetFilters
}) {
  const { openDrawer } = useApp();
  const allSelected = datasets.length > 0 && selectedIds.length === datasets.length;

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(datasets.map(d => d.id));
    }
  };

  const handleToggleSelect = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  if (datasets.length === 0) {
    return (
      <EmptyState
        title="No datasets found"
        description="No datasets matched your current search filters or keywords."
        actionLabel="Clear filters"
        onAction={onResetFilters}
      />
    );
  }

  return (
    <>
      {/* Mobile Responsive Cards (< md) */}
      <div className="md:hidden space-y-3">
        {/* Select All Controls */}
        <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-[#0D1828] rounded-md border border-slate-200 dark:border-[#1D3047] text-xs">
          <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              aria-label="Select all datasets"
              checked={allSelected}
              onChange={handleSelectAll}
              className="w-4 h-4 rounded text-blue-600 border-slate-300 dark:border-slate-700 focus:ring-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
            />
            <span>Select All ({datasets.length})</span>
          </label>
          <span className="text-[11px] text-slate-400">{selectedIds.length} selected</span>
        </div>

        {/* Card Items */}
        {datasets.map((dataset) => {
          const isSelected = selectedIds.includes(dataset.id);
          const initials = dataset.owner
            ? dataset.owner.split(' ').map(n => n[0]).join('').slice(0, 2)
            : 'U';
          const qualityColor =
            dataset.quality >= 90
              ? 'text-emerald-600 dark:text-emerald-400'
              : dataset.quality >= 80
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-rose-600 dark:text-rose-400';

          return (
            <div
              key={dataset.id}
              tabIndex={0}
              role="button"
              aria-label={`View details for ${dataset.name}`}
              onClick={() => openDrawer('dataset', dataset)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openDrawer('dataset', dataset);
                }
              }}
              className={`p-3.5 rounded-lg border transition-all cursor-pointer bg-white dark:bg-[#0D1828] space-y-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                isSelected
                  ? 'border-blue-500/50 bg-blue-50/20 dark:bg-blue-950/20'
                  : 'border-slate-200/80 dark:border-[#1D3047] hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              {/* Card Header: Checkbox + Name + Certified Badge */}
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div onClick={(e) => e.stopPropagation()} className="pt-0.5 shrink-0">
                    <input
                      type="checkbox"
                      aria-label={`Select ${dataset.name}`}
                      checked={isSelected}
                      onChange={() => handleToggleSelect(dataset.id)}
                      className="w-4 h-4 rounded text-blue-600 border-slate-300 dark:border-slate-700 focus:ring-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {dataset.name}
                      </span>
                      {dataset.certificationStatus === 'certified' && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" aria-label="Certified Dataset" />
                      )}
                    </div>
                    {dataset.description && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                        {dataset.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="shrink-0">
                  <Badge status={dataset.status} size="sm" dot />
                </div>
              </div>

              {/* Card Details: Domain, Owner, Quality, Updated */}
              <div className="pt-2.5 border-t border-slate-100 dark:border-[#1D3047] grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">Domain</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300 text-xs truncate block">{dataset.domain}</span>
                </div>

                <div>
                  <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">Owner</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[9px] font-bold flex items-center justify-center shrink-0">
                      {initials}
                    </div>
                    <span className="text-xs text-slate-700 dark:text-slate-300 truncate">{dataset.owner}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">Quality</span>
                  <span className={`text-xs font-bold tabular-nums ${qualityColor}`}>{dataset.quality}%</span>
                </div>

                <div>
                  <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">Updated</span>
                  <div className="flex items-center justify-between text-slate-400 text-xs mt-0.5">
                    <span className="truncate">{dataset.updated}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0 ml-1" aria-hidden="true" />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Table (>= md) */}
      <div className="hidden md:block enterprise-workbench overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" aria-label="Data Catalog Datasets">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-[#0B1524] border-b border-slate-200/80 dark:border-[#1D3047] text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider sticky top-0 z-10">
                <th className="py-2.5 px-4 w-10">
                  <input
                    type="checkbox"
                    aria-label="Select all datasets"
                    checked={allSelected}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded text-blue-600 border-slate-300 dark:border-slate-700 focus:ring-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="py-2.5 px-4">Dataset Name</th>
                <th className="py-2.5 px-4">Domain</th>
                <th className="py-2.5 px-4">Owner</th>
                <th className="py-2.5 px-4">Quality</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1D3047]">
              {datasets.map((dataset) => (
                <DatasetRow
                  key={dataset.id}
                  dataset={dataset}
                  isSelected={selectedIds.includes(dataset.id)}
                  onToggleSelect={handleToggleSelect}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
