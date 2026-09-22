import React from 'react';
import { Database, CheckCircle2, ChevronRight, Server, Layers } from 'lucide-react';
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
    if (quality >= 95) return { label: 'Excellent', color: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500' };
    if (quality >= 90) return { label: 'Good', color: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500' };
    if (quality >= 80) return { label: 'Fair', color: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-500' };
    return { label: 'At Risk', color: 'text-rose-600 dark:text-rose-400', bar: 'bg-rose-500' };
  };

  const qualityInfo = getQualityLabel(dataset.quality);

  const getSourceIconColor = (source) => {
    switch (source) {
      case 'Snowflake':
        return 'bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-900/50';
      case 'PostgreSQL':
        return 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/50';
      case 'BigQuery':
        return 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/50';
      case 'AWS S3':
        return 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/50';
      default:
        return 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  // Avatar initials
  const initials = dataset.owner
    ? dataset.owner.split(' ').map(n => n[0]).join('').slice(0, 2)
    : 'U';

  return (
    <tr
      onClick={handleRowClick}
      className={`hover:bg-slate-50/70 dark:hover:bg-[#111C2E]/60 transition-colors cursor-pointer border-b border-slate-100 dark:border-slate-800/60 last:border-b-0 ${
        isSelected ? 'bg-blue-50/30 dark:bg-blue-950/20' : ''
      }`}
    >
      <td className="py-2.5 px-4 w-10" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(dataset.id)}
          className="w-4 h-4 rounded text-blue-600 border-slate-300 dark:border-slate-700 focus:ring-blue-500/20 cursor-pointer"
        />
      </td>

      {/* Dataset Name & Description matching Screen 3 */}
      <td className="py-2.5 px-4">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50 flex items-center justify-center shrink-0">
            <Database className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 max-w-xs sm:max-w-sm">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate">
                {dataset.name}
              </span>
              {dataset.certified && (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" title="Certified Dataset" />
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
          <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-semibold flex items-center justify-center shrink-0">
            {initials}
          </div>
          <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
            {dataset.owner}
          </span>
        </div>
      </td>

      {/* Quality matching Screen 3 (Clean percentage) */}
      <td className="py-2.5 px-4 whitespace-nowrap">
        <span className={`text-xs font-bold ${qualityInfo.color}`}>
          {dataset.quality}%
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
          <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-blue-500" />
        </div>
      </td>
    </tr>
  );
}
