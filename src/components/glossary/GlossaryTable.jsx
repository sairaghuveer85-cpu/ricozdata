import React, { useState } from 'react';
import { BookOpen, ChevronRight } from 'lucide-react';
import EmptyState from '../common/EmptyState';
import GlossaryDrawer from './GlossaryDrawer';

export default function GlossaryTable({ terms = [], onReset }) {
  const [selectedTerm, setSelectedTerm] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleRowClick = (term) => {
    setSelectedTerm(term);
    setIsDrawerOpen(true);
  };

  if (terms.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="No glossary terms found"
        description="Try adjusting your keyword search or domain filter criteria."
        actionLabel="Clear search"
        onAction={onReset}
      />
    );
  }

  return (
    <>
      {/* Mobile Term Cards (< md) */}
      <div className="md:hidden space-y-3">
        {terms.map((term) => (
          <div
            key={term.id}
            onClick={() => handleRowClick(term)}
            className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1628] shadow-2xs space-y-2.5 cursor-pointer hover:border-blue-500/40 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
                  {term.term}
                </h4>
                {term.synonyms && term.synonyms.length > 0 && (
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 block mt-0.5">
                    aka: {term.synonyms.join(', ')}
                  </span>
                )}
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50 shrink-0">
                {term.domain}
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {term.definition}
            </p>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="truncate">Owner: <strong className="text-slate-700 dark:text-slate-300">{term.owner}</strong></span>
              <span className="inline-flex items-center text-blue-600 dark:text-blue-400 font-medium shrink-0 ml-2">
                <span>Inspect</span>
                <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table (>= md) */}
      <div className="hidden md:block theme-card rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-2.5 px-4 w-1/4">Term</th>
                <th className="py-2.5 px-4 w-2/5">Definition</th>
                <th className="py-2.5 px-4">Domain</th>
                <th className="py-2.5 px-4">Owner</th>
                <th className="py-2.5 px-4">Updated</th>
                <th className="py-2.5 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {terms.map((term) => (
                <tr
                  key={term.id}
                  onClick={() => handleRowClick(term)}
                  className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                >
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900 dark:text-white text-xs sm:text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {term.term}
                    </div>
                    {term.synonyms && term.synonyms.length > 0 && (
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                        aka: {term.synonyms.join(', ')}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-300 leading-relaxed">
                    {term.definition}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50">
                      {term.domain}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {term.owner}
                  </td>
                  <td className="py-3 px-4 text-slate-400 dark:text-slate-500 whitespace-nowrap">
                    {term.updated || 'Recently'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="inline-flex items-center text-xs font-medium text-blue-600 dark:text-blue-400 group-hover:underline">
                      <span>Inspect</span>
                      <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drawer */}
      <GlossaryDrawer
        term={selectedTerm}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </>
  );
}
