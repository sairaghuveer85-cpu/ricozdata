import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, X, Filter, AlertTriangle } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/common/Button';
import SearchBar from '../components/common/SearchBar';
import Pagination from '../components/common/Pagination';
import CatalogFilters from '../components/catalog/CatalogFilters';
import DatasetTable from '../components/catalog/DatasetTable';
import AddDatasetModal from '../components/catalog/AddDatasetModal';
import FilterDrawer from '../components/catalog/FilterDrawer';
import PermissionGate from '../components/auth/PermissionGate';
import { PERMISSIONS } from '../constants/rbac';
import { useApp } from '../context/AppContext';
import datasetApi from '../services/datasetApi';

export default function DataCatalog() {
  const { addDataset, currentUser, domains } = useApp();
  const [searchParams] = useSearchParams();

  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [selectedSources, setSelectedSources] = useState([]);
  const [selectedDomains, setSelectedDomains] = useState([]);
  const [selectedCertifications, setSelectedCertifications] = useState([]);
  const [selectedSensitivity, setSelectedSensitivity] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedQualityTier, setSelectedQualityTier] = useState('All');
  const [myFavorites, setMyFavorites] = useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageLimit, setPageLimit] = useState(20);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [datasets, setDatasets] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState([]);
  const [tagsList, setTagsList] = useState([]);
  const [fetchError, setFetchError] = useState(null);

  // Fetch dynamic filter options
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const [sourcesRes, tagsRes] = await Promise.allSettled([
          datasetApi.getSources(),
          datasetApi.getTags()
        ]);
        if (sourcesRes.status === 'fulfilled') {
          const srcData = sourcesRes.value?.data?.data || sourcesRes.value?.data || [];
          setSources(Array.isArray(srcData) ? srcData : []);
        }
        if (tagsRes.status === 'fulfilled') {
          const tagData = tagsRes.value?.data?.data || tagsRes.value?.data || [];
          setTagsList(Array.isArray(tagData) ? tagData : []);
        }
      } catch (error) {
        console.error('Failed to fetch filter options:', error);
      }
    };

    fetchFilterOptions();
  }, []);

  // Fetch datasets based on filters
  useEffect(() => {
    const fetchDatasets = async () => {
      setLoading(true);
      setFetchError(null);
      try {
        const params = {
          search: searchTerm || undefined,
          domain: selectedDomains.length > 0 ? selectedDomains : undefined,
          sourceSystem: selectedSources.length > 0 ? selectedSources : undefined,
          sensitivity: selectedSensitivity.length > 0 ? selectedSensitivity : undefined,
          certificationStatus: selectedCertifications.length > 0 ? selectedCertifications : undefined,
          tags: selectedTags.length > 0 ? selectedTags : undefined,
          myFavorites: myFavorites ? (currentUser._id || currentUser.id) : undefined,
          page: currentPage,
          limit: pageLimit
        };

        // Remove undefined values
        Object.keys(params).forEach(
          (key) => params[key] === undefined && delete params[key]
        );

        const res = await datasetApi.getDatasets(params);
        // Backend returns { success, data: { datasets: [...], total } }
        // Handle both response shapes for compatibility
        const resData = res?.data || res || {};
        const dsData = resData.datasets || resData.data || resData;
        const dataArray = Array.isArray(dsData) ? dsData : [];
        setDatasets(dataArray);
        setTotal(resData.total || (Array.isArray(dataArray) ? dataArray.length : 0));
      } catch (error) {
        console.error('Failed to fetch datasets:', error);
        setFetchError(error.message || 'Failed to load datasets from the server.');
        setDatasets([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    };

    fetchDatasets();
  }, [
    searchTerm,
    selectedSources,
    selectedDomains,
    selectedCertifications,
    selectedSensitivity,
    selectedTags,
    myFavorites,
    currentPage,
    pageLimit,
    currentUser._id,
    currentUser.id
  ]);

  // Compute dynamic domain filter options with dataset counts from actual database records
  const domainFilterOptions = useMemo(() => {
    const domainSet = new Set();
    if (Array.isArray(domains)) {
      domains.forEach(d => { if (d.name) domainSet.add(d.name); });
    }
    if (Array.isArray(datasets)) {
      datasets.forEach(d => { if (d.domain) domainSet.add(d.domain); });
    }
    const allDomainNames = Array.from(domainSet).sort();
    return allDomainNames.map(name => ({
      label: name,
      count: datasets.filter(d => {
        const dDomain = (d.domain || '').toLowerCase();
        return dDomain === name.toLowerCase();
      }).length
    }));
  }, [domains, datasets]);

  // Quality tier filtering
  const displayedDatasets = useMemo(() => {
    if (!Array.isArray(datasets)) return [];
    if (!selectedQualityTier || selectedQualityTier === 'All') return datasets;
    return datasets.filter(d => {
      if (d.notAssessed) return false;
      const q = typeof d.quality === 'number' ? d.quality : (typeof d.qualityScore === 'number' ? d.qualityScore : null);
      if (q === null) return false;
      if (selectedQualityTier === '90+') return q >= 90;
      if (selectedQualityTier === '80+') return q >= 80;
      if (selectedQualityTier === 'At Risk') return q < 80;
      return true;
    });
  }, [datasets, selectedQualityTier]);

  const handleResetFilters = () => {
    setSelectedSources([]);
    setSelectedDomains([]);
    setSelectedCertifications([]);
    setSelectedSensitivity([]);
    setSelectedTags([]);
    setSelectedQualityTier('All');
    setMyFavorites(false);
    setSearchTerm('');
    setCurrentPage(1);
  };

  const activeFilterCount =
    selectedSources.length +
    selectedDomains.length +
    selectedCertifications.length +
    selectedSensitivity.length +
    selectedTags.length +
    (selectedQualityTier !== 'All' ? 1 : 0) +
    (myFavorites ? 1 : 0);

  return (
    <div className="space-y-6 pb-8">
      {/* Page Header matching Screen 3 */}
      <PageHeader
        title="Data Catalog"
        subtitle="Discover, explore, and understand your organization's data."
        actions={
          <PermissionGate permission={PERMISSIONS.DATASET_CREATE}>
            <Button
              size="md"
              icon={Plus}
              onClick={() => setIsAddModalOpen(true)}
              className="w-full sm:w-auto"
            >
              Add Dataset
            </Button>
          </PermissionGate>
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

          {selectedTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium"
              style={{
                backgroundColor: 'var(--color-surface-secondary)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)'
              }}
            >
              <span>Tag: {tag}</span>
              <button
                type="button"
                onClick={() => setSelectedTags(selectedTags.filter((t) => t !== tag))}
                className="cursor-pointer p-0.5 rounded focus-visible:outline-2 focus-visible:outline-blue-500"
                style={{ color: 'var(--color-text-muted)' }}
                aria-label={`Remove ${tag} filter`}
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

          {myFavorites && (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium"
              style={{
                backgroundColor: 'var(--color-surface-secondary)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)'
              }}
            >
              <span>My Favorites</span>
              <button
                type="button"
                onClick={() => setMyFavorites(false)}
                className="cursor-pointer p-0.5 rounded focus-visible:outline-2 focus-visible:outline-blue-500"
                style={{ color: 'var(--color-text-muted)' }}
                aria-label="Remove my favorites filter"
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
            selectedSensitivity={selectedSensitivity}
            setSelectedSensitivity={setSelectedSensitivity}
            selectedTags={selectedTags}
            setSelectedTags={setSelectedTags}
            selectedQualityTier={selectedQualityTier}
            setSelectedQualityTier={setSelectedQualityTier}
            myFavorites={myFavorites}
            setMyFavorites={setMyFavorites}
            sources={sources}
            tagsList={tagsList}
            domains={domainFilterOptions}
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
              Showing <strong className="tabular-nums" style={{ color: 'var(--color-text-primary)' }}>{displayedDatasets.length}</strong> of{' '}
              <strong className="tabular-nums" style={{ color: 'var(--color-text-primary)' }}>{total}</strong> enterprise datasets
            </span>
            <span style={{ color: 'var(--color-text-muted)' }} className="hidden sm:inline">Click any row for quick inspection</span>
            <span style={{ color: 'var(--color-text-muted)' }} className="sm:hidden">Tap any card for quick inspection</span>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 dark:border-blue-400 mx-auto"></div>
              <p className="mt-2 text-slate-500 dark:text-slate-400">Loading datasets...</p>
            </div>
          ) : fetchError ? (
            <div className="text-center py-12 rounded-lg" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <AlertTriangle className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--color-text-muted)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Unable to load datasets</p>
              <p className="text-xs mt-1 max-w-md mx-auto" style={{ color: 'var(--color-text-muted)' }}>{fetchError}</p>
              <button
                type="button"
                onClick={() => { setFetchError(null); setCurrentPage(1); }}
                className="mt-3 px-4 py-1.5 text-xs font-semibold rounded-md cursor-pointer"
                style={{ backgroundColor: 'var(--color-brand)', color: 'white' }}
              >
                Retry
              </button>
            </div>
          ) : (
            <DatasetTable
              datasets={displayedDatasets}
              selectedIds={selectedIds}
              setSelectedIds={setSelectedIds}
              onResetFilters={handleResetFilters}
              favoriteIds={myFavorites ? datasets.filter(d => d.favoriteIds?.includes(currentUser._id || currentUser.id)).map(d => d._id || d.id) : []}
              onToggleFavorite={(id) => {
                const userId = currentUser._id || currentUser.id;
                // Toggle favorite via API
                datasetApi.toggleFavorite(id).then(() => {
                  // Optimistic update: toggle favorite state in local dataset list
                  setDatasets(prev =>
                    prev.map(dataset => {
                      const dsId = dataset._id || dataset.id;
                      if (dsId !== id) return dataset;
                      const favIds = dataset.favoriteIds || [];
                      const isFav = favIds.includes(userId);
                      return {
                        ...dataset,
                        favoriteIds: isFav
                          ? favIds.filter(fid => fid.toString() !== userId.toString())
                          : [...favIds, userId],
                        favoriteCount: isFav
                          ? (dataset.favoriteCount || 1) - 1
                          : (dataset.favoriteCount || 0) + 1
                      };
                    })
                  );
                }).catch(err => {
                  console.error('Failed to toggle favorite:', err);
                });
              }}
            />
          )}

          {/* Pagination */}
          <div className="pt-2">
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(total / pageLimit)}
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
        selectedTags={selectedTags}
        setSelectedTags={setSelectedTags}
        selectedQualityTier={selectedQualityTier}
        setSelectedQualityTier={setSelectedQualityTier}
        myFavorites={myFavorites}
        setMyFavorites={setMyFavorites}
        sources={sources}
        tagsList={tagsList}
        domains={domainFilterOptions}
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