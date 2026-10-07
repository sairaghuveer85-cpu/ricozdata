import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  BookOpen, 
  Search, 
  SlidersHorizontal, 
  Database, 
  Columns, 
  CheckSquare, 
  Square, 
  EyeOff,
  Link as LinkIcon
} from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/common/Button';
import Pagination from '../components/common/Pagination';
import PermissionGate from '../components/auth/PermissionGate';
import { PERMISSIONS } from '../constants/rbac';
import { DOMAINS } from '../utils/constants';
import glossaryApi from '../services/glossaryApi';
import GenerateSuggestionsModal from '../components/glossary/GenerateSuggestionsModal';
import ReviewSuggestionModal from '../components/glossary/ReviewSuggestionModal';

export default function GlossarySuggestions() {
  const navigate = useNavigate();

  // Filters & Query state
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('pending');
  const [selectedConfidence, setSelectedConfidence] = useState('all');
  const [selectedDomain, setSelectedDomain] = useState('All Domains');
  const [selectedGroup, setSelectedGroup] = useState('recommended'); // 'recommended' | 'business_concepts' | 'identifiers' | 'attributes' | 'metrics' | 'technical_metadata' | 'all'
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [sortBy, setSortBy] = useState('confidenceScore');
  const [sortOrder, setSortOrder] = useState('desc');

  // Data state
  const [suggestions, setSuggestions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, pages: 1 });
  const [metrics, setMetrics] = useState({
    total: 0,
    totalPending: 0,
    highConfidencePending: 0,
    mediumConfidencePending: 0,
    lowConfidencePending: 0,
    recommendedCount: 0,
    reviewCount: 0,
    technicalCount: 0,
    entitiesCount: 0,
    measuresCount: 0,
    metricsCount: 0,
    attributesCount: 0,
    identifiersCount: 0,
    statusesCount: 0,
    approved: 0,
    rejected: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState(null);

  // Selection state for bulk operations
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Modals state
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [reviewingSuggestion, setReviewingSuggestion] = useState(null);

  // Search debounce
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

  // Fetch suggestions from backend
  const fetchSuggestions = useCallback(async () => {
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
      if (selectedStatus && selectedStatus !== 'all') {
        params.status = selectedStatus;
      }
      if (selectedConfidence && selectedConfidence !== 'all') {
        params.confidence = selectedConfidence;
      }
      if (selectedDomain && selectedDomain !== 'All Domains') {
        params.domain = selectedDomain;
      }

      // Grouping filter mapping
      if (selectedGroup === 'recommended') {
        params.priority = 'recommended';
      } else if (selectedGroup === 'business_entities') {
        params.category = 'BUSINESS_ENTITY';
      } else if (selectedGroup === 'attributes') {
        params.category = 'BUSINESS_ATTRIBUTE';
      } else if (selectedGroup === 'measures') {
        params.category = 'BUSINESS_MEASURE';
      } else if (selectedGroup === 'metrics') {
        params.category = 'BUSINESS_METRIC';
      } else if (selectedGroup === 'identifiers') {
        params.category = 'IDENTIFIER';
      } else if (selectedGroup === 'statuses') {
        params.category = 'STATUS';
      } else if (selectedGroup === 'technical_metadata') {
        params.priority = 'technical_metadata';
      }

      const res = await glossaryApi.getSuggestions(params);
      const envelope = (res && res.success !== undefined) ? res : (res?.data || {});

      if (envelope.success) {
        const payload = envelope.data;
        const items = payload?.items || [];
        setSuggestions(items);
        setPagination(payload?.pagination || { page: 1, limit: 15, total: items.length, pages: 1 });
        const summary = payload?.summary || payload?.metrics || {};
        setMetrics({
          total: summary.totalPending || 0,
          totalPending: summary.totalPending || 0,
          highConfidencePending: summary.highConfidence || 0,
          mediumConfidencePending: summary.mediumConfidence || 0,
          lowConfidencePending: summary.lowConfidence || 0,
          recommendedCount: summary.recommendedCount || 0,
          reviewCount: summary.reviewCount || 0,
          technicalCount: summary.technicalCount || 0,
          entitiesCount: summary.entitiesCount || 0,
          measuresCount: summary.measuresCount || 0,
          metricsCount: summary.metricsCount || 0,
          attributesCount: summary.attributesCount || 0,
          identifiersCount: summary.identifiersCount || 0,
          statusesCount: summary.statusesCount || 0,
          approved: summary.totalApproved || 0,
          rejected: summary.totalRejected || 0,
        });
      } else {
        throw new Error(envelope.message || 'Failed to retrieve suggestions');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error connecting to suggestion service');
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [page, limit, sortBy, sortOrder, debouncedSearch, selectedStatus, selectedConfidence, selectedDomain, selectedGroup]);

  useEffect(() => {
    fetchSuggestions();
    setSelectedIds(new Set()); // Reset selections on query change
  }, [fetchSuggestions]);

  // Toast auto-clear
  useEffect(() => {
    if (actionSuccessMsg) {
      const timer = setTimeout(() => setActionSuccessMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [actionSuccessMsg]);

  // Bulk selection helpers
  const handleToggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllVisible = () => {
    const pendingOnPage = suggestions.filter((s) => s.status === 'pending');
    if (selectedIds.size === pendingOnPage.length && pendingOnPage.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingOnPage.map((s) => s._id)));
    }
  };

  const handleSelectHighConfidence = () => {
    const highConf = suggestions.filter((s) => s.status === 'pending' && s.confidenceScore >= 90);
    setSelectedIds(new Set(highConf.map((s) => s._id)));
  };

  // Actions
  const handleApprove = async (id, overrides = {}) => {
    try {
      const res = await glossaryApi.approveSuggestion(id, overrides);
      const envelope = (res && res.success !== undefined) ? res : (res?.data || {});
      setActionSuccessMsg(envelope.message || 'Suggestion approved successfully into Business Glossary.');
      fetchSuggestions();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to approve suggestion');
    }
  };

  const handleReject = async (id, reason = '') => {
    try {
      await glossaryApi.rejectSuggestion(id, { reason });
      setActionSuccessMsg('Suggestion rejected.');
      fetchSuggestions();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to reject suggestion');
    }
  };

  const handleDismiss = async (id) => {
    try {
      await glossaryApi.dismissSuggestion(id);
      setActionSuccessMsg('Suggestion dismissed.');
      fetchSuggestions();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to dismiss suggestion');
    }
  };

  const handleBulkAction = async (action) => {
    if (selectedIds.size === 0) return;
    const confirmText = action === 'approve'
      ? `Are you sure you want to approve ${selectedIds.size} suggestion(s) into the authoritative Business Glossary?`
      : `Are you sure you want to dismiss ${selectedIds.size} suggestion(s)?`;
    
    if (!window.confirm(confirmText)) return;

    setBulkProcessing(true);
    try {
      const res = await glossaryApi.bulkActionSuggestions(action, Array.from(selectedIds));
      const envelope = (res && res.success !== undefined) ? res : (res?.data || {});
      setActionSuccessMsg(envelope.message || `Bulk ${action} completed successfully.`);
      setSelectedIds(new Set());
      fetchSuggestions();
    } catch (err) {
      alert(err.response?.data?.message || err.message || `Failed to perform bulk ${action}`);
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleGenerate = async (params) => {
    try {
      const res = await glossaryApi.generateSuggestions(params);
      const envelope = (res && res.success !== undefined) ? res : (res?.data || {});
      setActionSuccessMsg(envelope.message || 'Catalog metadata analyzed. New suggestions generated.');
      fetchSuggestions();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to generate suggestions');
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. REFINED HEADER WITH SUBTLE INTEGRATED SUMMARY */}
      <div className="space-y-3">
        <PageHeader
          title="Semantic Suggestions"
          subtitle="Discover potential business concepts from your enterprise catalog."
          actions={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchSuggestions}
                disabled={loading}
                title="Refresh suggestions"
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 bg-white dark:bg-[#111C2E] transition-colors disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <PermissionGate permission={PERMISSIONS.GLOSSARY_UPDATE}>
                <Button
                  size="md"
                  icon={Sparkles}
                  onClick={() => setIsGenerateModalOpen(true)}
                  className="w-full sm:w-auto shadow-2xs"
                >
                  Analyze Catalog
                </Button>
              </PermissionGate>
            </div>
          }
        />

        {/* Compact Integrated Summary */}
        {!error && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 pt-0.5">
            <span className="font-semibold text-blue-600 dark:text-blue-400">
              {metrics.recommendedCount} recommended
            </span>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <span className="text-amber-700 dark:text-amber-400 font-medium">
              {metrics.reviewCount} for review
            </span>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <span className="text-slate-600 dark:text-slate-400 font-medium">
              {metrics.technicalCount} technical metadata
            </span>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <span className="text-emerald-700 dark:text-emerald-400 font-medium">
              {metrics.highConfidencePending} high confidence
            </span>
          </div>
        )}
      </div>

      {/* 2. TAB NAVIGATION SWITCHER */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 text-xs">
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => navigate('/glossary')}
            className="pb-3 px-3.5 font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors flex items-center gap-1.5 border-b-2 border-transparent cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-slate-400" />
            <span>Authoritative Glossary</span>
          </button>
          <button
            type="button"
            className="pb-3 px-3.5 font-semibold text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 flex items-center gap-1.5 cursor-default"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            <span>Semantic Suggestions</span>
            {metrics.totalPending > 0 && (
              <span className="ml-1 px-1.5 py-0.2 text-[10px] font-semibold rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                {metrics.totalPending} pending
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 2.1 CONCEPT GROUPING FILTER BAR */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/70 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
        {[
          { id: 'recommended', label: 'Recommended', count: metrics.recommendedCount },
          { id: 'business_entities', label: 'Business Entities', count: metrics.entitiesCount },
          { id: 'attributes', label: 'Attributes', count: metrics.attributesCount },
          { id: 'measures', label: 'Measures', count: metrics.measuresCount },
          { id: 'metrics', label: 'Metrics', count: metrics.metricsCount },
          { id: 'identifiers', label: 'Identifiers', count: metrics.identifiersCount },
          { id: 'statuses', label: 'Statuses', count: metrics.statusesCount },
          { id: 'technical_metadata', label: 'Technical Metadata', count: metrics.technicalCount },
          { id: 'all', label: 'All Candidates' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => { setSelectedGroup(tab.id); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedGroup === tab.id
                ? 'bg-white dark:bg-[#111C2E] text-blue-600 dark:text-blue-400 shadow-2xs font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                selectedGroup === tab.id
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300'
                  : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Success Notification Alert */}
      {actionSuccessMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button
            onClick={() => setActionSuccessMsg(null)}
            className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 text-xs font-bold px-2 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button size="xs" variant="secondary" onClick={fetchSuggestions}>
            Retry
          </Button>
        </div>
      )}

      {/* 3. SEARCH & FILTER CONTROLS */}
      <div className="space-y-2.5">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search candidate terms, definitions, tags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1421] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-2xs"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-0.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => { setSelectedStatus(e.target.value); setPage(1); }}
              className="text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1421] text-slate-700 dark:text-slate-300 py-1.5 px-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
            >
              <option value="pending">Status: Pending Review</option>
              <option value="approved">Status: Approved</option>
              <option value="rejected">Status: Rejected</option>
              <option value="dismissed">Status: Dismissed</option>
              <option value="all">Status: All Statuses</option>
            </select>

            {/* Confidence Filter */}
            <select
              value={selectedConfidence}
              onChange={(e) => { setSelectedConfidence(e.target.value); setPage(1); }}
              className="text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1421] text-slate-700 dark:text-slate-300 py-1.5 px-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
            >
              <option value="all">Confidence: All Levels</option>
              <option value="high">High Confidence (90-100%)</option>
              <option value="medium">Medium Confidence (70-89%)</option>
              <option value="low">Low Confidence (0-69%)</option>
            </select>

            {/* Domain Filter */}
            <select
              value={selectedDomain}
              onChange={(e) => { setSelectedDomain(e.target.value); setPage(1); }}
              className="text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1421] text-slate-700 dark:text-slate-300 py-1.5 px-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
            >
              {DOMAINS.map((dom) => (
                <option key={dom} value={dom}>
                  {dom === 'All Domains' ? 'Domain: All Domains' : `Domain: ${dom}`}
                </option>
              ))}
            </select>

            {/* Reset Filters */}
            {(searchTerm || selectedStatus !== 'pending' || selectedConfidence !== 'all' || selectedDomain !== 'All Domains') && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedStatus('pending');
                  setSelectedConfidence('all');
                  setSelectedDomain('All Domains');
                  setPage(1);
                }}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline px-2 py-1 font-medium"
              >
                Clear filters
              </button>
            )}
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span className="text-slate-800 dark:text-slate-200 font-semibold">{pagination.total}</span>{' '}
            {pagination.total === 1 ? 'suggestion' : 'suggestions'}
          </div>
        </div>
      </div>

      {/* 4. BULK REVIEW BAR */}
      {selectedStatus === 'pending' && suggestions.length > 0 && (
        <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSelectAllVisible}
              className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300 hover:text-blue-600"
            >
              {selectedIds.size > 0 && selectedIds.size === suggestions.filter((s) => s.status === 'pending').length ? (
                <CheckSquare className="w-4 h-4 text-blue-600" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>Select Visible</span>
            </button>

            <button
              type="button"
              onClick={handleSelectHighConfidence}
              className="text-slate-600 dark:text-slate-400 hover:text-emerald-600 underline font-medium"
            >
              Select High-Confidence Only
            </button>

            {selectedIds.size > 0 && (
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                ({selectedIds.size} selected)
              </span>
            )}
          </div>

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <Button
                size="xs"
                variant="secondary"
                disabled={bulkProcessing}
                onClick={() => handleBulkAction('dismiss')}
              >
                Dismiss Selected ({selectedIds.size})
              </Button>
              <Button
                size="xs"
                icon={CheckCircle2}
                disabled={bulkProcessing}
                onClick={() => handleBulkAction('approve')}
              >
                Approve Selected ({selectedIds.size})
              </Button>
            </div>
          )}
        </div>
      )}

      {/* 5. LOADING SKELETON */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="p-4 rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 animate-pulse space-y-3">
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/4" />
              <div className="h-3.5 bg-slate-100 dark:bg-slate-800/60 rounded w-3/4" />
              <div className="h-3.5 bg-slate-100 dark:bg-slate-800/60 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* 6. SUGGESTION CARDS (Semantic clarity: ✨ Suggested vs ✓ Approved) */}
      {!loading && suggestions.length > 0 && (
        <div className="space-y-3">
          {suggestions.map((suggestion) => {
            const isSelected = selectedIds.has(suggestion._id);
            const isPending = suggestion.status === 'pending';
            const isApproved = suggestion.status === 'approved';
            const isRejected = suggestion.status === 'rejected';
            const isDismissed = suggestion.status === 'dismissed';
            const semanticScore = suggestion.semanticConfidence || suggestion.confidenceScore || 0;
            const relevanceScore = suggestion.glossaryRelevanceScore || (suggestion.conceptCategory === 'TECHNICAL_METADATA' ? 25 : 80);
            const isHighSemantic = semanticScore >= 90;
            const isMedSemantic = semanticScore >= 70 && semanticScore < 90;

            const semanticColor = isHighSemantic
              ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
              : isMedSemantic
              ? 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800'
              : 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700';

            const relevanceColor = relevanceScore >= 80
              ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800'
              : relevanceScore >= 60
              ? 'text-amber-700 dark:text-amber-400 bg-amber-50/70 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800'
              : 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700';

            const defConfidence = suggestion.definitionConfidence || 75;

            const categoryBadgeStyle = {
              BUSINESS_ENTITY: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800 font-extrabold',
              BUSINESS_MEASURE: 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-300 dark:border-amber-800 font-bold',
              BUSINESS_METRIC: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 font-bold',
              BUSINESS_ATTRIBUTE: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800',
              IDENTIFIER: 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200 dark:border-purple-800',
              STATUS: 'bg-yellow-50 text-yellow-800 dark:bg-yellow-950/50 dark:text-yellow-300 border-yellow-300 dark:border-yellow-800',
              DATE_ATTRIBUTE: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
              REFERENCE: 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300 border-violet-200 dark:border-violet-800',
              TECHNICAL_METADATA: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700',
            }[suggestion.conceptCategory] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';

            const isExistingTermMatch = suggestion.matchType === 'existing_term_link';
            const hasPII = suggestion.sourceColumnRefs?.some((c) => c.isPII) || suggestion.suggestedTags?.includes('PII');

            return (
              <div
                key={suggestion._id}
                className={`p-4 rounded-xl bg-white dark:bg-[#111C2E] border transition-all ${
                  isSelected
                    ? 'border-blue-500 ring-2 ring-blue-500/10'
                    : suggestion.isEntity
                    ? 'border-indigo-300 dark:border-indigo-800/80 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs'
                }`}
              >
                {/* Header Row */}
                <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                  <div className="flex items-start gap-2.5">
                    {isPending && (
                      <button
                        type="button"
                        onClick={() => handleToggleSelect(suggestion._id)}
                        className="mt-0.5 text-slate-400 hover:text-blue-600 transition-colors"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    )}

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          {suggestion.suggestedTerm}
                        </h3>

                        {/* Concept Category Badge */}
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider border ${categoryBadgeStyle}`}>
                          {(suggestion.conceptCategory || 'BUSINESS_ATTRIBUTE').replace(/_/g, ' ')}
                        </span>

                        {/* Semantic distinction status */}
                        {isPending && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-blue-500" />
                            <span>Suggested</span>
                          </span>
                        )}

                        {isApproved && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            <span>Approved</span>
                          </span>
                        )}

                        {isRejected && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border border-red-200 dark:border-red-800 flex items-center gap-1">
                            <XCircle className="w-3 h-3 text-red-500" />
                            <span>Rejected</span>
                          </span>
                        )}

                        {isDismissed && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                            Dismissed
                          </span>
                        )}

                        {/* Semantic Match % Badge */}
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${semanticColor}`}>
                          Semantic match: {semanticScore}%
                        </span>

                        {/* Glossary Relevance % Badge */}
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${relevanceColor}`}>
                          Glossary relevance: {relevanceScore}%
                        </span>

                        {/* Definition Confidence % Badge */}
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-medium border bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800">
                          Definition conf: {defConfidence}%
                        </span>

                        {/* Domain · PII metadata */}
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                          {suggestion.suggestedDomain}
                          {hasPII && (
                            <span className="ml-1.5 px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 font-semibold text-[10px]">
                              PII
                            </span>
                          )}
                        </span>

                        {/* Parent Entity hierarchy tag */}
                        {suggestion.parentEntityTerm && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-50/80 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80 font-medium">
                            Entity: {suggestion.parentEntityTerm}
                          </span>
                        )}

                        {/* Diagnostic anomaly badge */}
                        {suggestion.classificationAnomaly && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1" title={suggestion.classificationAnomaly}>
                            <AlertCircle className="w-3 h-3 text-amber-500 shrink-0" />
                            <span>⚠ PII classification review</span>
                          </span>
                        )}
                      </div>

                      {/* Source Dataset & Columns */}
                      {suggestion.sourceColumnRefs && suggestion.sourceColumnRefs.length > 0 ? (
                        <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          <Database className="w-3 h-3 text-blue-500 shrink-0" />
                          <span>
                            {suggestion.sourceColumnRefs[0].datasetName}.<strong className="text-slate-700 dark:text-slate-300 font-semibold">{suggestion.sourceColumnRefs[0].columnName}</strong>
                            {suggestion.sourceColumnRefs.length > 1 && ` (+${suggestion.sourceColumnRefs.length - 1} more)`}
                          </span>
                        </div>
                      ) : suggestion.isEntity ? (
                        <div className="flex items-center gap-1.5 mt-1 text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                          <Database className="w-3 h-3 shrink-0" />
                          <span>Core catalog entity asset</span>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Actions: [Review] [Approve] [Dismiss] */}
                  {isPending && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="xs"
                        variant="secondary"
                        onClick={() => setReviewingSuggestion(suggestion)}
                      >
                        Review
                      </Button>
                      <Button
                        size="xs"
                        icon={CheckCircle2}
                        onClick={() => handleApprove(suggestion._id)}
                      >
                        {isExistingTermMatch ? 'Approve Link' : 'Approve'}
                      </Button>
                      <button
                        type="button"
                        onClick={() => handleDismiss(suggestion._id)}
                        title="Dismiss suggestion"
                        className="px-2 py-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>

                {/* Definition */}
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pl-6 italic">
                  "{suggestion.suggestedDefinition}"
                </p>

                {/* Entity Child Attributes Hierarchy */}
                {suggestion.isEntity && suggestion.childAttributeTerms?.length > 0 && (
                  <div className="mt-2.5 p-2.5 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 text-xs ml-6">
                    <div className="font-semibold text-indigo-700 dark:text-indigo-300 mb-1">
                      Parent Entity ({suggestion.childAttributeTerms.length} Governed Attributes):
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestion.childAttributeTerms.map((attr) => (
                        <span key={attr} className="px-2 py-0.5 rounded bg-white dark:bg-[#111C2E] border border-indigo-200 dark:border-indigo-800 text-[11px] text-slate-700 dark:text-slate-300 font-medium">
                          {attr}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Detection Reason */}
                <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 pl-6">
                  <div>
                    <span className="font-medium text-slate-500 dark:text-slate-400">Detected from: </span>
                    <span>{suggestion.reasoning}</span>
                  </div>
                  {isExistingTermMatch && (
                    <span className="text-purple-600 dark:text-purple-400 font-medium flex items-center gap-1">
                      <LinkIcon className="w-3 h-3" />
                      <span>Existing match: {suggestion.matchedExistingTermId?.term || suggestion.suggestedTerm}</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 7. EMPTY STATE */}
      {!loading && suggestions.length === 0 && (
        <div className="p-12 text-center rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
          <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="max-w-sm mx-auto">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              No suggestions found
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {searchTerm || selectedStatus !== 'pending'
                ? 'No suggestions matched your current filter criteria.'
                : 'Analyze your Data Catalog metadata to discover candidate business terms.'}
            </p>
          </div>
          {(searchTerm || selectedStatus !== 'pending') ? (
            <Button
              variant="secondary"
              size="xs"
              onClick={() => {
                setSearchTerm('');
                setSelectedStatus('pending');
                setSelectedConfidence('all');
                setSelectedDomain('All Domains');
                setPage(1);
              }}
            >
              Clear Filters
            </Button>
          ) : (
            <PermissionGate permission={PERMISSIONS.GLOSSARY_UPDATE}>
              <Button
                size="sm"
                icon={Sparkles}
                onClick={() => setIsGenerateModalOpen(true)}
              >
                Analyze Catalog Now
              </Button>
            </PermissionGate>
          )}
        </div>
      )}

      {/* 8. PAGINATION */}
      {!loading && pagination.pages > 1 && (
        <div className="pt-2 flex justify-end">
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.pages}
            onPageChange={(p) => {
              setPage(p);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </div>
      )}

      {/* Modals */}
      <GenerateSuggestionsModal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        onGenerate={handleGenerate}
      />

      <ReviewSuggestionModal
        isOpen={Boolean(reviewingSuggestion)}
        onClose={() => setReviewingSuggestion(null)}
        suggestion={reviewingSuggestion}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </div>
  );
}
