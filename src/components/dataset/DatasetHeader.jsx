import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  FileText,
  ChevronRight,
  ChevronDown,
  Terminal,
  GitFork,
  Download,
  Trash2,
  Share2,
  MoreHorizontal,
  CheckCircle2,
  ShieldCheck,
  Clock,
  Sparkles,
  User,
  Database,
  Layers,
  Columns,
  Eye,
  Lock
} from 'lucide-react';
import Badge from '../common/Badge';
import Dropdown from '../common/Dropdown';
import Button from '../common/Button';
import { useApp } from '../../context/AppContext';

export default function DatasetHeader({
  dataset,
  onOpenQuery,
  onDelete
}) {
  const { addToast } = useApp();

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    addToast({
      title: 'Link Copied',
      message: 'Dataset permalink copied to clipboard.',
      type: 'success'
    });
  };

  return (
    <div className="space-y-5 mb-6">
      {/* Dynamic Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <NavLink to="/catalog" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          Data Catalog
        </NavLink>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600" />
        <span className="text-slate-900 dark:text-white font-semibold">{dataset.name}</span>
      </nav>

      {/* Main Identity Row */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-start gap-3 sm:gap-4 min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/60 flex items-center justify-center shrink-0 shadow-2xs">
            <Database className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                {dataset.name}
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                Certified
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-3xl leading-relaxed">
              {dataset.description}
            </p>
          </div>
        </div>

        {/* Action Buttons: Open, Share, More */}
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          <Button
            variant="secondary"
            size="sm"
            icon={Share2}
            onClick={handleShare}
          >
            Share
          </Button>

          <Dropdown
            align="right"
            width="w-52"
            trigger={
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                <span>Open Studio</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-80" />
              </button>
            }
            items={[
              {
                label: 'Query with SQL',
                icon: Terminal,
                onClick: onOpenQuery
              },
              {
                label: 'View in Lineage Graph',
                icon: GitFork,
                onClick: () => window.location.assign('/lineage')
              },
              {
                label: 'Export Schema Definition',
                icon: Download,
                onClick: () => handleShare()
              },
              { divider: true },
              {
                label: 'Delete Dataset',
                icon: Trash2,
                danger: true,
                onClick: onDelete
              }
            ]}
          />
        </div>
      </div>
    </div>
  );
}
