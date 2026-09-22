import React from 'react';

export default function QualityScore({ score = 98, grade = 'Excellent', trend = '↑ 3% from last month' }) {
  // SVG circular calculation
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div
      className="theme-card rounded-lg p-6 shadow-2xs flex flex-col items-center justify-center text-center h-full border border-slate-200 dark:border-slate-800"
    >
      <h3 className="text-xs font-bold uppercase tracking-wider mb-4 text-slate-900 dark:text-white">
        Overall Quality Score
      </h3>

      <div className="relative flex items-center justify-center mb-3">
        <svg className="w-36 h-36 transform -rotate-90" viewBox="0 0 128 128">
          <circle
            cx="64"
            cy="64"
            r={radius}
            className="text-slate-100 dark:text-slate-800"
            strokeWidth="9"
            stroke="currentColor"
            fill="transparent"
          />
          <circle
            cx="64"
            cy="64"
            r={radius}
            className="text-emerald-500 transition-all duration-700 ease-out"
            strokeWidth="9"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            stroke="currentColor"
            fill="transparent"
          />
        </svg>

        <div className="absolute flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            {score}%
          </span>
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
            {grade}
          </span>
        </div>
      </div>

      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium">
        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{trend}</span>
      </div>
    </div>
  );
}
