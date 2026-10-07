import React from 'react';
import { useApp } from '../../context/AppContext';

export default function DataHealthCard() {
  const { dataHealthSummary, datasets } = useApp();
  const scoredDatasets = Array.isArray(datasets) ? datasets.filter(d => d.qualityScore != null || d.quality != null) : [];
  const hasHealthData = scoredDatasets.length > 0 && ((dataHealthSummary?.score || 0) > 0);

  const score = hasHealthData ? dataHealthSummary.score : null;
  const maxScore = dataHealthSummary?.maxScore ?? 100;
  const status = hasHealthData
    ? (score >= 90 ? 'Excellent' : score >= 80 ? 'Good' : 'Needs Review')
    : 'No Data';

  const dimensions = (hasHealthData && dataHealthSummary?.dimensions && dataHealthSummary.dimensions.length > 0)
    ? dataHealthSummary.dimensions
    : [];

  return (
    <div className="flex flex-col justify-between h-full">
      <div>
        <div 
          className="text-[10px] font-bold uppercase tracking-wider select-none"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Reliability Index
        </div>

        <div className="mt-1.5 flex items-baseline gap-2">
          <span 
            className="text-2xl sm:text-3xl font-bold tracking-tight tabular-nums"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {hasHealthData ? score : 'N/A'}
          </span>
          {hasHealthData && (
            <span 
              className="text-xs font-medium"
              style={{ color: 'var(--color-text-muted)' }}
            >
              / {maxScore} Target
            </span>
          )}
        </div>

        <div 
          className="inline-flex items-center gap-1 text-[11px] font-semibold mt-1"
          style={{ color: hasHealthData ? 'var(--color-success)' : 'var(--color-text-muted)' }}
        >
          <span 
            className="w-1.5 h-1.5 rounded-full" 
            style={{ backgroundColor: hasHealthData ? 'var(--color-success)' : 'var(--color-text-muted)' }}
            aria-hidden="true" 
          />
          <span>{status} {hasHealthData ? '(SLA Met)' : ''}</span>
        </div>
      </div>

      <div 
        className="mt-5 pt-3.5 border-t space-y-2.5"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div 
          className="text-[10px] font-bold uppercase tracking-wider mb-2"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Quality Dimensions
        </div>
        {!hasHealthData || dimensions.length === 0 ? (
          <div className="py-4 text-center text-xs text-slate-400">
            No health dimensions calculated yet.
          </div>
        ) : (
          dimensions.map((dim) => (
            <div key={dim.name}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span 
                  className="font-medium"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {dim.name}
                </span>
                <span 
                  className="font-semibold tabular-nums text-xs"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {dim.score}%
                </span>
              </div>
              <div 
                className="w-full h-1 rounded-xs overflow-hidden"
                style={{ backgroundColor: 'var(--color-surface-tertiary)' }}
              >
                <div
                  className="h-full rounded-xs transition-all duration-300"
                  style={{ 
                    width: `${dim.score}%`,
                    backgroundColor: 'var(--color-success)' 
                  }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
