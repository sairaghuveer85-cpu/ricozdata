import React from 'react';
import Drawer from '../common/Drawer';
import Button from '../common/Button';
import Badge from '../common/Badge';
import {
  Database,
  Terminal,
  ArrowRight,
  Layers,
  Sparkles,
  Clock,
  User,
  Server,
  GitFork,
  CheckCircle2
} from 'lucide-react';

export default function NodeDrawer({ node, isOpen, onClose, onViewSql }) {
  if (!node) return null;
  const data = node.data;

  const getCategoryColor = (category) => {
    switch (category) {
      case 'Source':
        return 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60';
      case 'Transformation':
        return 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/60';
      case 'Dataset':
        return 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/60';
      default:
        return 'bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800/60';
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={data.label}
      subtitle={`${data.category} • ${data.typeLabel}`}
      footer={
        <>
          <Button
            variant="secondary"
            size="sm"
            icon={Terminal}
            onClick={() => {
              onClose();
              onViewSql && onViewSql();
            }}
          >
            View SQL
          </Button>
          <Button size="sm" onClick={onClose}>
            Close Inspector
          </Button>
        </>
      }
    >
      <div className="space-y-5 text-xs text-slate-600 dark:text-slate-300">
        {/* Node Overview Banner */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${getCategoryColor(data.category)}`}>
              <GitFork className="w-3 h-3" />
              <span>{data.category} Node</span>
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              <Sparkles className="w-3 h-3" />
              {data.quality || '98%'} Quality
            </span>
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800/60 grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-[11px] text-slate-400 block mb-0.5">Status</span>
              <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                {data.status || 'Active'}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block mb-0.5">Last Updated</span>
              <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {data.updated || 'Recently'}
              </span>
            </div>
          </div>
        </div>

        {/* Detailed Metadata Grid: Owner, Source, Rows, Underlying Infrastructure */}
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-2.5">
            Node Attributes
          </h4>
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-[#0B1628]">
            <div className="px-3.5 py-2.5 flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Owner
              </span>
              <span className="font-semibold text-slate-900 dark:text-white">{data.owner || 'Enterprise Platform'}</span>
            </div>
            <div className="px-3.5 py-2.5 flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5" /> Source / Engine
              </span>
              <span className="font-semibold text-blue-600 dark:text-blue-400">{data.source || data.system}</span>
            </div>
            <div className="px-3.5 py-2.5 flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" /> Record Count
              </span>
              <span className="font-semibold text-slate-900 dark:text-white">{data.rows || data.records}</span>
            </div>
            <div className="px-3.5 py-2.5 flex items-center justify-between">
              <span className="text-slate-400">Infrastructure</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">{data.system}</span>
            </div>
          </div>
        </div>

        {/* Upstream Dependencies */}
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-2">
            Dependencies (Upstream)
          </h4>
          <div className="space-y-1.5">
            {(data.dependencies || ['CRM (Salesforce)']).map((dep, idx) => (
              <div key={idx} className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-xs font-medium text-slate-800 dark:text-slate-200">
                {dep}
              </div>
            ))}
          </div>
        </div>

        {/* Downstream Consumers */}
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-2">
            Consumers (Downstream)
          </h4>
          <div className="space-y-1.5">
            {(data.consumers || ['Marketing Dashboard', 'ML Model']).map((con, idx) => (
              <div key={idx} className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-xs font-medium text-slate-800 dark:text-slate-200">
                {con}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Drawer>
  );
}
