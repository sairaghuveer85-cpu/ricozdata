import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({
  currentPage = 1,
  totalPages = 208,
  onPageChange
}) {
  return (
    <nav aria-label="Pagination" className="flex items-center justify-center sm:justify-end gap-1 select-none flex-wrap">
      <button
        type="button"
        aria-label="Previous page"
        onClick={() => onPageChange && onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="w-8 h-8 flex items-center justify-center rounded-md border border-slate-200 dark:border-[#1D3047] bg-white dark:bg-[#0D1828] text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#111E30] disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none transition-colors cursor-pointer text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <ChevronLeft className="w-4 h-4" aria-hidden="true" />
      </button>

      {[1, 2, 3].map((num) => {
        const isActive = currentPage === num;
        return (
          <button
            key={num}
            type="button"
            aria-label={`Page ${num}`}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onPageChange && onPageChange(num)}
            className={`w-8 h-8 flex items-center justify-center rounded-md text-xs font-semibold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              isActive
                ? 'bg-blue-600 text-white shadow-xs'
                : 'border border-slate-200 dark:border-[#1D3047] bg-white dark:bg-[#0D1828] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#111E30]'
            }`}
          >
            {num}
          </button>
        );
      })}

      <span className="w-8 h-8 flex items-center justify-center text-xs text-slate-400" aria-hidden="true">
        ...
      </span>

      <button
        type="button"
        aria-label={`Page ${totalPages}`}
        aria-current={currentPage === totalPages ? 'page' : undefined}
        onClick={() => onPageChange && onPageChange(totalPages)}
        className={`w-8 h-8 flex items-center justify-center rounded-md text-xs font-semibold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
          currentPage === totalPages
            ? 'bg-blue-600 text-white shadow-xs'
            : 'border border-slate-200 dark:border-[#1D3047] bg-white dark:bg-[#0D1828] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#111E30]'
        }`}
      >
        {totalPages}
      </button>

      <button
        type="button"
        aria-label="Next page"
        onClick={() => onPageChange && onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        className="w-8 h-8 flex items-center justify-center rounded-md border border-slate-200 dark:border-[#1D3047] bg-white dark:bg-[#0D1828] text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#111E30] disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none transition-colors cursor-pointer text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <ChevronRight className="w-4 h-4" aria-hidden="true" />
      </button>
    </nav>
  );
}
