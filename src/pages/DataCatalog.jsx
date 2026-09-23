import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, X, Filter } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/common/Button';
import SearchBar from '../components/common/SearchBar';
import Pagination from '../components/common/Pagination';
import CatalogFilters from '../components/catalog/CatalogFilters';
import DatasetTable from '../components/catalog/DatasetTable';
import AddDatasetModal from '../components/catalog/AddDatasetModal';
import FilterDrawer from '../components/catalog/FilterDrawer';
import { useApp } from '../context/AppContext';

export default function DataCatalog() {
  const { datasets, addDataset } = useApp();
  const [searchParams] = useSearchParams();

  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [selectedSources, setSelectedSources] = useState([]);
  const [selectedDomains, setSelectedDomains] = useState([]);
  const [selectedCertifications, setSelectedCertifications] = useState([]);
  const [selectedSensitivity, setSelectedSensitivity] = useState([]);
  const [selectedQualityTier, setSelectedQualityTier] = useState('All');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Filter datasets
  const filteredDatasets = useMemo(() => {
    return datasets.filter(dataset => {
      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchName = dataset.name.toLowerCase().includes(q);
        const matchDesc = dataset.description?.toLowerCase().includes(q);
        const matchDomain = dataset.domain.toLowerCase().includes(q);
        const matchOwner = dataset.owner.toLowerCase().includes(q);
        const matchTags = dataset.tags?.some(t => t.toLowerCase().includes(q));
        if (!matchName && !matchDesc && !matchDomain && !matchOwner && !matchTags) {
          return false;
        }
      }

      // Source filter
      if (selectedSources.length > 0 && !selectedSources.includes(dataset.source)) {
        return false;
      }

      // Domain filter
      if (selectedDomains.length > 0 && !selectedDomains.includes(dataset.domain)) {
        return false;
      }

      // Certification filter
      if (selectedCertifications.length > 0 && !selectedCertifications.some(cert => (cert === 'Certified' ? 'certified' : 'in_review') === dataset.certificationStatus)) {
        return false;
      }

      // Sensitivity filter
      if (selectedSensitivity.length > 0 && !selectedSensitivity.includes(dataset.sensitivity)) {
        return false;
      }

      // Quality filter
      if (selectedQualityTier === '90+' && dataset.quality < 90) return false;
      if (selectedQualityTier === '80+' && dataset.quality < 80) return false;

      return true;
    });
  }, [datasets, searchTerm, selectedSources, selectedDomains, selectedCertifications, selectedSensitivity, selectedQualityTier]);

  const handleResetFilters = () => {
    setSelectedSources([]);
    setSelectedDomains([]);
    setSelectedCertifications([]);
    setSelectedSensitivity([]);
    setSelectedQualityTier('All');
    setSearchTerm('');
  };

  const activeFilterCount =
    selectedSources.length +
    selectedDomains.length +
    selectedCertifications.length +
    selectedSensitivity.length +
    (selectedQualityTier !== 'All' ? 1 : 0);

  return (
    <div className="space-y-6 pb-8">
      {/* Page Header matching Screen 3 */}
      <PageHeader
        title="Data Catalog"
        subtitle="Discover, explore, and understand your organization's data."
        actions={
          <Button
            size="md"
            icon={Plus}
            onClick={() => setIsAddModalOpen(true)}
            className="w-full sm:w-auto"
          >
            Add Dataset
          </Button>
        }
      />

      {/* Top Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex-1">
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search datasets, tables, or keywords..."
          />
        </div>

        <button
          type="button"
          onClick={() => setIsFilterDrawerOpen(true)}
          className="flex lg:hidden items-center justify-center gap-2 px-3.5 py-2 rounded-md text-xs font-semibold cursor-pointer"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)'
          }}
        >
          <Filter className="w-3.5 h-3.5" style={{ color: 'var(--color-text-muted)' }} />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span 
              className="px-1.5 py-0.2 rounded text-[10px] font-bold tabular-nums"
              style={{
                backgroundColor: 'var(--color-surface-secondary)',
                color: 'var(--color-brand)'
              }}
            >
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Active Filter Chips Bar */}
      {(activeFilterCount > 0 || searchTerm.trim()) && (
        <div className="flex items-center flex-wrap gap-1.5 py-1 text-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">
            Active Filters:
          </span>

          {searchTerm.trim() && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50">
              <span>Query: &ldquo;{searchTerm}&rdquo;</span>
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="hover:text-blue-900 dark:hover:text-blue-100 cursor-pointer p-0.5 rounded focus-visible:outline-2 focus-visible:outline-blue-500"
                aria-label="Clear search query"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {selectedSources.map((source) => (
            <span
              key={source}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium"
              style={{
                backgroundColor: 'var(--color-surface-secondary)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)'
              }}
            >
              <span>Source: {source}</span>
              <button
                type="button"
                onClick={() => setSelectedSources(selectedSources.filter((s) => s !== source))}
                className="cursor-pointer p-0.5 rounded focus-visible:outline-2 focus-visible:outline-blue-500"
                style={{ color: 'var(--color-text-muted)' }}
                aria-label={`Remove ${source} filter`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {selectedDomains.map((domain) => (
            <span
              key={domain}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium"
              style={{
                backgroundColor: 'var(--color-surface-secondary)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)'
              }}
            >
              <span>Domain: {domain}</span>
              <button
                type="button"
                onClick={() => setSelectedDomains(selectedDomains.filter((d) => d !== domain))}
                className="cursor-pointer p-0.5 rounded focus-visible:outline-2 focus-visible:outline-blue-500"
                style={{ color: 'var(--color-text-muted)' }}
                aria-label={`Remove ${domain} filter`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {selectedCertifications.map((cert) => (
            <span
              key={cert}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium"
              style={{
                backgroundColor: 'var(--color-surface-secondary)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)'
              }}
            >
              <span>Status: {cert}</span>
              <button
                type="button"
                onClick={() => setSelectedCertifications(selectedCertifications.filter((c) => c !== cert))}
                className="cursor-pointer p-0.5 rounded focus-visible:outline-2 focus-visible:outline-blue-500"
                style={{ color: 'var(--color-text-muted)' }}
                aria-label={`Remove ${cert} filter`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {selectedSensitivity.map((sens) => (
            <span
              key={sens}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium"
              style={{
                backgroundColor: 'var(--color-surface-secondary)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)'
              }}
            >
              <span>Sensitivity: {sens}</span>
              <button
                type="button"
                onClick={() => setSelectedSensitivity(selectedSensitivity.filter((s) => s !== sens))}
                className="cursor-pointer p-0.5 rounded focus-visible:outline-2 focus-visible:outline-blue-500"
                style={{ color: 'var(--color-text-muted)' }}
                aria-label={`Remove ${sens} filter`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {selectedQualityTier !== 'All' && (
            <span 
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium"
              style={{
                backgroundColor: 'var(--color-surface-secondary)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)'
              }}
            >
              <span>Quality: {selectedQualityTier}</span>
              <button
                type="button"
                onClick={() => setSelectedQualityTier('All')}
                className="cursor-pointer p-0.5 rounded focus-visible:outline-2 focus-visible:outline-blue-500"
                style={{ color: 'var(--color-text-muted)' }}
                aria-label="Remove quality filter"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          <button
            type="button"
            onClick={handleResetFilters}
            className="text-xs hover:underline font-semibold px-2 py-0.5 cursor-pointer underline-offset-2 ml-1"
            style={{ color: 'var(--color-brand)' }}
          >
            Clear all
          </button>
        </div>
      )}

      {/* Main 2-Column Catalog Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left Filter Sidebar */}
        <div className="hidden lg:block lg:col-span-1">
          <CatalogFilters
            selectedSources={selectedSources}
            setSelectedSources={setSelectedSources}
            selectedDomains={selectedDomains}
            setSelectedDomains={setSelectedDomains}
            selectedCertifications={selectedCertifications}
            setSelectedCertifications={setSelectedCertifications}
            onReset={handleResetFilters}
          />
        </div>

        {/* Right Main Table & Pagination */}
        <div className="lg:col-span-3 space-y-4">
          <div 
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs px-1"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <span>
              Showing <strong className="tabular-nums" style={{ color: 'var(--color-text-primary)' }}>{filteredDatasets.length}</strong> of{' '}
              <strong className="tabular-nums" style={{ color: 'var(--color-text-primary)' }}>{datasets.length}</strong> enterprise datasets
            </span>
            <span style={{ color: 'var(--color-text-muted)' }} className="hidden sm:inline">Click any row for quick inspection</span>
            <span style={{ color: 'var(--color-text-muted)' }} className="sm:hidden">Tap any card for quick inspection</span>
          </div>

          <DatasetTable
            datasets={filteredDatasets}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            onResetFilters={handleResetFilters}
          />

          {/* Pagination */}
          <div className="pt-2">
            <Pagination
              currentPage={currentPage}
              totalPages={1}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>
      </div>

      {/* Advanced Filter Drawer */}
      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        selectedSources={selectedSources}
        setSelectedSources={setSelectedSources}
        selectedDomains={selectedDomains}
        setSelectedDomains={setSelectedDomains}
        selectedCertifications={selectedCertifications}
        setSelectedCertifications={setSelectedCertifications}
        selectedSensitivity={selectedSensitivity}
        setSelectedSensitivity={setSelectedSensitivity}
        onReset={handleResetFilters}
      />

      {/* Add Dataset Modal */}
      <AddDatasetModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={addDataset}
      />
    </div>
  );
}
