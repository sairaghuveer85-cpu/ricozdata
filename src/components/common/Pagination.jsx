import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({
  currentPage = 1,
  totalPages = 208,
  onPageChange
}) {
  return (
    <div className="flex items-center justify-center sm:justify-end gap-1 select-none flex-wrap">
      <button
        type="button"
        onClick={() => onPageChange && onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1628] text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#172337] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer text-xs"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {[1, 2, 3].map((num) => (
        <button
          key={num}
          type="button"
          onClick={() => onPageChange && onPageChange(num)}
          className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            currentPage === num
              ? 'bg-blue-600 text-white shadow-xs'
              : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1628] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#172337]'
          }`}
        >
          {num}
        </button>
      ))}

      <span className="w-8 h-8 flex items-center justify-center text-xs text-slate-400">...</span>

      <button
        type="button"
        onClick={() => onPageChange && onPageChange(totalPages)}
        className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
          currentPage === totalPages
            ? 'bg-blue-600 text-white shadow-xs'
            : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1628] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#172337]'
        }`}
      >
        {totalPages}
      </button>

      <button
        type="button"
        onClick={() => onPageChange && onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1628] text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#172337] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer text-xs"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
