import React, { useState, useEffect, useCallback } from 'react';
import Drawer from '../common/Drawer';
import Button from '../common/Button';
import Badge from '../common/Badge';
import {
  BookOpen,
  Trash2,
  Edit3,
  Database,
  User,
  Tag,
  Calendar,
  CheckCircle,
  AlertCircle,
  Link,
  Plus,
  X,
  Columns,
  Layers,
  ShieldCheck,
  Clock,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useNavigate } from 'react-router-dom';
import glossaryApi from '../../services/glossaryApi';
import { PERMISSIONS } from '../../constants/rbac';

const STATUS_CONFIG = {
  approved: {
    label: 'Approved',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-900/60',
  },
  active: {
    label: 'Active',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-900/60',
  },
  draft: {
    label: 'Draft',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-900/60',
  },
  deprecated: {
    label: 'Deprecated',
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-900/60',
  },
  archived: {
    label: 'Archived',
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-600 dark:text-slate-400',
    border: 'border-slate-300 dark:border-slate-700',
  },
};

export default function GlossaryDrawer({
  term: initialTerm,
  isOpen,
  onClose,
  onEdit,
  onTermMutated,
}) {
  const { deleteGlossaryTerm, updateGlossaryTermStatus, datasets, glossaryTerms, can } = useApp();
  const navigate = useNavigate();

  const [termDetails, setTermDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState(null);

  // Relationship modals / selectors
  const [showAddDataset, setShowAddDataset] = useState(false);
  const [selectedDatasetToAdd, setSelectedDatasetToAdd] = useState('');

  const [showAddColumn, setShowAddColumn] = useState(false);
  const [selectedColDatasetId, setSelectedColDatasetId] = useState('');
  const [selectedColId, setSelectedColId] = useState('');

  const [showAddTerm, setShowAddTerm] = useState(false);
  const [selectedTermToAdd, setSelectedTermToAdd] = useState('');

  const canEdit = can ? can(PERMISSIONS.GLOSSARY_UPDATE) : true;
  const canDelete = can ? can(PERMISSIONS.GLOSSARY_DELETE) : true;

  const termId = initialTerm ? initialTerm.id || initialTerm._id : null;

  // Fetch full term details with resolved relationships
  const loadFullTerm = useCallback(async () => {
    if (!termId || !isOpen) return;
    setLoading(true);
    setActionError(null);
    try {
      const res = await glossaryApi.getTermById(termId);
      const envelope = (res && res.success !== undefined) ? res : (res?.data || {});
      if (envelope.success && envelope.data) {
        setTermDetails(envelope.data);
      } else {
        setTermDetails(initialTerm);
      }
    } catch {
      setTermDetails(initialTerm);
    } finally {
      setLoading(false);
    }
  }, [termId, isOpen, initialTerm]);

  useEffect(() => {
    if (isOpen && initialTerm) {
      setTermDetails(initialTerm);
      loadFullTerm();
    } else {
      setTermDetails(null);
      setShowAddDataset(false);
      setShowAddColumn(false);
      setShowAddTerm(false);
      setActionError(null);
    }
  }, [isOpen, initialTerm, loadFullTerm]);

  if (!initialTerm) return null;

  const current = termDetails || initialTerm;
  const statusCfg = STATUS_CONFIG[current.status?.toLowerCase()] || STATUS_CONFIG.draft;

  const handleDelete = async () => {
    if (window.confirm(`Delete "${current.term}" from the business glossary? This will unlink it from catalog datasets.`)) {
      try {
        await deleteGlossaryTerm(termId);
        if (onTermMutated) onTermMutated();
        onClose();
      } catch (err) {
        setActionError(err.response?.data?.message || err.message);
      }
    }
  };

  const handleStatusChange = async (newStatus) => {
    setActionError(null);
    try {
      const updated = await updateGlossaryTermStatus(termId, newStatus);
      setTermDetails((prev) => ({
        ...prev,
        status: newStatus,
        approvedBy: updated.approvedBy,
        approvedAt: updated.approvedAt,
      }));
      if (onTermMutated) onTermMutated();
    } catch (err) {
      setActionError(err.response?.data?.message || err.message);
    }
  };

  const handleLinkDataset = async () => {
    if (!selectedDatasetToAdd) return;
    setActionError(null);
    try {
      await glossaryApi.addDatasetRelationship(termId, selectedDatasetToAdd);
      setShowAddDataset(false);
      setSelectedDatasetToAdd('');
      await loadFullTerm();
      if (onTermMutated) onTermMutated();
    } catch (err) {
      setActionError(err.response?.data?.message || err.message || 'Failed to link dataset');
    }
  };

  const handleUnlinkDataset = async (datasetId) => {
    setActionError(null);
    try {
      await glossaryApi.removeDatasetRelationship(termId, datasetId);
      await loadFullTerm();
      if (onTermMutated) onTermMutated();
    } catch (err) {
      setActionError(err.response?.data?.message || err.message || 'Failed to unlink dataset');
    }
  };

  const handleLinkColumn = async () => {
    if (!selectedColDatasetId || !selectedColId) return;
    setActionError(null);
    try {
      await glossaryApi.addColumnRelationship(termId, {
        datasetId: selectedColDatasetId,
        columnId: selectedColId,
      });
      setShowAddColumn(false);
      setSelectedColDatasetId('');
      setSelectedColId('');
      await loadFullTerm();
      if (onTermMutated) onTermMutated();
    } catch (err) {
      setActionError(err.response?.data?.message || err.message || 'Failed to link column');
    }
  };

  const handleUnlinkColumn = async (colRef) => {
    setActionError(null);
    try {
      await glossaryApi.removeColumnRelationship(termId, {
        datasetId: colRef.datasetId,
        columnId: colRef.columnId,
      });
      await loadFullTerm();
      if (onTermMutated) onTermMutated();
    } catch (err) {
      setActionError(err.response?.data?.message || err.message || 'Failed to unlink column');
    }
  };

  const handleLinkRelatedTerm = async () => {
    if (!selectedTermToAdd) return;
    setActionError(null);
    try {
      await glossaryApi.addRelatedTerm(termId, selectedTermToAdd);
      setShowAddTerm(false);
      setSelectedTermToAdd('');
      await loadFullTerm();
      if (onTermMutated) onTermMutated();
    } catch (err) {
      setActionError(err.response?.data?.message || err.message || 'Failed to link related term');
    }
  };

  const handleUnlinkRelatedTerm = async (relatedId) => {
    setActionError(null);
    try {
      await glossaryApi.removeRelatedTerm(termId, relatedId);
      await loadFullTerm();
      if (onTermMutated) onTermMutated();
    } catch (err) {
      setActionError(err.response?.data?.message || err.message || 'Failed to unlink related term');
    }
  };

  // Find columns for currently selected dataset in column linking dropdown
  const colTargetDataset = datasets.find((d) => (d.id || d._id) === selectedColDatasetId);
  const targetDatasetColumns = colTargetDataset?.columns || colTargetDataset?.schema || [];

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={current.term}
      subtitle={`Domain: ${current.domain || 'Enterprise'}`}
      footer={
        <div className="flex items-center justify-between w-full">
          <div>
            {canDelete && (
              <Button
                variant="danger"
                size="sm"
                icon={Trash2}
                onClick={handleDelete}
              >
                Delete Term
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <Button
                variant="secondary"
                size="sm"
                icon={Edit3}
                onClick={() => {
                  onClose();
                  if (onEdit) onEdit(current);
                }}
              >
                Edit Term
              </Button>
            )}
            <Button size="sm" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-6 text-xs text-slate-600 dark:text-slate-300">
        {actionError && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{actionError}</span>
          </div>
        )}

        {/* 1. OVERVIEW SECTION */}
        <section className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Authoritative Definition
              </h4>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.text.includes('emerald') ? 'bg-emerald-500' : statusCfg.text.includes('amber') ? 'bg-amber-500' : 'bg-rose-500'}`} />
                  {statusCfg.label}
                </span>
                {canEdit && (
                  <select
                    value={current.status?.toLowerCase() || 'draft'}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="text-[11px] py-0.5 px-1.5 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] text-slate-700 dark:text-slate-300 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="draft">Draft</option>
                    <option value="approved">Approved</option>
                    <option value="deprecated">Deprecated</option>
                    <option value="archived">Archived</option>
                  </select>
                )}
              </div>
            </div>

            <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-normal bg-slate-50/60 dark:bg-slate-900/40 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-800/80">
              {current.definition}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 py-2 border-y border-slate-100 dark:border-slate-800 text-xs">
            <div>
              <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                Designated Owner
              </div>
              <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-bold flex items-center justify-center shrink-0">
                  {current.ownerId?.name?.slice(0, 2).toUpperCase() || current.owner?.slice(0, 2).toUpperCase() || 'GT'}
                </span>
                <span>{current.ownerId?.name || current.owner || 'Governance Team'}</span>
              </div>
            </div>

            <div>
              <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                Domain Classification
              </div>
              <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                <span>{current.domainId?.name || current.domain || 'Enterprise'}</span>
              </div>
            </div>
          </div>
        </section>

        {/* 2. SEMANTICS SECTION */}
        <section className="space-y-3.5 pt-1">
          <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Semantic Context
          </h4>

          {/* Synonyms */}
          <div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              Synonyms & Alternative Names:
            </div>
            {current.synonyms && current.synonyms.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {current.synonyms.map((syn) => (
                  <span
                    key={syn}
                    className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-medium"
                  >
                    {syn}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-[11px] text-slate-400 italic">None recorded</span>
            )}
          </div>

          {/* Tags */}
          <div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              Governance Tags:
            </div>
            {current.tags && current.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {current.tags.map((tg) => (
                  <span
                    key={tg}
                    className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900/50 text-[11px] font-medium"
                  >
                    #{tg}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-[11px] text-slate-400 italic">No tags</span>
            )}
          </div>

          {/* Business Rules */}
          {current.businessRules && current.businessRules.length > 0 && (
            <div className="pt-1">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                Governing Business Rules & Constraints:
              </div>
              <ul className="list-disc pl-4 space-y-1 text-slate-700 dark:text-slate-300 text-xs">
                {current.businessRules.map((br, idx) => (
                  <li key={idx} className="leading-relaxed">{br}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Examples */}
          {current.examples && current.examples.length > 0 && (
            <div className="pt-1">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                Examples & Formats:
              </div>
              <ul className="list-disc pl-4 space-y-1 text-slate-700 dark:text-slate-300 text-xs">
                {current.examples.map((ex, idx) => (
                  <li key={idx} className="leading-relaxed font-mono text-[11px]">{ex}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* 3. DATA RELATIONSHIPS SECTION */}
        <section className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
          {/* Related Datasets */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Related Datasets ({current.relatedDatasets?.length || current.relatedDatasetIds?.length || 0})</span>
              </h4>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setShowAddDataset(!showAddDataset)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Link Dataset</span>
                </button>
              )}
            </div>

            {/* Inline Add Dataset Form */}
            {showAddDataset && (
              <div className="p-2.5 mb-2.5 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 space-y-2">
                <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300">
                  Select Catalog Dataset to Link:
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedDatasetToAdd}
                    onChange={(e) => setSelectedDatasetToAdd(e.target.value)}
                    className="flex-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111C2E] text-xs py-1.5 px-2 text-slate-900 dark:text-white"
                  >
                    <option value="">Select a dataset...</option>
                    {datasets
                      .filter((d) => {
                        const dId = d.id || d._id;
                        const currentIds = (current.relatedDatasets || []).map((ds) => (ds._id || ds.id || ds).toString());
                        return !currentIds.includes(dId?.toString());
                      })
                      .map((d) => (
                        <option key={d.id || d._id} value={d.id || d._id}>
                          {d.name} ({d.domain || 'Data'})
                        </option>
                      ))}
                  </select>
                  <Button size="xs" onClick={handleLinkDataset} disabled={!selectedDatasetToAdd}>
                    Link
                  </Button>
                  <button
                    type="button"
                    onClick={() => setShowAddDataset(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              {(current.relatedDatasets && current.relatedDatasets.length > 0) ? (
                current.relatedDatasets.map((ds) => {
                  const dsId = ds._id || ds.id;
                  const dsName = ds.name || ds.displayName || ds;
                  return (
                    <div
                      key={dsId}
                      className="flex items-center justify-between p-2 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-[#111C2E]/40 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          navigate(`/catalog/${dsId}`);
                        }}
                        className="flex items-center gap-2 min-w-0 text-left cursor-pointer group flex-1"
                      >
                        <Database className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 truncate">
                          {dsName}
                        </span>
                        {ds.qualityScore != null && (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 shrink-0">
                            {ds.qualityScore}% Quality
                          </span>
                        )}
                      </button>

                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => handleUnlinkDataset(dsId)}
                          title="Unlink dataset"
                          className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer shrink-0 ml-2"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-[11px] text-slate-400 italic">No datasets linked</div>
              )}
            </div>
          </div>

          {/* Related Columns */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Columns className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Represented Columns ({current.relatedColumns?.length || 0})</span>
              </h4>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setShowAddColumn(!showAddColumn)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Link Column</span>
                </button>
              )}
            </div>

            {/* Inline Add Column Form */}
            {showAddColumn && (
              <div className="p-2.5 mb-2.5 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 space-y-2">
                <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300">
                  Select Dataset & Column:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    value={selectedColDatasetId}
                    onChange={(e) => {
                      setSelectedColDatasetId(e.target.value);
                      setSelectedColId('');
                    }}
                    className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111C2E] text-xs py-1.5 px-2 text-slate-900 dark:text-white"
                  >
                    <option value="">1. Choose Dataset...</option>
                    {datasets.map((d) => (
                      <option key={d.id || d._id} value={d.id || d._id}>
                        {d.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedColId}
                    onChange={(e) => setSelectedColId(e.target.value)}
                    disabled={!selectedColDatasetId}
                    className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111C2E] text-xs py-1.5 px-2 text-slate-900 dark:text-white disabled:opacity-50"
                  >
                    <option value="">2. Choose Column...</option>
                    {targetDatasetColumns.map((col) => (
                      <option key={col._id || col.id} value={col._id || col.id}>
                        {col.name} ({col.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <Button size="xs" onClick={handleLinkColumn} disabled={!selectedColDatasetId || !selectedColId}>
                    Link Column
                  </Button>
                  <button
                    type="button"
                    onClick={() => setShowAddColumn(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              {(current.relatedColumns && current.relatedColumns.length > 0) ? (
                current.relatedColumns.map((col) => (
                  <div
                    key={`${col.datasetId}-${col.columnId}`}
                    className="flex items-center justify-between p-2 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-[#111C2E]/40"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-900 dark:text-white text-xs">
                          {col.columnName}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
                          {col.type || 'string'}
                        </span>
                        {col.pii && (
                          <span className="text-[10px] px-1 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                            PII
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">
                        in dataset: <strong className="text-slate-600 dark:text-slate-300">{col.datasetName}</strong>
                      </div>
                    </div>

                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleUnlinkColumn(col)}
                        title="Unlink column"
                        className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer shrink-0 ml-2"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-[11px] text-slate-400 italic">No specific columns linked</div>
              )}
            </div>
          </div>

          {/* Related Business Terms */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Link className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Related Business Terms ({current.relatedTerms?.length || 0})</span>
              </h4>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setShowAddTerm(!showAddTerm)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Link Term</span>
                </button>
              )}
            </div>

            {/* Inline Add Term Form */}
            {showAddTerm && (
              <div className="p-2.5 mb-2.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 space-y-2">
                <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300">
                  Select Related Business Term:
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedTermToAdd}
                    onChange={(e) => setSelectedTermToAdd(e.target.value)}
                    className="flex-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111C2E] text-xs py-1.5 px-2 text-slate-900 dark:text-white"
                  >
                    <option value="">Choose another term...</option>
                    {glossaryTerms
                      .filter((t) => {
                        const tId = (t.id || t._id).toString();
                        const currentTermId = termId.toString();
                        const alreadyLinkedIds = (current.relatedTerms || []).map((rel) => (rel._id || rel.id || rel).toString());
                        return tId !== currentTermId && !alreadyLinkedIds.includes(tId);
                      })
                      .map((t) => (
                        <option key={t.id || t._id} value={t.id || t._id}>
                          {t.term} ({t.domain || 'Domain'})
                        </option>
                      ))}
                  </select>
                  <Button size="xs" onClick={handleLinkRelatedTerm} disabled={!selectedTermToAdd}>
                    Link Term
                  </Button>
                  <button
                    type="button"
                    onClick={() => setShowAddTerm(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              {(current.relatedTerms && current.relatedTerms.length > 0) ? (
                current.relatedTerms.map((rt) => {
                  const rId = rt._id || rt.id;
                  const rName = rt.term || rt.name || rt;
                  return (
                    <div
                      key={rId}
                      className="flex items-center justify-between p-2 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-[#111C2E]/40"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold text-slate-900 dark:text-white text-xs">
                          {rName}
                        </span>
                        {rt.domain && (
                          <span className="text-[10px] text-slate-400 ml-2">
                            ({rt.domain})
                          </span>
                        )}
                      </div>

                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => handleUnlinkRelatedTerm(rId)}
                          title="Unlink term"
                          className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer shrink-0 ml-2"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-[11px] text-slate-400 italic">No related terms linked</div>
              )}
            </div>
          </div>
        </section>

        {/* 4. AUDIT & LIFECYCLE SECTION */}
        <section className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
          <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-1">
            Governance & Audit Trail
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-500 dark:text-slate-400">
            <div>
              Created by:{' '}
              <strong className="text-slate-700 dark:text-slate-300">
                {current.createdBy?.name || 'System Admin'}
              </strong>
              <div className="text-[10px] text-slate-400">
                {current.createdAt ? new Date(current.createdAt).toLocaleString() : 'Initial Setup'}
              </div>
            </div>

            <div>
              Last updated by:{' '}
              <strong className="text-slate-700 dark:text-slate-300">
                {current.updatedBy?.name || current.owner || 'Governance Team'}
              </strong>
              <div className="text-[10px] text-slate-400">
                {current.updatedAt ? new Date(current.updatedAt).toLocaleString() : 'Recently'}
              </div>
            </div>

            {current.approvedBy && (
              <div className="sm:col-span-2 p-2 rounded bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>
                  Approved by <strong>{current.approvedBy?.name || 'Data Steward'}</strong> on{' '}
                  {current.approvedAt ? new Date(current.approvedAt).toLocaleDateString() : 'Official Review'}
                </span>
              </div>
            )}
          </div>
        </section>
      </div>
    </Drawer>
  );
}
