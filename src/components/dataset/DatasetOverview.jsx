import React, { useState } from 'react';
import {
  FileText,
  ExternalLink,
  Plus,
  Check,
  User,
  Clock,
  Download,
  Database,
  Layers,
  Columns,
  Lock,
  Eye,
  Globe
} from 'lucide-react';
import Badge from '../common/Badge';

export default function DatasetOverview({ dataset = {}, onUpdateTags }) {
  const [tags, setTags] = useState(Array.isArray(dataset.tags) ? dataset.tags : []);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');

  const handleAddTag = () => {
    if (newTagInput.trim() && !tags.includes(newTagInput.trim().toLowerCase())) {
      const updated = [...tags, newTagInput.trim().toLowerCase()];
      setTags(updated);
      onUpdateTags && onUpdateTags(updated);
    }
    setNewTagInput('');
    setIsAddingTag(false);
  };

  const resolvedColumns = dataset.columnsCount !== undefined && dataset.columnsCount !== null
    ? dataset.columnsCount
    : (Array.isArray(dataset.columns) ? dataset.columns.length : 'Not Available');

  const resolvedUsage = dataset.usage || (dataset.views !== undefined ? `${dataset.views.toLocaleString()} views` : '0 views');
  const resolvedUpdated = dataset.lastUpdatedDate || dataset.updated || 'Not Available';
  const resolvedRows = dataset.rows || (dataset.rowCount !== undefined ? `${dataset.rowCount} rows` : 'Not Available');

  const metadataItems = [
    { label: 'Owner', value: dataset.owner || 'Unassigned', icon: User },
    { label: 'Domain', value: dataset.domain || 'Unassigned', icon: Globe },
    { label: 'Source', value: dataset.source || 'External Source', icon: Database, isLink: true },
    { label: 'Last Updated', value: resolvedUpdated, icon: Clock },
    { label: 'Rows', value: resolvedRows, icon: Layers },
    { label: 'Columns', value: resolvedColumns, icon: Columns },
    { label: 'Sensitivity', value: dataset.sensitivity || 'Internal', icon: Lock, isHighlight: dataset.sensitivity === 'Confidential' || dataset.sensitivity === 'Restricted' },
    { label: 'Usage', value: resolvedUsage, icon: Eye },
  ];

  return (
    <div className="space-y-6">
      {/* 8-Property Technical Metadata Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {metadataItems.map((item, idx) => (
          <div
            key={idx}
            className="theme-card p-3 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs"
          >
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
              {item.label}
            </span>
            <div className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
              {item.icon && <item.icon className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />}
              <span className={
                item.isHighlight
                  ? 'text-rose-600 dark:text-rose-400 font-bold'
                  : item.isLink
                  ? 'text-blue-600 dark:text-blue-400'
                  : ''
              }>
                {item.value}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Main 2-Column Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Description & Tags (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Description Section */}
          <div className="theme-card p-5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3">
              Description
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {dataset.longDescription || dataset.description || 'No description available'}
            </p>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span>Data classification: <strong className="text-slate-900 dark:text-white">{dataset.classification || dataset.sensitivity || 'Not Specified'}</strong></span>
              <span>Update cadence: <strong className="text-slate-900 dark:text-white">{dataset.refreshFrequency || dataset.sourceDetails?.syncSchedule || 'On-Demand'}</strong></span>
            </div>
          </div>

          {/* Tags Section */}
          <div className="theme-card p-5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Tags
              </h3>
              <span className="text-[11px] text-slate-400">Searchable across catalog</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60"
                >
                  #{tag}
                </span>
              ))}

              {tags.length === 0 && !isAddingTag && (
                <span className="text-xs text-slate-400 italic">No tags assigned</span>
              )}

              {isAddingTag ? (
                <div className="inline-flex items-center gap-1">
                  <input
                    type="text"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                    placeholder="tag name..."
                    autoFocus
                    className="text-xs px-2 py-0.5 rounded-md border border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 w-24 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="p-1 rounded-md bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingTag(true)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3 text-slate-400" />
                  <span>Add tag</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Documentation & Governance (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Documentation Section */}
          <div className="theme-card p-5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Documentation
              </h3>
              <span className="text-[11px] text-slate-400">PDF & Guides</span>
            </div>
            <div className="space-y-2.5">
              {Array.isArray(dataset.documentation) && dataset.documentation.length > 0 ? (
                dataset.documentation.map((doc, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-md border border-slate-100 dark:border-slate-800/80 hover:border-blue-200 dark:hover:border-blue-900/60 hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-all group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <FileText className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-medium text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate block">
                          {doc.name || doc.title || 'Document'}
                        </span>
                        <div className="text-[11px] text-slate-400">
                          {doc.size || 'Attached'} • {doc.updated || 'Recently'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {doc.url && (
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 rounded text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Open Document"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 rounded-md border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                  No documentation files attached
                </div>
              )}
            </div>
          </div>

          {/* Certification & Stewardship */}
          <div className="theme-card p-5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Certification & Compliance
              </h3>
              <Badge status={dataset.status || 'Active'} size="sm" dot />
            </div>
            <div className="p-3 rounded-md bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Certified By:</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {dataset.certifiedBy || (dataset.certificationStatus === 'Certified' ? 'Enterprise Governance' : 'Not Certified')}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Certified Date:</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {dataset.certifiedAt ? new Date(dataset.certifiedAt).toLocaleDateString() : 'Not Certified'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Steward:</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  {dataset.steward || dataset.owner || 'Unassigned'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
