import React, { useState } from 'react';
import { 
  ChevronRight, 
  Edit3, 
  Database, 
  FolderKanban, 
  ArrowUpRight 
} from 'lucide-react';
import GlossaryDrawer from './GlossaryDrawer';
import SortableHeader from '../common/SortableHeader';

// Restrained semantic status indicator configuration
const STATUS_CONFIG = {
  approved: {
    label: 'Approved',
    dotColor: 'bg-emerald-500',
    textColor: 'text-emerald-700 dark:text-emerald-400',
    badgeClass: 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200/60 dark:border-emerald-900/40',
  },
  active: {
    label: 'Approved',
    dotColor: 'bg-emerald-500',
    textColor: 'text-emerald-700 dark:text-emerald-400',
    badgeClass: 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200/60 dark:border-emerald-900/40',
  },
  draft: {
    label: 'Draft',
    dotColor: 'bg-amber-500',
    textColor: 'text-amber-700 dark:text-amber-400',
    badgeClass: 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200/60 dark:border-amber-900/40',
  },
  deprecated: {
    label: 'Deprecated',
    dotColor: 'bg-rose-500',
    textColor: 'text-rose-700 dark:text-rose-400',
    badgeClass: 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200/60 dark:border-rose-900/40',
  },
  archived: {
    label: 'Archived',
    dotColor: 'bg-slate-400',
    textColor: 'text-slate-600 dark:text-slate-400',
    badgeClass: 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
  },
};

