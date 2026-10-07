import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  FileText,
  ChevronRight,
  ChevronDown,
  Terminal,
  GitFork,
  Download,
  Trash2,
  Share2,
  MoreHorizontal,
  CheckCircle2,
  ShieldCheck,
  Clock,
  Sparkles,
  User,
  Database,
  Layers,
  Columns,
  Eye,
  Lock,
  Star,
  AlertTriangle,
  AlertCircle,
  Server,
  Tag,
  Hash
} from 'lucide-react';
import Badge from '../common/Badge';
import Dropdown from '../common/Dropdown';
import Button from '../common/Button';
import { useApp } from '../../context/AppContext';
import datasetApi from '../../services/datasetApi';
import { exportDatasetSchema } from '../../utils/schemaExporter';

export default function DatasetHeader({
  dataset,
  onOpenQuery,
  onDelete
}) {
  const { addToast, currentUser } = useApp();

  const handleExportSchema = async () => {
    await exportDatasetSchema(dataset, {
      getFullDataset: (id) => datasetApi.getDatasetById(id),
      addToast
    });
  };

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    addToast({
      title: 'Link Copied',
      message: 'Dataset permalink copied to clipboard.',
      type: 'success'
    });
  };

  const handleToggleFavorite = async () => {
    try {
      await datasetApi.toggleFavorite(dataset._id);
      addToast({
        title: dataset.favoriteIds?.includes(currentUser._id) ? 'Removed from favorites' : 'Added to favorites',
        type: 'success'
      });
      // Reload the dataset to get updated state
      window.location.reload();
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      addToast({
        title: 'Error',
        message: 'Failed to toggle favorite',
        type: 'error'
      });
    }
  };

  const handleCertify = async (status) => {
    try {
      await datasetApi.certifyDataset(dataset._id, { status });
      addToast({
        title: 'Certification updated',
        message: `Dataset marked as ${status}`,
        type: 'success'
      });
      window.location.reload();
    } catch (error) {
      console.error('Failed to update certification:', error);
      addToast({
        title: 'Error',
        message: 'Failed to update certification',
        type: 'error'
      });
    }
  };

  const certStatus = (dataset.certificationStatus || '').toLowerCase();
  const isFavorited = dataset.favoriteIds?.includes(currentUser._id);

  return (
    <div className="space-y-5 mb-6">
      {/* Dynamic Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <NavLink to="/catalog" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          Data Catalog
        </NavLink>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600" />
        <span className="text-slate-900 dark:text-white font-semibold">{dataset.name}</span>
      </nav>

      {/* Main Identity Row */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-start gap-3 sm:gap-4 min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/60 flex items-center justify-center shrink-0 shadow-2xs">
            <Database className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                {dataset.name}
              </h1>
              {certStatus === 'certified' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  Certified
                </span>
              )}
              {certStatus === 'in review' || certStatus === 'in_review' || certStatus === 'under review' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                  In Review
                </span>
              ) : null}
              {certStatus === 'deprecated' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                  Deprecated
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-3xl leading-relaxed">
              {dataset.description}
            </p>
          </div>
        </div>

        {/* Action Buttons: Favorite, Share, More */}
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleToggleFavorite}
            className={`p-2 rounded-lg transition-colors ${
              isFavorited
                ? 'text-amber-500 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                : 'text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
            aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star className={`w-5 h-5 ${isFavorited ? 'fill-amber-400 text-amber-500' : ''}`} />
          </button>

          <Button
            variant="secondary"
            size="sm"
            icon={Share2}
            onClick={handleShare}
          >
            Share
          </Button>

          <Dropdown
            align="right"
            width="w-52"
            trigger={
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                <span>Open Studio</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-80" />
              </button>
            }
            items={[
              {
                label: 'Query with SQL',
                icon: Terminal,
                onClick: onOpenQuery
              },
              {
                label: 'View in Lineage Graph',
                icon: GitFork,
                onClick: () => window.location.assign(`/lineage/${dataset._id || dataset.id}`)
              },
              {
                label: 'Export Schema Definition',
                icon: Download,
                onClick: handleExportSchema
              },
              { divider: true },
              {
                label: 'Delete Dataset',
                icon: Trash2,
                danger: true,
                onClick: onDelete
              }
            ]}
          />

          <Dropdown
            align="right"
            width="w-52"
            trigger={
              <button
                type="button"
                className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                title="More actions"
                aria-label="More actions"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            }
            items={[
              {
                label: 'Export Schema Definition',
                icon: Download,
                onClick: handleExportSchema
              },
              {
                label: 'Query with SQL',
                icon: Terminal,
                onClick: onOpenQuery
              },
              {
                label: 'View in Lineage Graph',
                icon: GitFork,
                onClick: () => window.location.assign(`/lineage/${dataset._id || dataset.id}`)
              },
              { divider: true },
              {
                label: 'Delete Dataset',
                icon: Trash2,
                danger: true,
                onClick: onDelete
              }
            ]}
          />
        </div>
      </div>

      {/* Metadata Badges Row */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {/* Source System */}
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
          <Server className="w-3 h-3" />
          <span className="font-mono text-[10px] font-medium">
            {dataset.sourceSystem || dataset.source || 'External Source'}
          </span>
        </span>

        {/* Source Type */}
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
          <Layers className="w-3 h-3" />
          <span className="font-medium text-[10px]">
            {dataset.sourceType || 'Table'}
          </span>
        </span>

        {/* Environment */}
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
          <Hash className="w-3 h-3" />
          <span className="font-medium text-[10px]">
            {dataset.environment || 'Production'}
          </span>
        </span>

        {/* Sensitivity */}
        <Badge
          status={dataset.sensitivity || 'Internal'}
          size="xs"
          dot
        />

        {/* Classification */}
        {dataset.classification && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <Tag className="w-3 h-3" />
            <span className="font-medium text-[10px]">
              {dataset.classification}
            </span>
          </span>
        )}

        {/* Tags */}
        {dataset.tags && dataset.tags.length > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <Tag className="w-3 h-3" />
            <span className="font-medium text-[10px]">
              {dataset.tags.slice(0, 3).join(', ')}
              {dataset.tags.length > 3 && <span> +{dataset.tags.length - 3}</span>}
            </span>
          </span>
        )}

        {/* Technical Owner */}
        {dataset.technicalOwner && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <User className="w-3 h-3" />
            <span className="font-medium text-[10px]">
              Tech Owner: {dataset.technicalOwner}
            </span>
          </span>
        )}

        {/* Favorite Count */}
        {dataset.favoriteCount && dataset.favoriteCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
            <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
            <span className="font-medium text-[10px]">
              {dataset.favoriteCount} {dataset.favoriteCount === 1 ? 'favorite' : 'favorites'}
            </span>
          </span>
        )}

        {/* View Count */}
        {dataset.viewCount && dataset.viewCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <Eye className="w-3 h-3" />
            <span className="font-medium text-[10px]">
              {dataset.viewCount.toLocaleString()} views
            </span>
          </span>
        )}

        {/* Last Updated */}
        {dataset.lastAccessedAt && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <Clock className="w-3 h-3" />
            <span className="font-medium text-[10px]">
              Updated {new Date(dataset.lastAccessedAt).toLocaleDateString()}
            </span>
          </span>
        )}
      </div>

      {/* Extended Descriptions */}
      {(dataset.businessDescription || dataset.technicalDescription || dataset.documentation) && (
        <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3">
          {dataset.businessDescription && (
            <div className="flex items-start gap-2">
              <div className="w-5 h-5 rounded bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Sparkles className="w-3 h-3" />
              </div>
              <div className="text-xs text-slate-700 dark:text-slate-300">
                <span className="font-semibold text-slate-900 dark:text-white">Business Context: </span>
                {dataset.businessDescription}
              </div>
            </div>
          )}
          {dataset.technicalDescription && (
            <div className="flex items-start gap-2">
              <div className="w-5 h-5 rounded bg-blue-100 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Terminal className="w-3 h-3" />
              </div>
              <div className="text-xs text-slate-700 dark:text-slate-300">
                <span className="font-semibold text-slate-900 dark:text-white">Technical Description: </span>
                {dataset.technicalDescription}
              </div>
            </div>
          )}
          {dataset.documentation && (
            <div className="flex items-start gap-2">
              <div className="w-5 h-5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center shrink-0">
                <FileText className="w-3 h-3" />
              </div>
              <div className="text-xs text-slate-700 dark:text-slate-300">
                <span className="font-semibold text-slate-900 dark:text-white">Documentation: </span>
                {dataset.documentation}
              </div>
            </div>
          )}
          {dataset.usageNotes && (
            <div className="flex items-start gap-2">
              <div className="w-5 h-5 rounded bg-amber-100 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Lock className="w-3 h-3" />
              </div>
              <div className="text-xs text-slate-700 dark:text-slate-300">
                <span className="font-semibold text-slate-900 dark:text-white">Usage Notes: </span>
                {dataset.usageNotes}
              </div>
            </div>
          )}
          {dataset.limitations && (
            <div className="flex items-start gap-2">
              <div className="w-5 h-5 rounded bg-rose-100 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-3 h-3" />
              </div>
              <div className="text-xs text-slate-700 dark:text-slate-300">
                <span className="font-semibold text-slate-900 dark:text-white">Limitations: </span>
                {dataset.limitations}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Certification Actions for Stewards/Admins */}
      {(certStatus === 'in review' || certStatus === 'in_review' || certStatus === 'under review' || certStatus === 'not certified') && (
        <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <span className="text-xs text-slate-500 dark:text-slate-400">Certification Actions:</span>
          <Button size="xs" variant="secondary" onClick={() => handleCertify('Under Review')}>
            Submit for Review
          </Button>
          <Button size="xs" onClick={() => handleCertify('Certified')}>
            <CheckCircle2 className="w-3 h-3 mr-1" /> Certify
          </Button>
          <Button size="xs" variant="outline" onClick={() => handleCertify('Deprecated')}>
            <AlertTriangle className="w-3 h-3 mr-1" /> Deprecate
          </Button>
        </div>
      )}
    </div>
  );
}