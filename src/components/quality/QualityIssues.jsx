import React, { useState } from 'react';
import Badge from '../common/Badge';
import { ChevronRight, AlertCircle } from 'lucide-react';
import IssueDrawer from './IssueDrawer';
import { useApp } from '../../context/AppContext';

export default function QualityIssues() {
  const { issues } = useApp();
  const [filterSeverity, setFilterSeverity] = useState('All');
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const filteredIssues = issues.filter(iss => {
    if (filterSeverity === 'All') return true;
    return iss.severity === filterSeverity;
  });

  const handleRowClick = (item) => {
    setSelectedIssue(item);
    setIsDrawerOpen(true);
  };

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'High':
        return 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/60';
      case 'Medium':
        return 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/60';
      default:
        return 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900/60';
    }
  };

  return (
    <div className="theme-card rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
      {/* Table Toolbar */}
      <div className="p-4 flex items-center justify-between gap-3 flex-wrap border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
            Active Data Anomalies ({filteredIssues.length})
          </span>
          <span className="text-[11px] text-slate-400">Click any issue to inspect details</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Severity:</span>
          {['All', 'High', 'Medium', 'Low'].map((sev) => (
            <button
              key={sev}
              type="button"
              onClick={() => setFilterSeverity(sev)}
              className={`text-xs px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                filterSeverity === sev
                  ? 'bg-blue-600 text-white font-semibold shadow-2xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <th className="py-2.5 px-4">Issue Description</th>
              <th className="py-2.5 px-4">Target Column</th>
              <th className="py-2.5 px-4">Severity</th>
              <th className="py-2.5 px-4">Count</th>
              <th className="py-2.5 px-4">Status</th>
              <th className="py-2.5 px-4">Detected</th>
              <th className="py-2.5 px-4 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {filteredIssues.map((item) => (
              <tr
                key={item.id}
                onClick={() => handleRowClick(item)}
                className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
              >
                <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-white">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span>{item.issue}</span>
                  </div>
                </td>
                <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-400">
                  <span className="px-1.5 py-0.5 rounded-sm bg-slate-100 dark:bg-slate-800 text-[11px]">
                    {item.column}
                  </span>
                </td>
                <td className="py-2.5 px-4">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${getSeverityBadge(item.severity)}`}>
                    {item.severity}
                  </span>
                </td>
                <td className="py-2.5 px-4 font-semibold text-slate-800 dark:text-slate-200">
                  {item.count.toLocaleString()} rows
                </td>
                <td className="py-2.5 px-4">
                  <Badge status={item.status} size="sm" dot />
                </td>
                <td className="py-2.5 px-4 text-slate-400 dark:text-slate-500 whitespace-nowrap">
                  {item.detectedAt || '2 hours ago'}
                </td>
                <td className="py-2.5 px-4 text-right">
                  <span className="inline-flex items-center text-xs font-medium text-blue-600 dark:text-blue-400">
                    <span>Inspect</span>
                    <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Drawer */}
      <IssueDrawer
        issue={selectedIssue}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </div>
  );
}
