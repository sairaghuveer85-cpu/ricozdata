import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({
  currentPage = 1,
  totalPages = 1,
  onPageChange,
}) {
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    if (totalPages <= 6) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages = [1];
    let start = Math.max(2, currentPage - 1);
    let end = Math.min(totalPages - 1, currentPage + 1);

    if (start > 2) pages.push('ellipsis-start');
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    if (end < totalPages - 1) pages.push('ellipsis-end');
    pages.push(totalPages);
    return pages;
  };

  const pages = getPageNumbers();

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center sm:justify-end gap-1 select-none flex-wrap">
      <button
        type="button"
        aria-label="Previous page"
        onClick={() => onPageChange && onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="ui-pagination-control w-8 h-8 flex items-center justify-center rounded-md text-xs"
      >
        <ChevronLeft className="w-4 h-4" aria-hidden="true" />
      </button>

      {pages.map((item, idx) => {
        if (typeof item === 'string') {
          return (
            <span
              key={`ellipsis-${idx}`}
              className="ui-pagination-ellipsis w-8 h-8 flex items-center justify-center text-xs"
              aria-hidden="true"
            >
              ...
            </span>
          );
        }

        const isActive = currentPage === item;
        return (
          <button
            key={item}
            type="button"
            aria-label={`Page ${item}`}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onPageChange && onPageChange(item)}
            className={`ui-pagination-control w-8 h-8 flex items-center justify-center rounded-md text-xs font-semibold ${isActive ? 'ui-pagination-control--active' : ''}`}
          >
            {item}
          </button>
        );
      })}

      <button
        type="button"
        aria-label="Next page"
        onClick={() => onPageChange && onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        className="ui-pagination-control w-8 h-8 flex items-center justify-center rounded-md text-xs"
      >
        <ChevronRight className="w-4 h-4" aria-hidden="true" />
      </button>
    </nav>
  );
}
