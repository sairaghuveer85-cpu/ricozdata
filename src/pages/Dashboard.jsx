import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Calendar } from 'lucide-react';
import StatCard from '../components/dashboard/StatCard';
import QualityChart from '../components/dashboard/QualityChart';
import DataHealthCard from '../components/dashboard/DataHealthCard';
import RecentActivity from '../components/dashboard/RecentActivity';
import PopularDatasets from '../components/dashboard/PopularDatasets';
import { useApp } from '../context/AppContext';

export default function Dashboard() {
  const { dashboardMetrics } = useApp();
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

  const metrics = dashboardMetrics || [
    {
      id: 'total-datasets',
      title: 'TOTAL DATASETS',
      value: '6',
      comparison: '+12.4%',
      isPositive: true,
      trend: 'up'
    },
    {
      id: 'data-quality',
      title: 'DATA QUALITY',
      value: '93%',
      comparison: '+3.2%',
      isPositive: true,
      trend: 'up'
    },
    {
      id: 'policy-violations',
      title: 'POLICY VIOLATIONS',
      value: '3',
      comparison: '-18.6%',
      isPositive: true,
      trend: 'down'
    },
    {
      id: 'active-users',
      title: 'ACTIVE USERS',
      value: '7',
      comparison: '+9.1%',
      isPositive: true,
      trend: 'up'
    }
  ];

  return (
    <div className="space-y-4 sm:space-y-5 pb-8">
      {/* Top Header */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <div>
          <h1
            className="text-xl sm:text-2xl font-bold tracking-tight leading-tight"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Enterprise Overview
          </h1>
          <p
            className="text-xs mt-0.5"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Operational reliability, data governance, and active catalog inventory.
          </p>
        </div>

        {/* Date / Time Range Selector */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium"
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-secondary)'
            }}
          >
            <Calendar className="w-3.5 h-3.5" style={{ color: 'var(--color-text-muted)' }} aria-hidden="true" />
            <span>Sep 18, 2026</span>
          </div>

          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              aria-haspopup="true"
              aria-expanded={dropdownOpen}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)'
              }}
            >
              <span>{timeRange}</span>
              <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--color-text-muted)' }} aria-hidden="true" />
            </button>

            {dropdownOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-1 w-36 rounded-md shadow-md py-1 z-30 text-xs"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)'
                }}
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
                    className="w-full text-left px-3 py-1.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-[#111E30] transition-colors focus:outline-none focus:bg-slate-50 dark:focus:bg-[#111E30]"
                    style={{
                      color: timeRange === range ? 'var(--color-brand)' : 'var(--color-text-secondary)',
                      fontWeight: timeRange === range ? 600 : 400
                    }}
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
      <div
        className="enterprise-workbench rounded-lg grid grid-cols-2 lg:grid-cols-4 overflow-hidden shadow-2xs"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)'
        }}
      >
        {metrics.map((metric, idx) => (
          <div
            key={metric.id}
            className={`
              ${idx % 2 === 1 ? 'border-l' : ''}
              ${idx >= 2 ? 'border-t lg:border-t-0' : ''}
              ${idx > 0 ? 'lg:border-l' : ''}
            `}
            style={{
              borderColor: 'var(--color-border)'
            }}
          >
            <StatCard
              title={metric.title}
              value={metric.value}
              comparisonText={metric.comparisonText || `${metric.comparison} ${metric.id === 'policy-violations' ? 'resolved' : metric.id === 'data-quality' ? 'vs target' : 'vs last period'}`}
              isPositive={metric.isPositive}
              trendType={metric.trendType || 'positive'}
            />
          </div>
        ))}
      </div>

      {/* 2. Unified Data Reliability Studio (Quality Trend + Health Index) */}
      <div
        className="enterprise-workbench rounded-lg grid grid-cols-1 lg:grid-cols-12 overflow-hidden shadow-2xs divide-y lg:divide-y-0 lg:divide-x"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderColor: 'var(--color-border)'
        }}
      >
        <div className="lg:col-span-8 p-4 sm:p-5 flex flex-col justify-between">
          <QualityChart />
        </div>
        <div
          className="lg:col-span-4 p-4 sm:p-5 flex flex-col justify-between"
          style={{
            backgroundColor: 'var(--color-surface-secondary)'
          }}
        >
          <DataHealthCard />
        </div>
      </div>

      {/* 3. Unified Operations Workbench (Activity Stream + High-Demand Assets) */}
      <div
        className="enterprise-workbench rounded-lg grid grid-cols-1 lg:grid-cols-2 overflow-hidden shadow-2xs divide-y lg:divide-y-0 lg:divide-x"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderColor: 'var(--color-border)'
        }}
      >
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
