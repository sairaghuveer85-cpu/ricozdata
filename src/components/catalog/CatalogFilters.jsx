import React from 'react';
import { Filter, RotateCcw } from 'lucide-react';

export default function CatalogFilters({
  selectedSources = [],
  setSelectedSources = () => {},
  selectedDomains = [],
  setSelectedDomains = () => {},
  selectedCertifications = [],
  setSelectedCertifications = () => {},
  selectedSensitivity = [],
  setSelectedSensitivity = () => {},
  selectedTags = [],
  setSelectedTags = () => {},
  selectedQualityTier = 'All',
  setSelectedQualityTier = () => {},
  myFavorites = false,
  setMyFavorites = () => {},
  sources = [],
  tagsList = [],
  domains = [],
  onReset = () => {}
}) {
  const certifications = [
    { label: 'Certified', count: 0 },
    { label: 'In Review', count: 0 },
    { label: 'Not Certified', count: 0 },
    { label: 'Deprecated', count: 0 }
  ];

  const sensitivityLevels = [
    { label: 'Public', count: 0 },
    { label: 'Internal', count: 0 },
    { label: 'Confidential', count: 0 },
    { label: 'Restricted', count: 0 }
  ];

  const qualityTiers = [
    { label: 'All', value: 'All' },
    { label: 'Excellent (90%+)', value: '90+' },
    { label: 'Good (80%+)', value: '80+' },
    { label: 'At Risk (<80%)', value: 'At Risk' }
  ];

  const toggleFilter = (list = [], setList = () => {}, item) => {
    const safeList = Array.isArray(list) ? list : [];
    if (safeList.includes(item)) {
      setList(safeList.filter(i => i !== item));
    } else {
      setList([...safeList, item]);
    }
  };

  const hasActiveFilters =
    (selectedSources?.length || 0) > 0 ||
    (selectedDomains?.length || 0) > 0 ||
    (selectedCertifications?.length || 0) > 0 ||
    (selectedSensitivity?.length || 0) > 0 ||
    (selectedTags?.length || 0) > 0 ||
    (selectedQualityTier && selectedQualityTier !== 'All') ||
    Boolean(myFavorites);

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
          {Array.isArray(sources) && sources.length > 0 ? (
            sources.map(src => {
              const isChecked = Array.isArray(selectedSources) && selectedSources.includes(src.label);
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
            })
          ) : (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 py-0.5 italic">No sources configured</p>
          )}
        </div>
      </div>

      {/* Domain Filter */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2 select-none">
          Business Domain
        </div>
        <div className="space-y-1.5">
          {Array.isArray(domains) && domains.length > 0 ? (
            domains.map(dom => {
              const isChecked = Array.isArray(selectedDomains) && selectedDomains.includes(dom.label);
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
            })
          ) : (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 py-0.5 italic">No domains configured</p>
          )}
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

      {/* Sensitivity Filter */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2 select-none">
          Sensitivity Level
        </div>
        <div className="space-y-1.5">
          {sensitivityLevels.map(sens => {
            const isChecked = selectedSensitivity.includes(sens.label);
            return (
              <label
                key={sens.label}
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
                    onChange={() => toggleFilter(selectedSensitivity, setSelectedSensitivity, sens.label)}
                    className="w-3.5 h-3.5 rounded-sm text-blue-600 border-slate-300 dark:border-slate-700 focus:ring-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
                  />
                  <span>{sens.label}</span>
                </div>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">({sens.count})</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Tags Filter */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2 select-none">
          Tags
        </div>
        <div className="space-y-1.5">
          {tagsList.length > 0 ? (
            tagsList.map(tag => {
              const isChecked = selectedTags.includes(tag);
              return (
                <label
                  key={tag}
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
                      onChange={() => toggleFilter(selectedTags, setSelectedTags, tag)}
                      className="w-3.5 h-3.5 rounded-sm text-blue-600 border-slate-300 dark:border-slate-700 focus:ring-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
                    />
                    <span>{tag}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">({sources.filter(s => s.tags?.includes(tag)).length})</span>
                </label>
              );
            })
          ) : (
            <div className="text-[10px] text-slate-400 italic">No tags found</div>
          )}
        </div>
      </div>

      {/* Quality Filter */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2 select-none">
          Quality Tier
        </div>
        <div className="space-y-1.5">
          {qualityTiers.map(tier => {
            const isSelected = selectedQualityTier === tier.value;
            return (
              <label
                key={tier.value}
                className={`flex items-center justify-between px-2 py-1 rounded text-xs transition-colors cursor-pointer group ${
                  isSelected
                    ? 'bg-blue-50/70 dark:bg-blue-950/30 text-blue-900 dark:text-blue-300 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#111E30] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={isSelected}
                    onChange={() => setSelectedQualityTier(tier.value)}
                    className="w-3.5 h-3.5 rounded-sm text-blue-600 border-slate-300 dark:border-slate-700 focus:ring-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
                  />
                  <span>{tier.label}</span>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* My Favorites Filter */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2 select-none">
          My Favorites
        </div>
        <div className="space-y-1.5">
          <label
            className={`flex items-center justify-between px-2 py-1 rounded text-xs transition-colors cursor-pointer group ${
              myFavorites
                ? 'bg-blue-50/70 dark:bg-blue-950/30 text-blue-900 dark:text-blue-300 font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={myFavorites}
                onChange={() => setMyFavorites(!myFavorites)}
                className="w-3.5 h-3.5 rounded-sm text-blue-600 border-slate-300 dark:border-slate-700 focus:ring-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
              />
              <span>Show only my favorite datasets</span>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}