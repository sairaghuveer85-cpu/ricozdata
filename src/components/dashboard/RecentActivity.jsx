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
            <h3 
              className="text-sm font-semibold"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Platform Activity Stream
            </h3>
            <span 
              className="text-[11px]"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Live governance and pipeline events
            </span>
          </div>
          <NavLink
            to="/reports"
            className="text-xs hover:underline flex items-center gap-0.5 focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded font-medium"
            style={{ color: 'var(--color-brand)' }}
          >
            <span>View audit</span>
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          </NavLink>
        </div>

        <div 
          className="divide-y"
          style={{ borderColor: 'var(--color-border)' }}
        >
          {activities.slice(0, 5).map((act) => (
            <div
              key={act.id}
              className="py-2.5 flex items-center justify-between gap-3 text-xs transition-colors rounded px-1"
              style={{ 
                borderBottomColor: 'var(--color-border)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-secondary)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${getStatusDot(act.type)}`} aria-hidden="true" />
                <div className="min-w-0">
                  <span 
                    className="font-medium truncate block"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {act.target ? `${act.target} — ${act.title.toLowerCase()}` : act.title}
                  </span>
                </div>
              </div>
              <span 
                className="text-[11px] whitespace-nowrap shrink-0"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {getShortTime(act.time)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
