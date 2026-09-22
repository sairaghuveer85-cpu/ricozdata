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

export default function DatasetStats({ dataset }) {
  const stats = [
    {
      label: 'Owner',
      value: dataset.owner,
      icon: User,
      iconBg: 'bg-slate-100 text-slate-700'
    },
    {
      label: 'Domain',
      value: dataset.domain,
      icon: Folder,
      iconBg: 'bg-blue-50 text-blue-600'
    },
    {
      label: 'Source',
      value: dataset.source,
      icon: Cloud,
      iconBg: 'bg-sky-50 text-sky-600'
    },
    {
      label: 'Last Updated',
      value: dataset.lastUpdatedDate || 'Sep 16, 2026',
      icon: Clock,
      iconBg: 'bg-purple-50 text-purple-600'
    },
    {
      label: 'Rows',
      value: dataset.rows,
      icon: Layers,
      iconBg: 'bg-indigo-50 text-indigo-600'
    },
    {
      label: 'Columns',
      value: dataset.columnsCount || 48,
      icon: Columns,
      iconBg: 'bg-teal-50 text-teal-600'
    },
    {
      label: 'Sensitivity',
      value: dataset.sensitivity,
      icon: ShieldAlert,
      iconBg: 'bg-rose-50 text-rose-600'
    },
    {
      label: 'Usage',
      value: dataset.usage,
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
            className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs flex items-center gap-3.5"
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${stat.iconBg}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-slate-500 truncate">
                {stat.label}
              </div>
              <div className="text-xs font-bold text-slate-900 truncate mt-0.5">
                {stat.value}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
