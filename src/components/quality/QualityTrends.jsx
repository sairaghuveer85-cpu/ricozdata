import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import { useTheme } from '../../context/ThemeContext';
import { QUALITY_TRENDS } from '../../data/quality';

export default function QualityTrends() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const gridStroke = isDark ? '#1D3047' : '#E2E8F0';
  const axisStroke = isDark ? '#2A4363' : '#CBD5E1';
  const tickColor = isDark ? '#8290A3' : '#475569';
  const textColor = isDark ? '#F8FAFC' : '#111827';
  const tooltipBg = isDark ? '#0D1828' : '#FFFFFF';
  const tooltipBorder = isDark ? '#1D3047' : '#E2E8F0';

  return (
    <div
      className="rounded-xl p-5 shadow-xs space-y-4"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        color: 'var(--color-text-primary)'
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>Historical Quality Breakdown</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Completeness vs Accuracy vs Overall Score over last 6 months</p>
        </div>
      </div>

      <div className="w-full h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={QUALITY_TRENDS} margin={{ top: 15, right: 15, left: -15, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
            <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: axisStroke }} tick={{ fill: tickColor, fontSize: 11 }} />
            <YAxis domain={[60, 100]} tickLine={false} axisLine={false} tick={{ fill: tickColor, fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: tooltipBg,
                borderColor: tooltipBorder,
                borderRadius: '8px',
                color: textColor,
                fontSize: '12px',
                boxShadow: isDark ? '0 10px 25px rgba(0,0,0,0.4)' : '0 10px 25px rgba(15,23,42,0.08)'
              }}
            />
            <Legend wrapperStyle={{ fontSize: '12px', color: isDark ? '#CBD5E1' : '#475569' }} />
            <Bar dataKey="score" name="Overall Score" fill={isDark ? '#60A5FA' : '#2563EB'} radius={[4, 4, 0, 0]} />
            <Bar dataKey="completeness" name="Completeness" fill={isDark ? '#4ADE80' : '#16A34A'} radius={[4, 4, 0, 0]} />
            <Bar dataKey="accuracy" name="Accuracy" fill={isDark ? '#818CF8' : '#6366F1'} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
