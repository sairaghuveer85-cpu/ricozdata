import React from 'react';
import DatasetRow from './DatasetRow';
import EmptyState from '../common/EmptyState';

export default function DatasetTable({
  datasets = [],
  selectedIds = [],
  setSelectedIds,
  onResetFilters
}) {
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
    <div className="bg-white dark:bg-[#0B1628] rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden" style={{ boxShadow: 'var(--shadow-sm)' }}>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/80 dark:bg-[#111C2E] border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider sticky top-0 z-10">
              <th className="py-2.5 px-4 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={handleSelectAll}
                  className="w-4 h-4 rounded text-blue-600 border-slate-300 dark:border-slate-700 focus:ring-blue-500/20 cursor-pointer"
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
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
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
  );
}
