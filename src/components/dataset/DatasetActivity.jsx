import React from 'react';
import { User } from 'lucide-react';

export default function DatasetActivity({ dataset: _dataset }) {
  const events = [
    {
      title: 'Dataset Certified by Governance Board',
      user: 'Vikram M.',
      time: 'Sep 16, 2026 at 10:45 AM',
      description: 'Passed annual PII security audit and SLA quality thresholds.'
    },
    {
      title: 'Schema Update - Added churn_risk_score',
      user: 'Arjun K.',
      time: 'Sep 12, 2026 at 03:15 PM',
      description: 'Added float prediction column from ML model output.'
    },
    {
      title: 'Data Quality Test Run Completed',
      user: 'System Guard',
      time: 'Sep 10, 2026 at 01:00 AM',
      description: 'Verified 12.4M rows. 98% overall score.'
    },
    {
      title: 'Initial Dataset Registration',
      user: 'Priya S.',
      time: 'Aug 04, 2026 at 09:00 AM',
      description: 'Connected Snowflake warehouse production stage.'
    }
  ];

  return (
    <div className="theme-card rounded-lg p-5 border border-slate-200 dark:border-slate-800 shadow-2xs">
      <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4">
        Audit & Change History
      </h3>
      <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
        {events.map((event, idx) => (
          <div key={idx} className="relative">
            <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-white dark:ring-slate-900" />
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-900 dark:text-white">{event.title}</span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">{event.time}</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{event.description}</p>
              <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1">
                <User className="w-3 h-3" />
                <span>Changed by {event.user}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
