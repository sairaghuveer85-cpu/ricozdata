import React, { useState, useEffect, useRef } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine
} from 'recharts';
import { ChevronDown } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { QUALITY_TRENDS } from '../../data/quality';

const CustomTooltip = ({ active, payload, label, isDark }) => {
  if (active && payload && payload.length) {
    return (
      <div
        className="text-xs rounded-md p-2.5 shadow-sm"
        style={{
          backgroundColor: isDark ? '#0D1828' : '#FFFFFF',
          color: isDark ? '#F8FAFC' : '#111827',
          border: `1px solid ${isDark ? '#1D3047' : '#E2E8F0'}`
        }}
      >
        <p className="font-semibold text-slate-700 dark:text-slate-300">
          {label} 2026
        </p>
        <div className="mt-1 flex items-center justify-between gap-4">
          <span className="text-slate-500 dark:text-slate-400">Quality:</span>
          <span className="font-bold text-blue-600 dark:text-blue-400 tabular-nums">
            {payload[0].value}%
          </span>
        </div>
      </div>
    );
  }
  return null;
};

export default function QualityChart() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [timeRange, setTimeRange] = useState('Last 6 months');
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

  const gridStroke = isDark ? '#1D3047' : '#F1F4F8';
  const axisStroke = isDark ? '#2A4363' : '#E2E8F0';
  const tickColor = isDark ? '#8290A3' : '#64748B';
  const brandColor = isDark ? '#60A5FA' : '#2563EB';
  const referenceLineStroke = isDark ? '#475569' : '#94A3B8';

  return (
    <div
      role="region"
      aria-label="Data Quality Trend Chart"
      className="flex flex-col h-full justify-between"
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-baseline gap-2.5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Data Quality Progression
            </h3>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              +3.2% vs previous period
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Historical progression across verified production tables (Target: 90%)
          </p>
        </div>

        {/* Timeframe Selector */}
        <div className="relative self-start sm:self-auto" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            aria-haspopup="true"
            aria-expanded={dropdownOpen}
            className="inline-flex items-center gap-1.5 text-xs rounded-md px-2.5 py-1 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#1D3047] bg-white dark:bg-[#0D1828] hover:bg-slate-50 dark:hover:bg-[#111E30] transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <span>{timeRange}</span>
            <ChevronDown className="w-3 h-3 text-slate-400" aria-hidden="true" />
          </button>

          {dropdownOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-1 w-32 rounded-md shadow-md py-1 z-30 text-xs bg-white dark:bg-[#0D1828] border border-slate-200 dark:border-[#1D3047]"
            >
              {['Last 3 months', 'Last 6 months', 'Year to date'].map((range) => (
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

      <div className="flex-1 w-full min-h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={QUALITY_TRENDS} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 2" vertical={false} stroke={gridStroke} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={{ stroke: axisStroke }}
              tick={{ fill: tickColor, fontSize: 11 }}
            />
            <YAxis
              domain={[60, 100]}
              ticks={[60, 70, 80, 90, 100]}
              tickFormatter={(v) => `${v}%`}
              tickLine={false}
              axisLine={false}
              tick={{ fill: tickColor, fontSize: 11 }}
            />
            <Tooltip content={<CustomTooltip isDark={isDark} />} />
            <ReferenceLine
              y={90}
              stroke={referenceLineStroke}
              strokeDasharray="3 3"
              label={{
                value: 'Target 90%',
                position: 'right',
                fill: referenceLineStroke,
                fontSize: 10
              }}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke={brandColor}
              strokeWidth={2}
              dot={{ stroke: brandColor, strokeWidth: 1.5, r: 3, fill: isDark ? '#0D1828' : '#FFFFFF' }}
              activeDot={{ r: 5, stroke: brandColor, strokeWidth: 2, fill: isDark ? '#0D1828' : '#FFFFFF' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="pt-3 mt-2 border-t border-slate-100 dark:border-[#1D3047] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 inline-block shrink-0" aria-hidden="true" />
            <span>Actual Score (92.4%)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-slate-400 dark:bg-slate-500 inline-block shrink-0" aria-hidden="true" />
            <span>Target Line (90.0%)</span>
          </span>
        </div>
        <span className="text-[10px] sm:text-[11px]">142 validation rules verified</span>
      </div>
    </div>
  );
}
