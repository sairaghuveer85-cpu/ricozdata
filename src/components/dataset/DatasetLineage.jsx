import React from 'react';
import { NavLink } from 'react-router-dom';
import { GitFork } from 'lucide-react';
import Button from '../common/Button';
import { useApp } from '../../context/AppContext';

export default function DatasetLineage({ dataset }) {
  const { getDatasetLineage } = useApp();
  const lineageGraph = getDatasetLineage ? getDatasetLineage(dataset?.id) : null;
  const nodes = lineageGraph?.nodes || [];

  const sourceNode = nodes.find(n => n.data?.categoryType === 'source');
  const transformNode = nodes.find(n => n.data?.categoryType === 'transformation');
  const destNodes = nodes.filter(n => n.data?.categoryType === 'destination');

  return (
    <div className="theme-card rounded-lg p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Lineage Map Overview</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Trace upstream data sources and downstream analytics dependencies
          </p>
        </div>
        <NavLink to={`/lineage/${dataset.id}`}>
          <Button size="sm" icon={GitFork}>
            Open Interactive Lineage
          </Button>
        </NavLink>
      </div>

      {/* Visual Pipeline Summary Card */}
      <div className="bg-slate-50 dark:bg-slate-850/60 p-5 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Source */}
        <div className="bg-white dark:bg-[#0f172a] p-3 rounded-md border border-slate-200 dark:border-slate-700/80 text-center w-full md:w-48 shadow-2xs">
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-1">Source</span>
          <span className="text-xs font-semibold text-slate-900 dark:text-white block truncate">
            {sourceNode?.data?.label || 'Direct Ingestion'}
          </span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate block">
            {sourceNode?.data?.typeLabel || dataset.source}
          </span>
        </div>

        <div className="text-slate-400 dark:text-slate-600 font-bold hidden md:block">→</div>

        {/* Transformation */}
        <div className="bg-white dark:bg-[#0f172a] p-3 rounded-md border border-slate-200 dark:border-slate-700/80 text-center w-full md:w-48 shadow-2xs">
          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block mb-1">Transformation</span>
          <span className="text-xs font-semibold text-slate-900 dark:text-white block truncate">
            {transformNode?.data?.label || 'dbt Mart Transform'}
          </span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate block">
            {transformNode?.data?.typeLabel || 'Automated Pipeline'}
          </span>
        </div>

        <div className="text-slate-400 dark:text-slate-600 font-bold hidden md:block">→</div>

        {/* Dataset */}
        <div className="bg-blue-50/60 dark:bg-blue-950/40 p-3 rounded-md border border-blue-500/80 text-center w-full md:w-48 shadow-2xs">
          <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider block mb-1">This Dataset</span>
          <span className="text-xs font-semibold text-blue-950 dark:text-blue-200 block truncate">{dataset.name}</span>
          <span className="text-[11px] text-blue-600 dark:text-blue-400">{dataset.rows} rows</span>
        </div>

        <div className="text-slate-400 dark:text-slate-600 font-bold hidden md:block">→</div>

        {/* Downstream */}
        <div className="bg-white dark:bg-[#0f172a] p-3 rounded-md border border-slate-200 dark:border-slate-700/80 text-center w-full md:w-48 shadow-2xs">
          <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider block mb-1">
            {destNodes.length} {destNodes.length === 1 ? 'Destination' : 'Destinations'}
          </span>
          <span className="text-xs font-semibold text-slate-900 dark:text-white block truncate">
            {destNodes[0]?.data?.label || 'Downstream Consumers'}
          </span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate block">
            {destNodes.length > 1 ? `+${destNodes.length - 1} other consumers` : 'Active Consumer'}
          </span>
        </div>
      </div>
    </div>
  );
}
