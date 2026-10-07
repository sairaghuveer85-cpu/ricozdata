import React from 'react';
import Drawer from '../common/Drawer';
import Button from '../common/Button';
import Badge from '../common/Badge';
import { CheckCircle2, AlertTriangle, AlertCircle, ShieldAlert, Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function IssueDrawer({ issue, isOpen, onClose }) {
  const { updateIssueStatus, addToast } = useApp();

  if (!issue) return null;

  const handleResolve = () => {
    updateIssueStatus(issue.id || issue._id, 'Resolved');
    onClose();
  };

  const getRemediation = () => {
    const dim = String(issue.dimension || '').toLowerCase();
    switch (dim) {
      case 'completeness':
        return `Configure NOT NULL constraint on column "${issue.column || issue.field}" in upstream ingestion schema, or implement default fallback values in ETL transformation.`;
      case 'validity':
        return `Add regex validation / enum whitelist check for column "${issue.column || issue.field}" during data ingestion pipeline to reject or quarantine non-conforming values.`;
      case 'timeliness':
        return `Investigate pipeline scheduler and CDC / sync job for table "${issue.datasetName || 'source'}". Ensure replication latency meets the 24-hour freshness SLA.`;
      case 'uniqueness':
        return `Implement deduplication transform or add UNIQUE / PRIMARY KEY constraint on column "${issue.column || issue.field}" in source database.`;
      default:
        return 'Review schema validation rules and upstream source ETL pipeline.';
    }
  };

  const evidence = issue.evidence || {};

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={issue.issue}
      subtitle={`Target: ${issue.column || issue.field} (${(issue.dimension || 'quality').toUpperCase()})`}
      footer={
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between w-full gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => {
              addToast({
                type: 'info',
                title: 'Issue Ignored',
                message: `Anomaly on ${issue.column || issue.field} marked as accepted risk.`
              });
              onClose();
            }}
          >
            Ignore
          </Button>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Button size="sm" icon={Check} onClick={handleResolve} className="w-full sm:w-auto">
              Mark Resolved
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5 text-xs text-slate-600 dark:text-slate-300">
        {/* Severity, Dimension & Status Header */}
        <div className="grid grid-cols-3 gap-2 p-3.5 rounded-xl bg-slate-50 dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800">
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Severity</div>
            <Badge status={issue.severity} size="sm" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Dimension</div>
            <span className="font-bold uppercase tracking-wider text-[11px] text-blue-600 dark:text-blue-400">
              {issue.dimension || 'validity'}
            </span>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Affected Rows</div>
            <div className="font-bold text-sm text-slate-900 dark:text-white tabular-nums">
              {(issue.count || issue.affectedRows || 0).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Rule Violated */}
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-1.5">
            Validation Rule & Constraint Type
          </h4>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#111C2E] font-mono text-[11px] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800">
            <div><strong>Rule Type:</strong> {issue.ruleType || 'CONSTRAINT'}</div>
            <div className="mt-1 text-slate-600 dark:text-slate-400"><strong>Target Column:</strong> {issue.column || issue.field}</div>
          </div>
        </div>

        {/* Anomaly Evidence & Details */}
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-1.5">
            Source Database Evidence & Root Cause
          </h4>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 space-y-2">
            <p className="text-slate-800 dark:text-slate-200 font-medium">
              {issue.failureDetails || issue.issue}
            </p>

            {/* Structured Evidence Metrics */}
            {evidence && Object.keys(evidence).length > 0 && (
              <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800 grid grid-cols-2 gap-2 text-[11px]">
                {evidence.nullPercentage != null && (
                  <div>
                    <span className="text-slate-400 block text-[10px]">Null Percentage:</span>
                    <strong className="text-rose-600 dark:text-rose-400 font-mono">{evidence.nullPercentage}%</strong>
                  </div>
                )}
                {evidence.nullCount != null && (
                  <div>
                    <span className="text-slate-400 block text-[10px]">Null Rows / Total:</span>
                    <strong className="text-slate-800 dark:text-slate-200 font-mono">{evidence.nullCount} / {evidence.totalRows}</strong>
                  </div>
                )}
                {evidence.ageDays != null && (
                  <div>
                    <span className="text-slate-400 block text-[10px]">Data Age (Days):</span>
                    <strong className="text-amber-600 dark:text-amber-400 font-mono">{evidence.ageDays} days</strong>
                  </div>
                )}
                {evidence.latestTimestamp && (
                  <div>
                    <span className="text-slate-400 block text-[10px]">Latest Source Timestamp:</span>
                    <strong className="text-slate-800 dark:text-slate-200 font-mono truncate block">{String(evidence.latestTimestamp)}</strong>
                  </div>
                )}
                {evidence.duplicateCount != null && (
                  <div>
                    <span className="text-slate-400 block text-[10px]">Duplicate Occurrences:</span>
                    <strong className="text-rose-600 dark:text-rose-400 font-mono">{evidence.duplicateCount}</strong>
                  </div>
                )}
                {evidence.failingCount != null && (
                  <div>
                    <span className="text-slate-400 block text-[10px]">Invalid Value Count:</span>
                    <strong className="text-rose-600 dark:text-rose-400 font-mono">{evidence.failingCount}</strong>
                  </div>
                )}
                {evidence.pattern && (
                  <div className="col-span-2">
                    <span className="text-slate-400 block text-[10px]">Expected Pattern:</span>
                    <code className="text-blue-600 dark:text-blue-400 font-mono text-[10px] break-all">{evidence.pattern}</code>
                  </div>
                )}
              </div>
            )}

            {/* Sample Failing Values */}
            {Array.isArray(evidence.sampleFailingValues) && evidence.sampleFailingValues.length > 0 && (
              <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Sample Failing Rows:</span>
                <div className="space-y-1">
                  {evidence.sampleFailingValues.slice(0, 4).map((s, idx) => (
                    <div key={idx} className="font-mono text-[10px] px-2 py-1 rounded bg-rose-50/70 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-900/40">
                      {typeof s === 'object' ? JSON.stringify(s) : String(s)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recommended Action */}
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-1.5">
            Recommended Remediation
          </h4>
          <p className="leading-relaxed bg-blue-50/60 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-900/40 text-blue-900 dark:text-blue-200">
            {getRemediation()}
          </p>
        </div>
      </div>
    </Drawer>
  );
}
