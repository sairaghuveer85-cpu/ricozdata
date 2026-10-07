import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Info, CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react';

export default function QualityMetrics({ dimensions = [] }) {
  const [expandedDim, setExpandedDim] = useState(null);

  const toggleExpand = (dimKey) => {
    setExpandedDim(prev => (prev === dimKey ? null : dimKey));
  };

  return (
    <div className="enterprise-panel rounded-lg p-5 flex flex-col justify-center h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
            Quality Dimensions Breakdown
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Click any dimension to inspect column evidence, rule SLAs, and violation details.
          </p>
        </div>
        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">
          Target SLA: ≥ 95%
        </span>
      </div>

      {(!dimensions || dimensions.length === 0) ? (
        <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
          <p className="font-semibold text-slate-800 dark:text-slate-200">No Dimension Metrics Available</p>
          <p className="mt-1">Run a quality evaluation scan to assess Completeness, Accuracy, Consistency, Validity, Uniqueness, and Timeliness.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {dimensions.map((dim, idx) => {
            const isAssessed = dim.status !== 'NOT_ASSESSED' && dim.score != null;
            const dimKey = dim.key || dim.name?.toLowerCase() || idx;
            const isExpanded = expandedDim === dimKey;

            return (
              <div
                key={dimKey}
                className="rounded-lg border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-[#0D1828]/60 transition-colors"
              >
                {/* Header row */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleExpand(dimKey)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleExpand(dimKey);
                    }
                  }}
                  className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/40 select-none rounded-lg"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {dim.name}
                    </span>
                    <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider ${
                      isAssessed
                        ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                    }`}>
                      {isAssessed ? 'Assessed' : 'Not Assessed'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold tabular-nums ${
                      isAssessed
                        ? (dim.score >= 90 ? 'text-emerald-600 dark:text-emerald-400' : dim.score >= 70 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400')
                        : 'text-slate-400 dark:text-slate-500 italic'
                    }`}>
                      {isAssessed ? `${dim.score}%` : 'Not Assessed'}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="px-3 pb-2.5">
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-xs h-1.5 overflow-hidden">
                    <div
                      className={`h-1.5 rounded-xs transition-all duration-500 ${
                        !isAssessed
                          ? 'bg-slate-300 dark:bg-slate-700'
                          : dim.score >= 90
                          ? 'bg-emerald-500'
                          : dim.score >= 75
                          ? 'bg-blue-500'
                          : dim.score >= 50
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: isAssessed ? `${dim.score}%` : '0%' }}
                    />
                  </div>
                </div>

                {/* Expanded Evidence & Explanation Panel */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-1 border-t border-slate-100 dark:border-slate-800/80 text-[11px] space-y-2 bg-slate-50/50 dark:bg-[#0B1524]/40 rounded-b-lg">
                    {/* Explanation */}
                    <div className="flex items-start gap-1.5">
                      <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                        {dim.explanation || (isAssessed ? `Evaluated ${dim.name} compliance on source database rows.` : 'Dimension not assessed: Requires ground-truth reference data or configured business constraints.')}
                      </p>
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-800">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Evaluated Columns</span>
                        <div className="flex flex-wrap gap-1">
                          {(dim.evaluatedColumns && dim.evaluatedColumns.length > 0) ? (
                            dim.evaluatedColumns.map(c => (
                              <span key={c} className="font-mono px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px]">
                                {c}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 italic">None configured</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Applied Rule / SLA</span>
                        <span className="text-slate-700 dark:text-slate-300 font-mono text-[10px] block truncate">
                          {dim.rule || 'Default Catalog Schema SLA'}
                        </span>
                      </div>
                    </div>

                    {isAssessed && (dim.failedCount != null || dim.totalCount != null) && (
                      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-800">
                        <span>Violations: <strong className="text-slate-800 dark:text-slate-200 font-semibold">{dim.failedCount ?? 0}</strong></span>
                        <span>Total Tested: <strong className="text-slate-800 dark:text-slate-200 font-semibold">{dim.totalCount ?? 0}</strong></span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
