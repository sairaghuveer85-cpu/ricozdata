import React from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function RecentActivity() {
  const { activities } = useApp();

  const getShortTime = (timeStr) => {
    if (!timeStr) return 'now';
    if (timeStr.includes('minute')) return timeStr.replace(/[^0-9]/g, '') + 'm';
    if (timeStr.includes('hour')) return timeStr.replace(/[^0-9]/g, '') + 'h';
    if (timeStr.includes('day')) return timeStr.replace(/[^0-9]/g, '') + 'd';
    return timeStr;
  };

  const getStatusDot = (type) => {
    switch (type) {
      case 'alert':
        return 'bg-rose-500';
      case 'access':
        return 'bg-purple-500';
      case 'create':
        return 'bg-blue-500';
      case 'lineage':
        return 'bg-cyan-500';
      default:
        return 'bg-emerald-500';
    }
  };

  return (
    <div
      className="p-5 rounded-lg flex flex-col justify-between h-full"
      style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '8px'
      }}
    >
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Recent Activity
          </h3>
          <NavLink
            to="/reports"
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
          >
            <span>View all</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </NavLink>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
          {activities.slice(0, 5).map((act) => (
            <div
              key={act.id}
              className="py-2.5 flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${getStatusDot(act.type)}`} />
                <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                  {act.target ? `${act.target} — ${act.title.toLowerCase()}` : act.title}
                </span>
              </div>
              <span className="text-slate-400 dark:text-slate-500 whitespace-nowrap shrink-0">
                {getShortTime(act.time)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
