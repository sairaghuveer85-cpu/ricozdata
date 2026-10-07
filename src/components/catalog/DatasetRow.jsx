import React from 'react';
import { Database, CheckCircle2, ChevronRight, Star, AlertTriangle, AlertCircle } from 'lucide-react';
import Badge from '../common/Badge';
import { useApp } from '../../context/AppContext';

export default function DatasetRow({
  dataset,
  isSelected,
  onToggleSelect,
  onToggleFavorite,
  isFavorited
}) {
  const { openDrawer } = useApp();

  const handleRowClick = (e) => {
    // If clicking checkbox or favorite button, don't open drawer
    if (e.target.tagName === 'INPUT' || e.target.closest('input') || e.target.closest('button')) {
      return;
    }
    openDrawer('dataset', dataset);
  };

  const getQualityLabel = (quality) => {
    if (quality === null || quality === undefined) return { label: 'Not Assessed', color: 'text-slate-500 dark:text-slate-400' };
    if (quality >= 95) return { label: 'Excellent', color: 'text-emerald-600 dark:text-emerald-400' };
    if (quality >= 90) return { label: 'Good', color: 'text-emerald-600 dark:text-emerald-400' };
    if (quality >= 80) return { label: 'Fair', color: 'text-amber-600 dark:text-amber-400' };
    return { label: 'At Risk', color: 'text-rose-600 dark:text-rose-400' };
  };

  const qualityVal = dataset.notAssessed ? null : (typeof dataset.quality === 'number' ? dataset.quality : (typeof dataset.qualityScore === 'number' ? dataset.qualityScore : null));
  const qualityInfo = getQualityLabel(qualityVal);

  const initials = dataset.owner && dataset.owner !== 'Unassigned'
    ? dataset.owner.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  const certStatus = (dataset.certificationStatus || '').toLowerCase();

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
      <td className="py-2.5 px-3 w-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1.5">
          <input
            type="checkbox"
            aria-label={`Select ${dataset.name}`}
            checked={isSelected}
            onChange={() => onToggleSelect(dataset.id)}
            className="w-4 h-4 rounded text-blue-600 border-slate-300 dark:border-slate-700 focus:ring-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
          />
          {onToggleFavorite && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(dataset.id);
              }}
              className={`p-0.5 rounded transition-colors ${
                isFavorited
                  ? 'text-amber-500 dark:text-amber-400 hover:text-amber-600'
                  : 'text-slate-300 dark:text-slate-600 hover:text-slate-400'
              }`}
              title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
              aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Star className={`w-3.5 h-3.5 ${isFavorited ? 'fill-amber-400 text-amber-500' : ''}`} />
            </button>
          )}
        </div>
      </td>

      {/* Dataset Name & Description & Tags */}
      <td className="py-2.5 px-4">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50 flex items-center justify-center shrink-0" aria-hidden="true">
            <Database className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 max-w-xs sm:max-w-sm">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                {dataset.name}
              </span>
              {certStatus === 'certified' && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.2 rounded border border-emerald-200 dark:border-emerald-900/50">
                  <CheckCircle2 className="w-3 h-3" /> Certified
                </span>
              )}
              {certStatus === 'in review' || certStatus === 'in_review' || certStatus === 'under review' ? (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.2 rounded border border-amber-200 dark:border-amber-900/50">
                  <AlertCircle className="w-3 h-3" /> In Review
                </span>
              ) : null}
              {certStatus === 'deprecated' && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.2 rounded border border-rose-200 dark:border-rose-900/50">
                  <AlertTriangle className="w-3 h-3" /> Deprecated
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {dataset.description}
            </div>
            {dataset.tags && dataset.tags.length > 0 && (
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                {dataset.tags.slice(0, 3).map((tag, tIdx) => (
                  <span key={tIdx} className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {tag}
                  </span>
                ))}
                {dataset.tags.length > 3 && (
                  <span className="text-[9px] text-slate-400 font-medium">
                    +{dataset.tags.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </td>

      {/* Domain */}
      <td className="py-2.5 px-4 text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
        {dataset.domain || 'Unassigned'}
      </td>

      {/* Source */}
      <td className="py-2.5 px-4 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
        <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
          {dataset.source || dataset.sourceSystem || 'External Source'}
        </span>
      </td>

      {/* Owner with Avatar */}
      <td className="py-2.5 px-4 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-semibold flex items-center justify-center shrink-0" aria-hidden="true">
            {initials}
          </div>
          <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
            {dataset.owner || 'Unassigned'}
          </span>
        </div>
      </td>

      {/* Quality */}
      <td className="py-2.5 px-4 whitespace-nowrap">
        {qualityVal === null ? (
          <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
            Not Assessed
          </span>
        ) : (
          <span className={`text-xs font-bold tabular-nums ${qualityInfo.color}`}>
            {qualityVal}%
            <span className="sr-only"> ({qualityInfo.label})</span>
          </span>
        )}
      </td>

      {/* Status */}
      <td className="py-2.5 px-4 whitespace-nowrap">
        <Badge status={dataset.status} size="sm" dot />
      </td>

      {/* Updated */}
      <td className="py-2.5 px-4 text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
        <div className="flex items-center justify-between gap-2">
          <span>{dataset.updated || 'Recently'}</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" aria-hidden="true" />
        </div>
      </td>
    </tr>
  );
}
