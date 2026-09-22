import React, { useState } from 'react';
import { ChevronDown, Calendar } from 'lucide-react';
import StatCard from '../components/dashboard/StatCard';
import QualityChart from '../components/dashboard/QualityChart';
import DataHealthCard from '../components/dashboard/DataHealthCard';
import RecentActivity from '../components/dashboard/RecentActivity';
import PopularDatasets from '../components/dashboard/PopularDatasets';
import { useApp } from '../context/AppContext';

export default function Dashboard() {
  const { currentUser } = useApp();
  const [timeRange, setTimeRange] = useState('Last 30 days');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const metrics = [
    {
      id: 'total-datasets',
      title: 'TOTAL DATASETS',
      value: '1,248',
      comparisonText: '+12.4% vs previous period',
      isPositive: true,
      trendType: 'positive'
    },
    {
      id: 'data-quality',
      title: 'DATA QUALITY',
      value: '92.4%',
      comparisonText: '+3.2% vs previous period',
      isPositive: true,
      trendType: 'positive'
    },
    {
      id: 'policy-violations',
      title: 'POLICY VIOLATIONS',
      value: '36',
      comparisonText: '18.6% fewer than previous period',
      isPositive: true,
      trendType: 'positive' // Fewer violations is positive!
    },
    {
      id: 'active-users',
      title: 'ACTIVE USERS',
      value: '24',
      comparisonText: '+9.1% vs previous period',
      isPositive: true,
      trendType: 'positive'
    }
  ];

  return (
    <div className="space-y-6 pb-8">
      {/* Top Header matching Section A */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] sm:text-[28px] font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
            Good morning, {currentUser?.name?.split(' ')[0] || 'Raghuveer'}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Here&apos;s your organization&apos;s data health at a glance.
          </p>
        </div>

        {/* Date / Time Range Selector */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1628]">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>Sep 18, 2026</span>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1628] text-slate-800 dark:text-slate-200"
            >
              <span>{timeRange}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-36 rounded-md shadow-md py-1 z-30 text-xs bg-white dark:bg-[#0B1628] border border-slate-200 dark:border-slate-800">
                {['Last 7 days', 'Last 30 days', 'Last 90 days', 'Year to date'].map((range) => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => {
                      setTimeRange(range);
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
                      timeRange === range
                        ? 'text-blue-600 dark:text-blue-400 font-semibold'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Metric Summary: Compact, unified enterprise metric row (Section B) */}
      <div
        className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1628] grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800"
        style={{ borderRadius: '8px' }}
      >
        {metrics.map((metric) => (
          <StatCard
            key={metric.id}
            title={metric.title}
            value={metric.value}
            comparisonText={metric.comparisonText}
            isPositive={metric.isPositive}
            trendType={metric.trendType}
          />
        ))}
      </div>

      {/* Middle Row: Data Quality Trend (~65-70%) + Data Health Summary (~30-35%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-8">
          <QualityChart />
        </div>
        <div className="lg:col-span-4">
          <DataHealthCard />
        </div>
      </div>

      {/* Bottom Row: Recent Activity (50%) + Popular Datasets (50%) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <div>
          <RecentActivity />
        </div>
        <div>
          <PopularDatasets />
        </div>
      </div>
    </div>
  );
}
