import React from 'react';
import { DATA_HEALTH_SUMMARY } from '../../data/dashboard';
import { useApp } from '../../context/AppContext';

export default function DataHealthCard() {
  const { dataHealthSummary } = useApp();
  const { score, maxScore, status, dimensions } = dataHealthSummary || DATA_HEALTH_SUMMARY;

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
            {score}
          </span>
          <span 
            className="text-xs font-medium"
            style={{ color: 'var(--color-text-muted)' }}
          >
            / {maxScore} Target
          </span>
        </div>

        <div 
          className="inline-flex items-center gap-1 text-[11px] font-semibold mt-1"
          style={{ color: 'var(--color-success)' }}
        >
          <span 
            className="w-1.5 h-1.5 rounded-full" 
            style={{ backgroundColor: 'var(--color-success)' }}
            aria-hidden="true" 
          />
          <span>{status} (SLA Met)</span>
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
        {dimensions.map((dim) => (
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
        ))}
      </div>
    </div>
  );
}
