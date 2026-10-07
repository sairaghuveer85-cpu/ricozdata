import React from 'react';
import {
  User,
  Folder,
  Cloud,
  Clock,
  Layers,
  Columns,
  ShieldAlert,
  Eye
} from 'lucide-react';

export default function DatasetStats({ dataset = {} }) {
  const resolvedUsage = dataset.usage || (dataset.views !== undefined ? `${dataset.views.toLocaleString()} views` : '0 views');
  const resolvedColumns = dataset.columnsCount !== undefined && dataset.columnsCount !== null
    ? dataset.columnsCount
    : (Array.isArray(dataset.columns) ? dataset.columns.length : 'Not Available');
  const resolvedUpdated = dataset.lastUpdatedDate || dataset.updated || 'Not Available';
  const resolvedRows = dataset.rows || (dataset.rowCount !== undefined ? `${dataset.rowCount} rows` : 'Not Available');
  const resolvedOwner = dataset.owner || 'Unassigned';
  const resolvedDomain = dataset.domain || 'Unassigned';
  const resolvedSource = dataset.source || 'External Source';
  const resolvedSensitivity = dataset.sensitivity || 'Internal';

  const stats = [
    {
      label: 'Owner',
      value: resolvedOwner,
      icon: User,
      iconBg: 'bg-slate-100 text-slate-700'
    },
    {
      label: 'Domain',
      value: resolvedDomain,
      icon: Folder,
      iconBg: 'bg-blue-50 text-blue-600'
    },
    {
      label: 'Source',
      value: resolvedSource,
      icon: Cloud,
      iconBg: 'bg-sky-50 text-sky-600'
    },
    {
      label: 'Last Updated',
      value: resolvedUpdated,
      icon: Clock,
      iconBg: 'bg-purple-50 text-purple-600'
    },
    {
      label: 'Rows',
      value: resolvedRows,
      icon: Layers,
      iconBg: 'bg-indigo-50 text-indigo-600'
    },
    {
      label: 'Columns',
      value: resolvedColumns,
      icon: Columns,
      iconBg: 'bg-teal-50 text-teal-600'
    },
    {
      label: 'Sensitivity',
      value: resolvedSensitivity,
      icon: ShieldAlert,
      iconBg: 'bg-rose-50 text-rose-600'
    },
    {
      label: 'Usage',
      value: resolvedUsage,
      icon: Eye,
      iconBg: 'bg-amber-50 text-amber-600'
    }
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-6">
      {stats.map((stat, idx) => {
        const Icon = stat.icon;
        return (
          <div
            key={idx}
            className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center gap-3.5"
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${stat.iconBg}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-slate-500 truncate">
                {stat.label}
              </div>
              <div className="text-xs font-bold text-slate-900 dark:text-white truncate mt-0.5">
                {stat.value}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
