import React from 'react';
import Drawer from '../common/Drawer';
import Button from '../common/Button';
import Badge from '../common/Badge';
import { CheckCircle2, AlertTriangle, Play, Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function IssueDrawer({ issue, isOpen, onClose }) {
  const { updateIssueStatus, addToast } = useApp();

  if (!issue) return null;

  const handleResolve = () => {
    updateIssueStatus(issue.id, 'Resolved');
    onClose();
  };

  const handleInProgress = () => {
    updateIssueStatus(issue.id, 'In Progress');
    onClose();
  };

  const handleRerun = () => {
    addToast({
      type: 'info',
      title: 'Audit re-run triggered',
      message: `Scanning column "${issue.column}" for anomalies...`
    });
  };

  const sampleValues = {
    email: ['"NULL"', '""', '"robert.p@" (truncated)', '"user@@example.com"'],
    customer_id: ['"CUST-00921" (duplicate)', '"CUST-00921" (duplicate)', '"CUST-00412"'],
    phone_number: ['"123-456"', '"N/A"', '"0000000000"'],
    age: ['"-4"', '"240"', '"999"']
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={issue.issue}
      subtitle={`Column: ${issue.column}`}
      footer={
        <div className="flex items-center justify-between w-full gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              addToast({
                type: 'info',
                title: 'Issue Ignored',
                message: `Anomaly on ${issue.column} marked as accepted risk for this release.`
              });
              onClose();
            }}
          >
            Ignore
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                addToast({
                  type: 'success',
                  title: 'Governance Rule Drafted',
                  message: `New validation rule generated for column "${issue.column}".`
                });
                onClose();
              }}
            >
              Create Rule
            </Button>
            <Button size="sm" icon={Check} onClick={handleResolve}>
              Mark Resolved
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-6 text-xs text-slate-600 dark:text-slate-300">
        {/* Severity & Status */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800">
          <div>
            <div className="text-[11px] text-slate-400 mb-0.5">Severity Level</div>
            <Badge status={issue.severity} size="sm" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400 mb-0.5">Investigation Status</div>
            <Badge status={issue.status} size="sm" dot />
          </div>
          <div className="text-right">
            <div className="text-[11px] text-slate-400 mb-0.5">Affected Rows</div>
            <div className="font-bold text-sm text-slate-900 dark:text-white">
              {issue.count?.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Rule Violated */}
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-1.5">
            Validation Rule Violated
          </h4>
          <p className="p-3 rounded-lg bg-slate-50 dark:bg-[#111C2E] font-mono text-[11px] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800">
            {issue.ruleViolated || 'Schema Constraint Rule #104'}
          </p>
        </div>

        {/* Example Anomaly Values */}
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-1.5">
            Example Anomaly Values (First 4 rows)
          </h4>
          <div className="space-y-1.5">
            {(sampleValues[issue.column] || ['"INVALID_FORMAT"', '"NULL"']).map((val, idx) => (
              <div
                key={idx}
                className="px-3 py-2 rounded bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 font-mono text-[11px] text-rose-700 dark:text-rose-300"
              >
                {val}
              </div>
            ))}
          </div>
        </div>

        {/* Recommended Action */}
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-1.5">
            Recommended Remediation
          </h4>
          <p className="leading-relaxed bg-blue-50/60 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-900/40 text-blue-900 dark:text-blue-200">
            {issue.severity === 'High'
              ? 'Update ingestion validation pipeline to reject empty payload fields and populate default fallback values from upstream CRM.'
              : 'Add column deduplication transform or fuzzy match resolution step in intermediate dbt staging model.'
            }
          </p>
        </div>
      </div>
    </Drawer>
  );
}
