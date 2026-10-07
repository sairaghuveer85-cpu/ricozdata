import React from 'react';

export default function QualityScore({ score = null, grade = 'Unrated', trend = null }) {
  const hasScore = score != null && !isNaN(score);
  const numScore = hasScore ? Math.max(0, Math.min(100, Number(score))) : 0;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (numScore / 100) * circumference;

  return (
    <div
      className="enterprise-panel rounded-lg p-6 flex flex-col items-center justify-center text-center h-full"
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
            className={hasScore ? (numScore >= 90 ? 'text-emerald-500' : numScore >= 75 ? 'text-blue-500' : 'text-amber-500') : 'text-slate-300 dark:text-slate-700'}
            strokeWidth="9"
            strokeDasharray={circumference}
            strokeDashoffset={hasScore ? strokeDashoffset : circumference}
            strokeLinecap="round"
            stroke="currentColor"
            fill="transparent"
          />
        </svg>

        <div className="absolute flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tabular-nums text-slate-900 dark:text-white tracking-tight">
            {hasScore ? `${score}%` : 'N/A'}
          </span>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
            {hasScore ? grade : 'Unrated'}
          </span>
        </div>
      </div>

      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium">
        <span>{hasScore ? (trend || 'Verified quality score') : 'Run evaluation to calculate score'}</span>
      </div>
    </div>
  );
}
