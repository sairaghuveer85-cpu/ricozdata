import React from 'react';
import { Database, CheckCircle2, ChevronRight } from 'lucide-react';
import Badge from '../common/Badge';
import { useApp } from '../../context/AppContext';

export default function DatasetRow({
  dataset,
  isSelected,
  onToggleSelect
}) {
  const { openDrawer } = useApp();

  const handleRowClick = (e) => {
    // If clicking checkbox, don't open drawer
    if (e.target.tagName === 'INPUT' || e.target.closest('input')) {
      return;
    }
    openDrawer('dataset', dataset);
  };

  const getQualityLabel = (quality) => {
    if (quality >= 95) return { label: 'Excellent', color: 'text-emerald-600 dark:text-emerald-400' };
    if (quality >= 90) return { label: 'Good', color: 'text-emerald-600 dark:text-emerald-400' };
    if (quality >= 80) return { label: 'Fair', color: 'text-amber-600 dark:text-amber-400' };
    return { label: 'At Risk', color: 'text-rose-600 dark:text-rose-400' };
  };

  const qualityInfo = getQualityLabel(dataset.quality);

  const initials = dataset.owner
    ? dataset.owner.split(' ').map(n => n[0]).join('').slice(0, 2)
    : 'U';

  return (
    <tr
      tabIndex={0}
      role="button"
      aria-label={`View details for ${dataset.name}`}
      onClick={handleRowClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openDrawer('dataset', dataset);
        }
      }}
      className={`hover:bg-slate-50/70 dark:hover:bg-[#111E30]/60 transition-colors cursor-pointer border-b border-slate-100 dark:border-[#1D3047] last:border-b-0 focus:outline-none focus-visible:bg-slate-50 dark:focus-visible:bg-[#111E30] ${
        isSelected ? 'bg-blue-50/30 dark:bg-blue-950/20' : ''
      }`}
    >
      <td className="py-2.5 px-4 w-10" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          aria-label={`Select ${dataset.name}`}
          checked={isSelected}
          onChange={() => onToggleSelect(dataset.id)}
          className="w-4 h-4 rounded text-blue-600 border-slate-300 dark:border-slate-700 focus:ring-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
        />
      </td>

      {/* Dataset Name & Description */}
      <td className="py-2.5 px-4">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50 flex items-center justify-center shrink-0" aria-hidden="true">
            <Database className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 max-w-xs sm:max-w-sm">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                {dataset.name}
              </span>
              {dataset.certified && (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" aria-label="Certified Dataset" />
              )}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {dataset.description}
            </div>
          </div>
        </div>
      </td>

      {/* Domain */}
      <td className="py-2.5 px-4 text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
        {dataset.domain}
      </td>

      {/* Owner with Avatar */}
      <td className="py-2.5 px-4 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-semibold flex items-center justify-center shrink-0" aria-hidden="true">
            {initials}
          </div>
          <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
            {dataset.owner}
          </span>
        </div>
      </td>

      {/* Quality */}
      <td className="py-2.5 px-4 whitespace-nowrap">
        <span className={`text-xs font-bold tabular-nums ${qualityInfo.color}`}>
          {dataset.quality}%
          <span className="sr-only"> ({qualityInfo.label})</span>
        </span>
      </td>

      {/* Status / Certification */}
      <td className="py-2.5 px-4 whitespace-nowrap">
        <Badge status={dataset.status} size="sm" dot />
      </td>

      {/* Updated */}
      <td className="py-2.5 px-4 text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
        <div className="flex items-center justify-between gap-2">
          <span>{dataset.updated}</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" aria-hidden="true" />
        </div>
      </td>
    </tr>
  );
}
