import React from 'react';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/common/Button';
import { Download, FileText } from 'lucide-react';
import { INITIAL_ACTIVITIES } from '../data/activities';

export default function Reports() {
  const reports = [
    {
      title: 'Quarterly Data Governance & PII Audit',
      date: 'Generated Sep 15, 2026',
      size: '4.8 MB',
      type: 'PDF',
      status: 'Ready'
    },
    {
      title: 'Warehouse Quality SLA & Error Breakdown',
      date: 'Generated Sep 10, 2026',
      size: '2.1 MB',
      type: 'CSV',
      status: 'Ready'
    },
    {
      title: 'Access Control & Privilege Certification Log',
      date: 'Generated Sep 01, 2026',
      size: '3.4 MB',
      type: 'PDF',
      status: 'Ready'
    },
    {
      title: 'GDPR & CCPA Subject Access Request (SAR) Register',
      date: 'Generated Aug 25, 2026',
      size: '1.2 MB',
      type: 'PDF',
      status: 'Ready'
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Compliance Audits"
        subtitle="Export executive summaries, data quality certifications, and security audit logs."
        actions={
          <Button
            size="md"
            icon={Download}
            onClick={() => alert('Generating on-demand compliance snapshot...')}
            className="w-full sm:w-auto"
          >
            Generate Report
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map((rep, idx) => (
          <div key={idx} className="bg-white dark:bg-[#0B1628] rounded-xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">{rep.title}</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{rep.date} • {rep.size}</p>
              </div>
            </div>

            <Button
              variant="secondary"
              size="xs"
              icon={Download}
              onClick={() => alert(`Downloading ${rep.title}`)}
              className="w-full sm:w-auto shrink-0 justify-center"
            >
              Export {rep.type}
            </Button>
          </div>
        ))}
      </div>

      {/* Audit Log Stream */}
      <div className="bg-white dark:bg-[#0B1628] rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs p-4 sm:p-5">
        <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4">
          Recent System Audit Stream
        </h3>
        <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
          {INITIAL_ACTIVITIES.map(act => (
            <div key={act.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{act.title}</span>
                <span className="text-slate-500 dark:text-slate-400 ml-1.5 sm:ml-2">({act.target})</span>
              </div>
              <div className="text-slate-400 dark:text-slate-500 text-[11px] shrink-0">{act.time}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
