import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, AlertCircle, Sparkles, BookOpen, Search } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/common/Button';
import GlossaryFilters from '../components/glossary/GlossaryFilters';
import GlossaryTable from '../components/glossary/GlossaryTable';
import AddTermModal from '../components/glossary/AddTermModal';
import EditTermModal from '../components/glossary/EditTermModal';
import Pagination from '../components/common/Pagination';
import PermissionGate from '../components/auth/PermissionGate';
import { PERMISSIONS } from '../constants/rbac';
import { useApp } from '../context/AppContext';
import glossaryApi from '../services/glossaryApi';

export default function BusinessGlossary() {
  const navigate = useNavigate();
  const { addGlossaryTerm, updateGlossaryTerm } = useApp();

  // Query state
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('All Domains');
  const [selectedStatus, setSelectedStatus] = useState('All Statuses');
  const [sortBy, setSortBy] = useState('term');
  const [sortOrder, setSortOrder] = useState('asc');
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  // Data state
  const [terms, setTerms] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pendingSuggestionsCount, setPendingSuggestionsCount] = useState(0);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTerm, setEditingTerm] = useState(null);

  // Debounce search input by 300ms
  const searchTimeoutRef = useRef(null);
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm]);

  // Fetch glossary terms from server
  const fetchTerms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        limit,
        sortBy,
        sortOrder,
      };

      if (debouncedSearch && debouncedSearch.trim()) {
        params.search = debouncedSearch.trim();
      }
      if (selectedDomain && selectedDomain !== 'All Domains') {
        params.domain = selectedDomain;
      }
      if (selectedStatus && selectedStatus !== 'All Statuses') {
        params.status = selectedStatus.toLowerCase();
      }

      const res = await glossaryApi.getTerms(params);
      const responseEnvelope = (res && res.success !== undefined) ? res : (res?.data || {});

      if (responseEnvelope.success) {
        const payload = responseEnvelope.data;
        const items = Array.isArray(payload) ? payload : (payload?.items || payload?.terms || []);
        const paginationData = payload?.pagination || {
          page,
          limit,
          total: items.length,
          pages: Math.ceil(items.length / limit) || 1,
        };

        setTerms(items);
        setPagination(paginationData);
      } else {
        throw new Error(responseEnvelope.message || 'Failed to retrieve glossary terms');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error connecting to glossary service');
      setTerms([]);
    } finally {
      setLoading(false);
    }
  }, [page, limit, sortBy, sortOrder, debouncedSearch, selectedDomain, selectedStatus]);

  useEffect(() => {
    fetchTerms();
  }, [fetchTerms]);

  // Fetch pending suggestions count for navigation badge
  useEffect(() => {
    const fetchPendingCount = async () => {
      try {
        const res = await glossaryApi.getSuggestions({ status: 'pending', limit: 1 });
        const envelope = (res && res.success !== undefined) ? res : (res?.data || {});
        if (envelope.success && envelope.data?.metrics) {
          setPendingSuggestionsCount(envelope.data.metrics.totalPending || 0);
        }
      } catch {
        // Silently ignore if suggestions not accessible
      }
    };
    fetchPendingCount();
  }, []);

  // Sorting handler
  const handleSort = (key) => {
    if (sortBy === key) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortOrder('asc');
    }
    setPage(1);
  };

  // Reset all filters
  const handleReset = () => {
    setSearchTerm('');
    setDebouncedSearch('');
    setSelectedDomain('All Domains');
    setSelectedStatus('All Statuses');
    setSortBy('term');
    setSortOrder('asc');
    setPage(1);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const hasActiveFilters =
    Boolean(searchTerm && searchTerm.trim().length > 0) ||
    selectedDomain !== 'All Domains' ||
    selectedStatus !== 'All Statuses';

  // Compact summary metrics
  const approvedCount = terms.filter(
    (t) => (t.status || '').toLowerCase() === 'approved' || (t.status || '').toLowerCase() === 'active'
  ).length;
  const draftCount = terms.filter((t) => (t.status || '').toLowerCase() === 'draft').length;
  const deprecatedCount = terms.filter((t) => (t.status || '').toLowerCase() === 'deprecated').length;

  return (
    <div className="space-y-5">
      {/* 1. REFINED PAGE HEADER WITH INTEGRATED COMPACT METRICS */}
      <div className="space-y-3">
        <PageHeader
          title="Business Glossary"
          subtitle="Define and discover the meaning behind your enterprise data."
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="md"
                icon={Sparkles}
                onClick={() => navigate('/glossary/suggestions')}
                className="text-blue-600 dark:text-blue-400 font-medium"
              >
                Semantic Suggestions
                {pendingSuggestionsCount > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/80 dark:text-blue-200">
                    {pendingSuggestionsCount}
                  </span>
                )}
              </Button>
              <button
                type="button"
                onClick={fetchTerms}
                disabled={loading}
                title="Refresh glossary"
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 bg-white dark:bg-[#111C2E] transition-colors disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <PermissionGate permission={PERMISSIONS.GLOSSARY_CREATE}>
                <Button
                  size="md"
                  icon={Plus}
                  onClick={() => setIsAddModalOpen(true)}
                  className="w-full sm:w-auto shadow-2xs"
                >
                  Add Term
                </Button>
              </PermissionGate>
            </div>
          }
        />

        {/* Compact Integrated Metrics (Subtle, non-giant cards) */}
        {!error && pagination.total > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 pt-0.5">
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {pagination.total} {pagination.total === 1 ? 'Term' : 'Terms'}
            </span>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {approvedCount} Approved
            </span>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              {draftCount} Draft
            </span>
            {deprecatedCount > 0 && (
              <>
                <span className="text-slate-300 dark:text-slate-700">·</span>
                <span className="inline-flex items-center gap-1.5 text-rose-700 dark:text-rose-400 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  {deprecatedCount} Deprecated
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* 2. TAB NAVIGATION (Authoritative vs Suggestions) */}
      <div className="flex items-center border-b border-slate-200 dark:border-slate-800 text-xs">
        <button
          type="button"
          className="pb-3 px-3.5 font-semibold text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 flex items-center gap-1.5 cursor-default"
        >
          <BookOpen className="w-3.5 h-3.5 text-blue-500" />
          <span>Authoritative Glossary</span>
          {pagination.total > 0 && (
            <span className="ml-1 text-[11px] font-normal text-slate-500 dark:text-slate-400">
              ({pagination.total})
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => navigate('/glossary/suggestions')}
          className="pb-3 px-3.5 font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors flex items-center gap-1.5 border-b-2 border-transparent cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-slate-400" />
          <span>Semantic Suggestions</span>
          {pendingSuggestionsCount > 0 && (
            <span className="ml-1 px-1.5 py-0.2 text-[10px] font-semibold rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
              {pendingSuggestionsCount} pending
            </span>
          )}
        </button>
      </div>

      {/* 3. VISUALLY DOMINANT SEARCH & FILTER CONTROLS */}
      <GlossaryFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedDomain={selectedDomain}
        setSelectedDomain={(dom) => {
          setSelectedDomain(dom);
          setPage(1);
        }}
        selectedStatus={selectedStatus}
        setSelectedStatus={(st) => {
          setSelectedStatus(st);
          setPage(1);
        }}
        onReset={handleReset}
        totalCount={!loading && !error ? pagination.total : undefined}
      />

      {/* 4. ERROR STATE (Mutually exclusive from empty state) */}
      {error && (
        <div className="p-6 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/20 text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Unable to load Business Glossary</h3>
            <p className="text-xs text-red-700 dark:text-red-300 mt-1">{error}</p>
          </div>
          <Button size="sm" variant="secondary" onClick={fetchTerms}>
            Retry
          </Button>
        </div>
      )}

      {/* 5. SKELETON LOADING STATE */}
      {loading && (
        <GlossaryTable loading={true} />
      )}

      {/* 6. GENUINE EMPTY STATE: NO TERMS CREATED YET */}
      {!loading && !error && terms.length === 0 && !hasActiveFilters && (
        <div className="p-12 text-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] shadow-2xs space-y-3">
          <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
            <BookOpen className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">No business terms yet</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Create your first authoritative business definition to begin building your enterprise semantic layer.
            </p>
          </div>
          <div className="pt-1">
            <PermissionGate permission={PERMISSIONS.GLOSSARY_CREATE}>
              <Button size="sm" icon={Plus} onClick={() => setIsAddModalOpen(true)}>
                Create Business Term
              </Button>
            </PermissionGate>
          </div>
        </div>
      )}

      {/* 7. FILTERED EMPTY STATE: NO MATCHES FOR SEARCH / CRITERIA */}
      {!loading && !error && terms.length === 0 && hasActiveFilters && (
        <div className="p-10 text-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] shadow-2xs space-y-3">
          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <Search className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">No matching terms found</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Try adjusting your keyword search or domain/status filters.
            </p>
          </div>
          <Button size="xs" variant="secondary" onClick={handleReset}>
            Clear filters
          </Button>
        </div>
      )}

      {/* 8. MAIN TABLE WITH QUICK UNDERSTANDING HIERARCHY */}
      {!loading && !error && terms.length > 0 && (
        <>
          <GlossaryTable
            terms={terms}
            loading={false}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
            onReset={handleReset}
            onEdit={(term) => setEditingTerm(term)}
            onTermMutated={fetchTerms}
          />

          {/* Server-Side Pagination */}
          {pagination.pages > 1 && (
            <div className="pt-2 flex justify-end">
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.pages}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <AddTermModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={async (termData) => {
          await addGlossaryTerm(termData);
          fetchTerms();
        }}
      />

      <EditTermModal
        isOpen={Boolean(editingTerm)}
        onClose={() => setEditingTerm(null)}
        term={editingTerm}
        onSave={async (id, updatedFields) => {
          await updateGlossaryTerm(id, updatedFields);
          fetchTerms();
        }}
      />
    </div>
  );
}
