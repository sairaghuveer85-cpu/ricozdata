import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Drawer from '../common/Drawer';
import Button from '../common/Button';
import Badge from '../common/Badge';
import {
  ExternalLink,
  Share2,
  Download,
  Layers,
  Columns,
  Eye,
  Clock
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import datasetApi from '../../services/datasetApi';
import { exportDatasetSchema } from '../../utils/schemaExporter';
import { normalizeBackendDataset } from '../../utils/normalizeDataset';

export default function DatasetDrawer({ dataset, isOpen, onClose }) {
  const navigate = useNavigate();
  const { addToast } = useApp();

  const [liveDataset, setLiveDataset] = useState(() => (dataset ? normalizeBackendDataset(dataset) : null));
  const viewedSessionsRef = useRef(new Set());

  // Keep live dataset in sync with prop updates when opened
  useEffect(() => {
    if (dataset) {
      setLiveDataset(normalizeBackendDataset(dataset));
    }
  }, [dataset]);

  // Fetch authoritative state and track single view per drawer session
  useEffect(() => {
    if (!isOpen || !dataset) return;
    const datasetId = dataset.id || dataset._id;
    if (!datasetId) return;

    let isCancelled = false;
    const isAlreadyViewed = viewedSessionsRef.current.has(datasetId);

    const fetchFresh = async () => {
      try {
        const params = isAlreadyViewed ? { trackView: 'false' } : {};
        viewedSessionsRef.current.add(datasetId);

        const res = await datasetApi.getDatasetById(datasetId, params);
        const data = res?.data?.data || res?.data || res;
        if (!isCancelled && data && typeof data === 'object' && data.name) {
          setLiveDataset(normalizeBackendDataset(data));
        }
      } catch (err) {
        console.warn('Failed to load authoritative dataset metadata:', err);
      }
    };

    fetchFresh();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, dataset?.id, dataset?._id]);

  // Reset session tracking when drawer closes
  useEffect(() => {
    if (!isOpen) {
      viewedSessionsRef.current.clear();
    }
  }, [isOpen]);

  if (!dataset) return null;

  const currentData = liveDataset || normalizeBackendDataset(dataset);
  if (!currentData) return null;

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.origin + `/catalog/${currentData.id || currentData._id}`);
    addToast({
      type: 'success',
      title: 'Link copied',
      message: 'Dataset URL copied to clipboard.'
    });
  };

  const handleExportSchema = async () => {
    await exportDatasetSchema(currentData, {
      getFullDataset: (id) => datasetApi.getDatasetById(id),
      addToast
    });
  };

  const resolvedColumnsCount = currentData.columnsCount !== undefined && currentData.columnsCount !== null
    ? currentData.columnsCount
    : (Array.isArray(currentData.columns) ? currentData.columns.length : 'Not Available');

  const resolvedUsage = currentData.usage || (currentData.views !== undefined ? `${currentData.views.toLocaleString()} views` : '0 views');

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={currentData.displayName || currentData.name}
      subtitle={`${currentData.domain || 'Unassigned'} • ${currentData.source || 'External Source'}`}
      footer={
        <>
          <Button
            variant="secondary"
            size="sm"
            icon={Download}
            onClick={handleExportSchema}
          >
            Export Schema
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={Share2}
            onClick={handleShare}
          >
            Share
          </Button>
          <Button
            size="sm"
            icon={ExternalLink}
            onClick={() => {
              onClose();
              navigate(`/catalog/${currentData.id || currentData._id}`);
            }}
          >
            Open Full Dataset
          </Button>
        </>
      }
    >
      <div className="space-y-6 text-xs text-slate-600 dark:text-slate-300">
        {/* Status and Health Banner */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Badge status={currentData.status} dot size="sm" />
            <span className="text-slate-400">•</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {currentData.sensitivity || 'Internal'}
            </span>
          </div>
          {currentData.notAssessed || currentData.quality === null || currentData.quality === undefined ? (
            <div className="flex items-center gap-1 font-semibold text-slate-500 dark:text-slate-400">
              <span>Not Assessed</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
              <span>{currentData.quality}% Quality</span>
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-1.5">
            Description
          </h4>
          <p className="leading-relaxed">
            {currentData.longDescription || currentData.description || 'No description available'}
          </p>
        </div>

        {/* Key Metrics Grid */}
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-2.5">
            Dataset Metrics
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-slate-400 mb-1">
                <Layers className="w-3.5 h-3.5" />
                <span>Rows</span>
              </div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                {currentData.rows || (currentData.rowCount !== undefined ? `${currentData.rowCount} rows` : 'Not Available')}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-slate-400 mb-1">
                <Columns className="w-3.5 h-3.5" />
                <span>Columns</span>
              </div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                {resolvedColumnsCount}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-slate-400 mb-1">
                <Eye className="w-3.5 h-3.5" />
                <span>Usage</span>
              </div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                {resolvedUsage}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-slate-400 mb-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Updated</span>
              </div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                {currentData.updated || currentData.lastUpdatedDate || 'Not Available'}
              </div>
            </div>
          </div>
        </div>

        {/* Ownership */}
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-2">
            Owner & Stewardship
          </h4>
          <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
              {currentData.owner && currentData.owner !== 'Unassigned' ? currentData.owner.charAt(0).toUpperCase() : '?'}
            </div>
            <div>
              <div className="font-semibold text-slate-900 dark:text-white">
                {currentData.owner || 'Unassigned'}
              </div>
              <div className="text-[11px] text-slate-400">
                {currentData.ownerRole ? `${currentData.ownerRole} • ` : ''}{currentData.domain || 'Unassigned'}
              </div>
            </div>
          </div>
        </div>

        {/* Tags */}
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-2">
            Classification Tags
          </h4>
          {currentData.tags && currentData.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {currentData.tags.map(t => (
                <Badge key={t} variant="tag" size="xs">
                  {t}
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-xs text-slate-400 italic">No classification tags assigned</span>
          )}
        </div>
      </div>
    </Drawer>
  );
}