function formatCompactDate(dateString) {
  if (!dateString) return 'Recently';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Recently';
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getInitials(name) {
  if (!name) return 'GT';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
}

export default function GlossaryTable({
  terms = [],
  loading = false,
  sortBy = 'term',
  sortOrder = 'asc',
  onSort,
  onEdit,
  onTermMutated,
}) {
  const [selectedTerm, setSelectedTerm] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleRowClick = (term) => {
    setSelectedTerm(term);
    setIsDrawerOpen(true);
  };

  // 1. SKELETON LOADING STATE (Preserves stable table layout)
  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" aria-label="Loading Business Glossary Terms">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-[#0B1524] border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4 w-1/4">Term</th>
                <th className="py-3 px-4 w-1/3">Definition</th>
                <th className="py-3 px-4">Domain</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Owner</th>
                <th className="py-3 px-4 text-center">Data</th>
                <th className="py-3 px-4">Updated</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className="animate-pulse">
                  <td className="py-3.5 px-4">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-32 mb-1.5" />
                    <div className="h-3 bg-slate-100 dark:bg-slate-800/60 rounded w-20" />
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded w-full mb-1" />
                    <div className="h-3.5 bg-slate-100 dark:bg-slate-800/60 rounded w-3/4" />
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16" />
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-20" />
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-24" />
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-12 mx-auto" />
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-14" />
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-10 ml-auto" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* 2. MOBILE CARD VIEW (< md) */}
      <div className="md:hidden space-y-3">
        {terms.map((term) => {
          const tId = term.id || term._id;
          const statusKey = term.status?.toLowerCase() || 'draft';
          const cfg = STATUS_CONFIG[statusKey] || STATUS_CONFIG.draft;
          const datasetCount = term.relatedDatasetIds?.length || 0;
          const columnCount = term.relatedColumnRefs?.length || term.relatedColumns?.length || 0;
          const ownerName = term.ownerId?.name || term.owner || 'Governance Team';

          return (
            <div
              key={tId}
              tabIndex={0}
              role="button"
              aria-label={`Inspect term ${term.term}`}
              onClick={() => handleRowClick(term)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleRowClick(term);
                }
              }}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] space-y-2.5 cursor-pointer hover:border-blue-400 dark:hover:border-blue-700 transition-all shadow-2xs focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {/* Header: Term, Status, and Domain */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {term.term}
                  </h4>
                  {term.synonyms && term.synonyms.length > 0 && (
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                      {term.synonyms.slice(0, 2).join(' · ')}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium border ${cfg.badgeClass} ${cfg.textColor}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotColor}`} />
                    {cfg.label}
                  </span>
                  <span className="text-[11px] text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md font-medium">
                    {term.domainId?.name || term.domain || 'Enterprise'}
                  </span>
                </div>
              </div>

              {/* High-Readability Definition */}
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
                {term.definition}
              </p>

              {/* Metadata Row: Owner & Related Data */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-2 truncate">
                  <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-bold flex items-center justify-center shrink-0">
                    {getInitials(ownerName)}
                  </span>
                  <span className="truncate">{ownerName}</span>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {datasetCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-700 dark:text-slate-300 font-medium">
                      <Database className="w-3 h-3 text-blue-500" />
                      <span>{datasetCount} {datasetCount === 1 ? 'dataset' : 'datasets'}</span>
                    </span>
                  )}
                  <span className="inline-flex items-center text-blue-600 dark:text-blue-400 font-medium text-xs">
                    <span>Details</span>
                    <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. DESKTOP ENTERPRISE TABLE (>= md) */}
      <div className="hidden md:block rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" aria-label="Business Glossary Terms">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-[#0B1524] border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4 w-1/4">
                  {onSort ? (
                    <SortableHeader
                      label="Term"
                      sortKey="term"
                      currentSortKey={sortBy}
                      currentDirection={sortOrder}
                      onSort={onSort}
                    />
                  ) : (
                    'Term'
                  )}
                </th>
                <th className="py-3 px-4 w-2/5">Definition</th>
                <th className="py-3 px-4">
                  {onSort ? (
                    <SortableHeader
                      label="Domain"
                      sortKey="domain"
                      currentSortKey={sortBy}
                      currentDirection={sortOrder}
                      onSort={onSort}
                    />
                  ) : (
                    'Domain'
                  )}
                </th>
                <th className="py-3 px-4">
                  {onSort ? (
                    <SortableHeader
                      label="Status"
                      sortKey="status"
                      currentSortKey={sortBy}
                      currentDirection={sortOrder}
                      onSort={onSort}
                    />
                  ) : (
                    'Status'
                  )}
                </th>
                <th className="py-3 px-4">Owner</th>
                <th className="py-3 px-4 text-center">Data</th>
                <th className="py-3 px-4 whitespace-nowrap">
                  {onSort ? (
                    <SortableHeader
                      label="Updated"
                      sortKey="updatedAt"
                      currentSortKey={sortBy}
                      currentDirection={sortOrder}
                      onSort={onSort}
                    />
                  ) : (
                    'Updated'
                  )}
                </th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
              {terms.map((term) => {
                const tId = term.id || term._id;
                const statusKey = term.status?.toLowerCase() || 'draft';
                const cfg = STATUS_CONFIG[statusKey] || STATUS_CONFIG.draft;
                const datasetCount = term.relatedDatasetIds?.length || 0;
                const columnCount = term.relatedColumnRefs?.length || term.relatedColumns?.length || 0;
                const ownerName = term.ownerId?.name || term.owner || 'Governance Team';

                return (
                  <tr
                    key={tId}
                    tabIndex={0}
                    role="button"
                    aria-label={`Inspect term ${term.term}`}
                    onClick={() => handleRowClick(term)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleRowClick(term);
                      }
                    }}
                    className="hover:bg-slate-50/70 dark:hover:bg-[#152338]/40 transition-colors cursor-pointer group focus:outline-none focus-visible:bg-slate-50 dark:focus-visible:bg-[#152338]"
                  >
                    {/* TERM CELL */}
                    <td className="py-3.5 px-4 align-top">
                      <div className="font-semibold text-slate-900 dark:text-white text-xs sm:text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {term.term}
                      </div>
                      {term.synonyms && term.synonyms.length > 0 && (
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate max-w-xs">
                          {term.synonyms.slice(0, 3).join(' · ')}
                        </div>
                      )}
                    </td>

                    {/* DEFINITION CELL (High readability, 2–3 lines visible) */}
                    <td className="py-3.5 px-4 align-top text-slate-600 dark:text-slate-300 leading-relaxed">
                      <p className="line-clamp-2 lg:line-clamp-3">
                        {term.definition}
                      </p>
                    </td>

                    {/* DOMAIN CELL (Subtle, non-pill text with muted icon) */}
                    <td className="py-3.5 px-4 align-top whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                        <FolderKanban className="w-3.5 h-3.5 text-slate-400" />
                        <span>{term.domainId?.name || term.domain || 'Enterprise'}</span>
                      </span>
                    </td>

                    {/* STATUS CELL (Restrained semantic indicator) */}
                    <td className="py-3.5 px-4 align-top whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full font-medium border ${cfg.badgeClass} ${cfg.textColor}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotColor}`} />
                        <span>{cfg.label}</span>
                      </span>
                    </td>

                    {/* OWNER CELL (Avatar initials + Name) */}
                    <td className="py-3.5 px-4 align-top whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-bold flex items-center justify-center shrink-0">
                          {getInitials(ownerName)}
                        </div>
                        <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[130px]">
                          {ownerName}
                        </span>
                      </div>
                    </td>

                    {/* DATA RELATIONSHIPS CELL (◫ 3 datasets) */}
                    <td className="py-3.5 px-4 align-top text-center whitespace-nowrap">
                      {datasetCount > 0 ? (
                        <span 
                          title={`${datasetCount} datasets${columnCount > 0 ? ` · ${columnCount} columns` : ''} connected`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 text-[11px] font-medium"
                        >
                          <Database className="w-3 h-3 text-blue-500" />
                          <span>
                            {datasetCount} {datasetCount === 1 ? 'dataset' : 'datasets'}
                            {columnCount > 0 ? ` · ${columnCount} ${columnCount === 1 ? 'col' : 'cols'}` : ''}
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>

                    {/* COMPACT UPDATED DATE */}
                    <td className="py-3.5 px-4 align-top text-slate-500 dark:text-slate-400 whitespace-nowrap text-[11px]" title={term.updatedAt ? new Date(term.updatedAt).toLocaleString() : ''}>
                      {formatCompactDate(term.updatedAt)}
                    </td>

                    {/* ACTION ROW (View details + subtle Edit) */}
                    <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {onEdit && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit(term);
                            }}
                            title="Edit term"
                            className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <span className="inline-flex items-center text-xs font-medium text-blue-600 dark:text-blue-400 group-hover:translate-x-0.5 transition-transform">
                          <span>Details</span>
                          <ChevronRight className="w-3.5 h-3.5 ml-0.5" aria-hidden="true" />
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. DETAILS DRAWER */}
      <GlossaryDrawer
        term={selectedTerm}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onEdit={onEdit}
        onTermMutated={onTermMutated}
      />
    </>
  );
}
