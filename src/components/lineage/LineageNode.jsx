import React from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  Database,
  GitCommit,
  Table,
  BarChart2,
  PieChart,
  Cpu,
  Layers
} from 'lucide-react';

const iconMap = {
  Database,
  GitCommit,
  Table,
  BarChart2,
  PieChart,
  Cpu,
  Layers
};

export default function LineageNode({ data }) {
  const Icon = iconMap[data.icon] || Database;
  const isPrimary = data.isPrimary;

  const getBorderColor = () => {
    switch (data.categoryType) {
      case 'source':
        return 'border-emerald-400 dark:border-emerald-600/80';
      case 'transformation':
        return 'border-amber-400 dark:border-amber-600/80';
      case 'dataset':
        return 'border-blue-600 dark:border-blue-500 ring-1 ring-blue-500/20';
      case 'destination':
        return 'border-cyan-400 dark:border-cyan-600/80';
      default:
        return 'border-slate-200 dark:border-slate-700';
    }
  };

  const getBadgeStyle = () => {
    switch (data.categoryType) {
      case 'source':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60';
      case 'transformation':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60';
      case 'dataset':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/60';
      case 'destination':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-400 dark:border-cyan-800/60';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    }
  };

  return (
    <div
      className={`
        bg-white dark:bg-[#0c1322] rounded-lg p-3 min-w-[200px] border shadow-2xs transition-all hover:shadow-xs
        ${getBorderColor()}
      `}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="w-2 h-2 !bg-blue-600 dark:!bg-blue-400 !border-2 !border-white dark:!border-[#0c1322]"
      />

      <div className="flex items-start gap-2.5">
        <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
          isPrimary ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
        }`}>
          <Icon className="w-3.5 h-3.5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-xs border uppercase tracking-wider ${getBadgeStyle()}`}>
              {data.category}
            </span>
          </div>
          <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
            {data.label}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
            {data.typeLabel}
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="w-2 h-2 !bg-blue-600 dark:!bg-blue-400 !border-2 !border-white dark:!border-[#0c1322]"
      />
    </div>
  );
}
