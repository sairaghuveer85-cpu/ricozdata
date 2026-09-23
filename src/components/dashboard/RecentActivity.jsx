import React from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function RecentActivity() {
  const { activities } = useApp();

  const getShortTime = (timeStr) => {
    if (!timeStr) return 'now';
    if (timeStr.includes('minute')) return timeStr.replace(/[^0-9]/g, '') + 'm ago';
    if (timeStr.includes('hour')) return timeStr.replace(/[^0-9]/g, '') + 'h ago';
    if (timeStr.includes('day')) return timeStr.replace(/[^0-9]/g, '') + 'd ago';
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
    <div className="flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Platform Activity Stream
            </h3>
            <span className="text-[11px] text-slate-400">Live governance and pipeline events</span>
          </div>
          <NavLink
            to="/reports"
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded font-medium"
          >
            <span>View audit</span>
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          </NavLink>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-[#1D3047]">
          {activities.slice(0, 5).map((act) => (
            <div
              key={act.id}
              className="py-2.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-50/50 dark:hover:bg-[#111E30]/40 transition-colors rounded px-1"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${getStatusDot(act.type)}`} aria-hidden="true" />
                <div className="min-w-0">
                  <span className="font-medium text-slate-800 dark:text-slate-200 truncate block">
                    {act.target ? `${act.target} — ${act.title.toLowerCase()}` : act.title}
                  </span>
                </div>
              </div>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 whitespace-nowrap shrink-0">
                {getShortTime(act.time)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
