import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, SlidersHorizontal, X, Filter, Sparkles } from 'lucide-react';
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
  const [selectedSources, setSelectedSources] = useState(['Snowflake']);
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
      if (selectedCertifications.length > 0 && !selectedCertifications.includes(dataset.status)) {
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

      {/* Top Search & Filter Bar matching Screen 3 */}
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
          className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-md bg-white dark:bg-[#0B1628] border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-2xs hover:bg-slate-50 dark:hover:bg-[#111C2E] cursor-pointer"
        >
          <Filter className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="px-1.5 py-0.2 rounded text-[10px] bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-slate-500 dark:text-slate-400 px-1">
            <span>
              Showing <strong className="text-slate-900 dark:text-white">{filteredDatasets.length}</strong> of{' '}
              <strong className="text-slate-900 dark:text-white">1,248</strong> enterprise datasets
            </span>
            <span className="text-slate-400 hidden sm:inline">Click any row for quick inspection</span>
            <span className="text-slate-400 sm:hidden">Tap any card for quick inspection</span>
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
              totalPages={208}
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
