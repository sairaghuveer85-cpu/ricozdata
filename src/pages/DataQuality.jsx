import React, { useState } from 'react';
import { useParams, NavLink } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import QualityScore from '../components/quality/QualityScore';
import QualityMetrics from '../components/quality/QualityMetrics';
import QualityIssues from '../components/quality/QualityIssues';
import QualityTrends from '../components/quality/QualityTrends';
import RulesTable from '../components/governance/RulesTable';
import { useApp } from '../context/AppContext';

export default function DataQuality() {
  const { datasetId } = useParams();
  const { datasets, qualityOverview, getQualityForDataset } = useApp();

  const dataset = datasets.find(d => d.id === datasetId) || datasets[0];
  const quality = (getQualityForDataset && dataset) ? getQualityForDataset(dataset.id) : qualityOverview;

  const [activeTab, setActiveTab] = useState('issues');
  const [timeRange, setTimeRange] = useState('Last 30 days');

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <NavLink to="/catalog" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          Data Catalog
        </NavLink>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <NavLink to={`/catalog/${dataset.id}`} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          {dataset.name}
        </NavLink>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-slate-800 dark:text-slate-200 font-medium">Data Quality</span>
      </nav>

      {/* Header Row with Timeframe Dropdown */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Data Quality
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Monitor and improve the quality of your data.
          </p>
        </div>

        {/* Timeframe Dropdown */}
        <div className="relative inline-block self-start sm:self-auto">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-[#0B1628] border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="Last 7 days" className="bg-white dark:bg-[#0B1628] text-slate-900 dark:text-white">Last 7 days</option>
            <option value="Last 30 days" className="bg-white dark:bg-[#0B1628] text-slate-900 dark:text-white">Last 30 days</option>
            <option value="Last 90 days" className="bg-white dark:bg-[#0B1628] text-slate-900 dark:text-white">Last 90 days</option>
            <option value="Year to date" className="bg-white dark:bg-[#0B1628] text-slate-900 dark:text-white">Year to date</option>
          </select>
        </div>
      </div>

      {/* Top Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <QualityScore
            score={dataset.quality || quality.score || 98}
            grade={quality.grade || 'Excellent'}
            trend={quality.trendText || '↑ 3% from last month'}
          />
        </div>
        <div className="lg:col-span-2">
          <QualityMetrics dimensions={quality.dimensions || qualityOverview.dimensions} />
        </div>
      </div>

      {/* Bottom Tabs */}
      <div className="space-y-4">
        <div className="border-b border-slate-200 dark:border-slate-800 -mx-3.5 px-3.5 sm:mx-0 sm:px-0">
          <nav className="flex space-x-6 overflow-x-auto no-scrollbar py-0.5">
            {[
              { id: 'issues', label: 'Issues' },
              { id: 'rules', label: 'Quality Rules' },
              { id: 'trends', label: 'Trends' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`
                  py-3 px-1 border-b-2 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0
                  ${activeTab === tab.id
                    ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
                  }
                `}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'issues' && <QualityIssues datasetId={dataset.id} />}
        {activeTab === 'rules' && <RulesTable activeSubTab="rules" />}
        {activeTab === 'trends' && <QualityTrends />}
      </div>
    </div>
  );
}
