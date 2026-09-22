import React from 'react';
import { NavLink } from 'react-router-dom';
import { ArrowUpRight, ArrowRight } from 'lucide-react';
import Badge from '../common/Badge';
import { QUALITY_OVERVIEW, QUALITY_ISSUES } from '../../data/quality';

export default function DatasetQuality({ dataset }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Score Card */}
        <div className="theme-card rounded-lg p-5 border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center gap-5">
          <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
            <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-slate-100 dark:text-slate-800"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-emerald-500"
                strokeDasharray={`${dataset.quality || 98}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <span className="absolute text-sm font-bold text-slate-900 dark:text-white">{dataset.quality || 98}%</span>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Dataset Quality Score</div>
            <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">Excellent</div>
            <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3 text-emerald-500" />
              <span>+3% from last month</span>
            </div>
          </div>
        </div>

        {/* Quality Dimensions summary */}
        <div className="theme-card rounded-lg p-5 border border-slate-200 dark:border-slate-800 shadow-2xs md:col-span-2 flex flex-col justify-center space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200">
            <span>Dimension Compliance</span>
            <NavLink to={`/quality/${dataset.id}`} className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 text-xs">
              <span>View full quality report</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </NavLink>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {QUALITY_OVERVIEW.dimensions.map((dim, idx) => (
              <div key={idx} className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-md border border-slate-100 dark:border-slate-700/60 text-center">
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{dim.name}</div>
                <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">{dim.score}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quality Issues for this dataset */}
      <div className="theme-card rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Detected Quality Issues
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">4 total issues</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                <th className="py-2.5 px-4">Issue</th>
                <th className="py-2.5 px-4">Column</th>
                <th className="py-2.5 px-4">Severity</th>
                <th className="py-2.5 px-4">Count</th>
                <th className="py-2.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {QUALITY_ISSUES.map(iss => (
                <tr key={iss.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-white">{iss.issue}</td>
                  <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-400">{iss.column}</td>
                  <td className="py-2.5 px-4"><Badge status={iss.severity} size="sm" /></td>
                  <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300 font-medium">{iss.count.toLocaleString()}</td>
                  <td className="py-2.5 px-4"><Badge status={iss.status} size="sm" dot /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
