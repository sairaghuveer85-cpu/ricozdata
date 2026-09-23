import React, { useState, useEffect, useRef } from 'react';
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
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && dropdownOpen) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dropdownOpen]);

  const metrics = [
    {
      id: 'total-datasets',
      title: 'Total Datasets',
      value: '1,248',
      comparisonText: '+12.4% vs last period',
      isPositive: true,
      trendType: 'positive'
    },
    {
      id: 'data-quality',
      title: 'Quality Score',
      value: '92.4%',
      comparisonText: '+3.2% vs target',
      isPositive: true,
      trendType: 'positive'
    },
    {
      id: 'policy-violations',
      title: 'Active Violations',
      value: '36',
      comparisonText: '-18.6% resolved',
      isPositive: true,
      trendType: 'positive'
    },
    {
      id: 'active-users',
      title: 'Active Analysts',
      value: '24',
      comparisonText: '+9.1% monthly',
      isPositive: true,
      trendType: 'positive'
    }
  ];

  return (
    <div className="space-y-4 sm:space-y-5 pb-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-200/60 dark:border-[#1D3047]/60">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
            Enterprise Overview
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Operational reliability, data governance, and active catalog inventory.
          </p>
        </div>

        {/* Date / Time Range Selector */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-[#1D3047] bg-white dark:bg-[#0D1828]">
            <Calendar className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
            <span>Sep 18, 2026</span>
          </div>

          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              aria-haspopup="true"
              aria-expanded={dropdownOpen}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer border border-slate-200 dark:border-[#1D3047] bg-white dark:bg-[#0D1828] text-slate-800 dark:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <span>{timeRange}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
            </button>

            {dropdownOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-1 w-36 rounded-md shadow-md py-1 z-30 text-xs bg-white dark:bg-[#0D1828] border border-slate-200 dark:border-[#1D3047]"
              >
                {['Last 7 days', 'Last 30 days', 'Last 90 days', 'Year to date'].map((range) => (
                  <button
                    key={range}
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      setTimeRange(range);
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-[#111E30] transition-colors focus:outline-none focus:bg-slate-50 dark:focus:bg-[#111E30] ${
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

      {/* 1. Integrated KPI Metric Bar */}
      <div className="enterprise-workbench rounded-lg border border-slate-200 dark:border-[#1D3047] bg-white dark:bg-[#0D1828] grid grid-cols-2 lg:grid-cols-4 overflow-hidden shadow-2xs">
        {metrics.map((metric, idx) => (
          <div
            key={metric.id}
            className={`
              ${idx % 2 === 1 ? 'border-l border-slate-200 dark:border-[#1D3047]' : ''}
              ${idx >= 2 ? 'border-t lg:border-t-0 border-slate-200 dark:border-[#1D3047]' : ''}
              ${idx > 0 ? 'lg:border-l lg:border-slate-200 lg:dark:border-[#1D3047]' : ''}
            `}
          >
            <StatCard
              title={metric.title}
              value={metric.value}
              comparisonText={metric.comparisonText}
              isPositive={metric.isPositive}
              trendType={metric.trendType}
            />
          </div>
        ))}
      </div>

      {/* 2. Unified Data Reliability Studio (Quality Trend + Health Index) */}
      <div className="enterprise-workbench rounded-lg border border-slate-200 dark:border-[#1D3047] bg-white dark:bg-[#0D1828] grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-[#1D3047]">
        <div className="lg:col-span-8 p-4 sm:p-5 flex flex-col justify-between">
          <QualityChart />
        </div>
        <div className="lg:col-span-4 p-4 sm:p-5 flex flex-col justify-between bg-slate-50/40 dark:bg-[#111E30]/20">
          <DataHealthCard />
        </div>
      </div>

      {/* 3. Unified Operations Workbench (Activity Stream + High-Demand Assets) */}
      <div className="enterprise-workbench rounded-lg border border-slate-200 dark:border-[#1D3047] bg-white dark:bg-[#0D1828] grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-[#1D3047]">
        <div className="p-4 sm:p-5 flex flex-col justify-between">
          <RecentActivity />
        </div>
        <div className="p-4 sm:p-5 flex flex-col justify-between">
          <PopularDatasets />
        </div>
      </div>
    </div>
  );
}
