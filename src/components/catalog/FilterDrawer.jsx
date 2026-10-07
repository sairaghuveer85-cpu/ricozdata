import React from 'react';
import Drawer from '../common/Drawer';
import Button from '../common/Button';
import { DOMAINS, DATA_SOURCES, SENSITIVITY_LEVELS, QUALITY_TIERS } from '../../utils/constants';

export default function FilterDrawer({
  isOpen = false,
  onClose = () => {},
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
  tagsList = [],
  sources = [],
  onReset = () => {}
}) {
  const toggle = (list = [], setter = () => {}, val) => {
    const safeList = Array.isArray(list) ? list : [];
    if (safeList.includes(val)) {
      setter(safeList.filter(item => item !== val));
    } else {
      setter([...safeList, val]);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Advanced Catalog Filters"
      subtitle="Refine datasets across domains, warehouses, sensitivity, and certifications"
      footer={
        <div className="flex flex-col-reverse sm:flex-row gap-2 w-full sm:justify-end">
          <Button variant="secondary" size="sm" onClick={onReset} className="w-full sm:w-auto">
            Reset All
          </Button>
          <Button size="sm" onClick={onClose} className="w-full sm:w-auto">
            Apply Filters
          </Button>
        </div>
      }
    >
      <div className="space-y-6 text-xs">
        {/* Domain Filter */}
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-2.5">
            Business Domain
          </h4>
          <div className="space-y-2">
            {DOMAINS.filter(d => d !== 'All Domains').map(dom => (
              <label key={dom} className="flex items-center gap-2.5 cursor-pointer text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
                <input
                  type="checkbox"
                  checked={selectedDomains.includes(dom)}
                  onChange={() => toggle(selectedDomains, setSelectedDomains, dom)}
                  className="w-4 h-4 rounded text-blue-600 border-slate-300 dark:border-slate-700 focus:ring-blue-500/20"
                />
                <span>{dom}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Data Source Filter */}
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-2.5">
            Data Source / Platform
          </h4>
          <div className="space-y-2">
            {DATA_SOURCES.map(src => (
              <label key={src} className="flex items-center gap-2.5 cursor-pointer text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
                <input
                  type="checkbox"
                  checked={selectedSources.includes(src)}
                  onChange={() => toggle(selectedSources, setSelectedSources, src)}
                  className="w-4 h-4 rounded text-blue-600 border-slate-300 dark:border-slate-700 focus:ring-blue-500/20"
                />
                <span>{src}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Certification Status */}
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-2.5">
            Certification Status
          </h4>
          <div className="space-y-2">
            {['Certified', 'In Review', 'Not Certified'].map(cert => (
              <label key={cert} className="flex items-center gap-2.5 cursor-pointer text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
                <input
                  type="checkbox"
                  checked={selectedCertifications.includes(cert)}
                  onChange={() => toggle(selectedCertifications, setSelectedCertifications, cert)}
                  className="w-4 h-4 rounded text-blue-600 border-slate-300 dark:border-slate-700 focus:ring-blue-500/20"
                />
                <span>{cert}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Data Sensitivity */}
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-2.5">
            Sensitivity Level
          </h4>
          <div className="space-y-2">
            {SENSITIVITY_LEVELS.map(sens => (
              <label key={sens} className="flex items-center gap-2.5 cursor-pointer text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
                <input
                  type="checkbox"
                  checked={selectedSensitivity?.includes(sens)}
                  onChange={() => toggle(selectedSensitivity, setSelectedSensitivity, sens)}
                  className="w-4 h-4 rounded text-blue-600 border-slate-300 dark:border-slate-700 focus:ring-blue-500/20"
                />
                <span>{sens}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-2.5">
            Tags
          </h4>
          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
            {tagsList.length > 0 ? (
              tagsList.map(tag => (
                <label key={tag} className="flex items-center gap-2.5 cursor-pointer text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
                  <input
                    type="checkbox"
                    checked={selectedTags.includes(tag)}
                    onChange={() => toggle(selectedTags, setSelectedTags, tag)}
                    className="w-4 h-4 rounded text-blue-600 border-slate-300 dark:border-slate-700 focus:ring-blue-500/20"
                  />
                  <span>{tag}</span>
                </label>
              ))
            ) : (
              <div className="text-[10px] text-slate-400 italic">No tags found</div>
            )}
          </div>
        </div>

        {/* Quality Tier */}
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-2.5">
            Quality Tier
          </h4>
          <div className="space-y-2">
            {QUALITY_TIERS.map(tier => (
              <label key={tier.value} className="flex items-center gap-2.5 cursor-pointer text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
                <input
                  type="radio"
                  name="qualityTier"
                  checked={selectedQualityTier === tier.value}
                  onChange={() => setSelectedQualityTier(tier.value)}
                  className="w-4 h-4 rounded text-blue-600 border-slate-300 dark:border-slate-700 focus:ring-blue-500/20"
                />
                <span>{tier.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* My Favorites */}
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-2.5">
            My Favorites
          </h4>
          <div className="space-y-2">
            <label className="flex items-center gap-2.5 cursor-pointer text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
              <input
                type="checkbox"
                checked={myFavorites}
                onChange={() => setMyFavorites(!myFavorites)}
                className="w-4 h-4 rounded text-blue-600 border-slate-300 dark:border-slate-700 focus:ring-blue-500/20"
              />
              <span>Show only my favorite datasets</span>
            </label>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
