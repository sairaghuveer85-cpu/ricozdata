import React from 'react';
import Drawer from '../common/Drawer';
import Button from '../common/Button';
import Badge from '../common/Badge';
import { BookOpen, Trash2, Database, User, Tag } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function GlossaryDrawer({ term, isOpen, onClose }) {
  const { deleteGlossaryTerm, datasets } = useApp();

  if (!term) return null;

  const handleDelete = () => {
    if (window.confirm(`Delete "${term.term}" from the business glossary?`)) {
      deleteGlossaryTerm(term.id);
      onClose();
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={term.term}
      subtitle={`Domain: ${term.domain}`}
      footer={
        <>
          <Button
            variant="danger"
            size="sm"
            icon={Trash2}
            onClick={handleDelete}
          >
            Delete Term
          </Button>
          <Button size="sm" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      <div className="space-y-6 text-xs text-slate-600 dark:text-slate-300">
        {/* Definition */}
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-1.5">
            Official Business Definition
          </h4>
          <p className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 leading-relaxed text-slate-800 dark:text-slate-200 text-sm">
            {term.definition}
          </p>
        </div>

        {/* Ownership & Usage */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1 text-[11px]">
              <User className="w-3.5 h-3.5" />
              <span>Business Owner</span>
            </div>
            <div className="font-bold text-slate-900 dark:text-white">{term.owner}</div>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1 text-[11px]">
              <Tag className="w-3.5 h-3.5" />
              <span>Catalog Usage</span>
            </div>
            <div className="font-bold text-slate-900 dark:text-white">{term.usageCount || 24} References</div>
          </div>
        </div>

        {/* Synonyms */}
        {term.synonyms && term.synonyms.length > 0 && (
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-2">
              Recognized Synonyms & Abbreviations
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {term.synonyms.map(syn => (
                <span
                  key={syn}
                  className="px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900/50"
                >
                  {syn}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Linked Datasets */}
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-2">
            Related Certified Datasets
          </h4>
          <div className="space-y-2">
            {(term.relatedDatasets || (term.relatedDatasetIds ? term.relatedDatasetIds.map(id => datasets.find(d => d.id === id)?.name || id) : ['Customer Database'])).map(ds => {
              const matched = datasets.find(d => d.name === ds || d.id === ds);
              return (
                <div key={ds} className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                  <div className="flex items-center gap-2 min-w-0">
                    <Database className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{matched?.name || ds}</span>
                  </div>
                  {matched && (
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                      {matched.quality}% Quality
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Drawer>
  );
}
