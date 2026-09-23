import React from 'react';
import { Filter, RotateCcw } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function CatalogFilters({
  selectedSources,
  setSelectedSources,
  selectedDomains,
  setSelectedDomains,
  selectedCertifications,
  setSelectedCertifications,
  onReset
}) {
  const { datasets } = useApp();

  const sources = [...new Set(datasets.map(d => d.source))].map(label => ({ label, count: datasets.filter(d => d.source === label).length }));
  const domains = [...new Set(datasets.map(d => d.domain))].map(label => ({ label, count: datasets.filter(d => d.domain === label).length }));

  const certifications = [
    { label: 'Certified', count: datasets.filter(d => d.certificationStatus === 'certified').length },
    { label: 'In Review', count: datasets.filter(d => d.certificationStatus === 'in_review').length }
  ];

  const toggleFilter = (list, setList, item) => {
    if (list.includes(item)) {
      setList(list.filter(i => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  const hasActiveFilters = selectedSources.length > 0 || selectedDomains.length > 0 || selectedCertifications.length > 0;

  return (
    <div 
      className="rounded-lg p-4 space-y-5"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)'
      }}
    >
      <div 
        className="flex items-center justify-between pb-2.5 border-b"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div 
          className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider"
          style={{ color: 'var(--color-text-primary)' }}
        >
          <Filter className="w-3.5 h-3.5" style={{ color: 'var(--color-text-muted)' }} aria-hidden="true" />
          <span>Facets</span>
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 text-[11px] font-medium cursor-pointer hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded"
            style={{ color: 'var(--color-brand)' }}
          >
            <RotateCcw className="w-3 h-3" aria-hidden="true" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Data Source Filter */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2 select-none">
          Data Warehouse
        </div>
        <div className="space-y-1.5">
          {sources.map(src => {
            const isChecked = selectedSources.includes(src.label);
            return (
              <label
                key={src.label}
                className={`flex items-center justify-between px-2 py-1 rounded text-xs transition-colors cursor-pointer group ${
                  isChecked
                    ? 'bg-blue-50/70 dark:bg-blue-950/30 text-blue-900 dark:text-blue-300 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#111E30] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleFilter(selectedSources, setSelectedSources, src.label)}
                    className="w-3.5 h-3.5 rounded-sm text-blue-600 border-slate-300 dark:border-slate-700 focus:ring-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
                  />
                  <span>{src.label}</span>
                </div>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">({src.count})</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Domain Filter */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2 select-none">
          Business Domain
        </div>
        <div className="space-y-1.5">
          {domains.map(dom => {
            const isChecked = selectedDomains.includes(dom.label);
            return (
              <label
                key={dom.label}
                className={`flex items-center justify-between px-2 py-1 rounded text-xs transition-colors cursor-pointer group ${
                  isChecked
                    ? 'bg-blue-50/70 dark:bg-blue-950/30 text-blue-900 dark:text-blue-300 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#111E30] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleFilter(selectedDomains, setSelectedDomains, dom.label)}
                    className="w-3.5 h-3.5 rounded-sm text-blue-600 border-slate-300 dark:border-slate-700 focus:ring-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
                  />
                  <span>{dom.label}</span>
                </div>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">({dom.count})</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Certification Filter */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2 select-none">
          Governance Status
        </div>
        <div className="space-y-1.5">
          {certifications.map(cert => {
            const isChecked = selectedCertifications.includes(cert.label);
            return (
              <label
                key={cert.label}
                className={`flex items-center justify-between px-2 py-1 rounded text-xs transition-colors cursor-pointer group ${
                  isChecked
                    ? 'bg-blue-50/70 dark:bg-blue-950/30 text-blue-900 dark:text-blue-300 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#111E30] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleFilter(selectedCertifications, setSelectedCertifications, cert.label)}
                    className="w-3.5 h-3.5 rounded-sm text-blue-600 border-slate-300 dark:border-slate-700 focus:ring-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
                  />
                  <span>{cert.label}</span>
                </div>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">({cert.count})</span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
