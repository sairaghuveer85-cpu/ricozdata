import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import {
  Database,
  Table,
  Layers,
  Search,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Folder,
  ArrowRight,
  Sparkles,
  Columns,
  CheckSquare,
  Square,
  FileSpreadsheet
} from 'lucide-react';
import apiClient from '../../services/apiClient';

export default function DiscoverAssetsModal({
  isOpen,
  onClose,
  dataSource,
  onSyncSuccess
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [discoveredAssets, setDiscoveredAssets] = useState([]);
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedAssetNames, setSelectedAssetNames] = useState(new Set());
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  useEffect(() => {
    if (isOpen && dataSource) {
      fetchDiscoveredAssets();
    } else {
      setDiscoveredAssets([]);
      setFilterQuery('');
      setSelectedAssetNames(new Set());
      setError(null);
      setSyncResult(null);
    }
  }, [isOpen, dataSource]);

  const fetchDiscoveredAssets = async () => {
    if (!dataSource) return;
    setLoading(true);
    setError(null);
    setSyncResult(null);

    const dsId = dataSource._id || dataSource.id;
    try {
      const res = await apiClient.post(`/data-sources/${dsId}/discover`);
      if (res.success && res.data) {
        // Formulate normalized asset list
        const assets = res.data.assets || res.data.tables || res.data.datasets || [];
        setDiscoveredAssets(assets);
        // Default select all discovered assets
        setSelectedAssetNames(new Set(assets.map(a => a.name || a.tableName || a.id)));
      } else {
        setError(res.error?.message || 'Failed to discover database metadata.');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Metadata discovery failed on remote host.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSelect = (assetKey) => {
    const next = new Set(selectedAssetNames);
    if (next.has(assetKey)) {
      next.delete(assetKey);
    } else {
      next.add(assetKey);
    }
    setSelectedAssetNames(next);
  };

  const handleSelectAll = () => {
    if (selectedAssetNames.size === filteredAssets.length) {
      setSelectedAssetNames(new Set());
    } else {
      setSelectedAssetNames(new Set(filteredAssets.map(a => a.name || a.tableName || a.id)));
    }
  };

  const handleSyncToCatalog = async () => {
    if (!dataSource) return;
    setIsSyncing(true);
    setSyncResult(null);

    const dsId = dataSource._id || dataSource.id;
    try {
      const res = await apiClient.post(`/data-sources/${dsId}/sync`, {
        filterTables: Array.from(selectedAssetNames)
      });

      if (res.success) {
        setSyncResult({
          success: true,
          added: res.data?.added || res.data?.createdCount || selectedAssetNames.size,
          updated: res.data?.updated || 0,
          total: res.data?.total || selectedAssetNames.size,
          message: `Synchronized ${selectedAssetNames.size} ${isMongo ? 'collection(s)' : 'dataset schema(s)'} into Enterprise Data Catalog.`
        });
        if (typeof onSyncSuccess === 'function') {
          onSyncSuccess(res.data);
        }
      } else {
        setSyncResult({
          success: false,
          error: res.error?.message || 'Failed to reconcile catalog schemas.'
        });
      }
    } catch (err) {
      setSyncResult({
        success: false,
        error: err.response?.data?.message || err.message || 'Catalog synchronization failed.'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const filteredAssets = discoveredAssets.filter((asset) => {
    const name = asset.name || asset.tableName || '';
    const schema = asset.schema || '';
    const q = filterQuery.toLowerCase();
    return name.toLowerCase().includes(q) || schema.toLowerCase().includes(q);
  });

  const isMongo = dataSource?.type === 'mongodb';
  const isSnowflake = dataSource?.type === 'snowflake';
  const isSqlServer = dataSource?.type === 'sqlserver';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Discover Metadata — ${dataSource?.name || 'Data Source'}`}
      subtitle={
        isMongo
          ? 'Inspecting live collections, document structures, and field BSON types from MongoDB.'
          : isSnowflake
          ? 'Inspecting live tables, views, columns, and data types from Snowflake data warehouse.'
          : isSqlServer
          ? 'Inspecting live tables, views, schemas, columns, and SQL Server data types.'
          : `Inspecting live tables, views, schemas, and columns from ${dataSource?.type?.toUpperCase() || 'remote source'}.`
      }
      maxWidth="max-w-4xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {selectedAssetNames.size} of {discoveredAssets.length} {isMongo ? 'collection(s)' : 'asset(s)'} selected
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
            >
              Close
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              icon={isSyncing ? RefreshCw : Sparkles}
              loading={isSyncing}
              disabled={loading || selectedAssetNames.size === 0}
              onClick={handleSyncToCatalog}
            >
              Sync to Data Catalog ({selectedAssetNames.size})
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        {/* Sync Success / Error Banner */}
        {syncResult && (
          <div
            className={`p-3.5 rounded-lg border text-xs flex items-start gap-2.5 ${
              syncResult.success
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200'
            }`}
          >
            {syncResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-bold">
                {syncResult.success ? 'Catalog Synchronized' : 'Sync Failed'}
              </div>
              <p className="text-[11px] mt-0.5 opacity-90">
                {syncResult.success ? syncResult.message : syncResult.error}
              </p>
            </div>
          </div>
        )}

        {/* Discovery Search and Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder={isMongo ? "Search collections or databases..." : (isSnowflake || isSqlServer) ? "Search tables, views, or schemas..." : "Search tables or schemas..."}
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-md border border-slate-200 dark:border-[#1D3047] bg-white dark:bg-[#0D1828] text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <button
              type="button"
              onClick={handleSelectAll}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
            >
              {selectedAssetNames.size === filteredAssets.length && filteredAssets.length > 0 ? (
                <>
                  <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                  <span>Deselect All</span>
                </>
              ) : (
                <>
                  <Square className="w-3.5 h-3.5" />
                  <span>Select All ({filteredAssets.length})</span>
                </>
              )}
            </button>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              disabled={loading}
              onClick={fetchDiscoveredAssets}
            >
              {loading ? 'Discovering...' : 'Refresh'}
            </Button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                Querying {dataSource?.type?.toUpperCase() || 'Data Source'} Metadata...
              </p>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                {isMongo
                  ? 'Inspecting collection namespaces, indexes, and schema-sampled documents.'
                  : isSqlServer
                  ? 'Inspecting SQL Server catalog views, columns, keys, and row counts.'
                  : 'Inspecting information_schema and remote catalog dictionaries.'}
              </p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-lg text-rose-800 dark:text-rose-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Discovery Error</span>
            </div>
            <p className="text-xs pl-6">{error}</p>
            <div className="pl-6 pt-1">
              <Button size="sm" variant="secondary" onClick={fetchDiscoveredAssets}>
                Retry Discovery
              </Button>
            </div>
          </div>
        )}

        {/* Discovered Assets List */}
        {!loading && !error && filteredAssets.length === 0 && (
          <div className="py-10 text-center text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-[#1D3047] rounded-lg">
            <Database className="w-8 h-8 mx-auto text-slate-400 mb-2 opacity-60" />
            <p className="font-medium text-xs">
              {isMongo ? 'No collections discovered matching filter.' : 'No assets discovered matching filter.'}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              {isMongo
                ? 'Verify your target database name and collection permissions on MongoDB.'
                : 'Verify your schema filter or permissions on the target database engine.'}
            </p>
          </div>
        )}

        {!loading && !error && filteredAssets.length > 0 && (
          <div className="max-h-[380px] overflow-y-auto border border-slate-200 dark:border-[#1D3047] rounded-lg divide-y divide-slate-100 dark:divide-[#1D3047]">
            {filteredAssets.map((asset, idx) => {
              const assetKey = asset.name || asset.tableName || asset.id || `asset-${idx}`;
              const isSelected = selectedAssetNames.has(assetKey);
              const schemaName = asset.schema || (isMongo ? 'database' : 'public');
              const columns = asset.columns || asset.fields || [];

              return (
                <div
                  key={assetKey}
                  onClick={() => handleToggleSelect(assetKey)}
                  className={`p-3 flex items-start gap-3 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/40 dark:bg-blue-950/20'
                      : 'hover:bg-slate-50 dark:hover:bg-[#111C2E]'
                  }`}
                >
                  <div className="pt-0.5">
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                        {assetKey}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {schemaName}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                        {asset.type || (isMongo ? 'COLLECTION' : 'TABLE')}
                      </span>
                      {columns.length > 0 && (
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 ml-auto">
                          <Columns className="w-3 h-3" />
                          {columns.length} {isMongo ? 'fields' : 'columns'}
                        </span>
                      )}
                    </div>

                    {/* Column chips preview */}
                    {columns.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap mt-2">
                        {columns.slice(0, 6).map((col, cIdx) => (
                          <span
                            key={cIdx}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#152338] text-slate-700 dark:text-slate-300 font-mono"
                          >
                            {col.name || col.columnName || col}:{' '}
                            <span className="text-slate-500 dark:text-slate-400">
                              {col.dataType || col.type || 'text'}
                            </span>
                          </span>
                        ))}
                        {columns.length > 6 && (
                          <span className="text-[10px] text-slate-400">
                            +{columns.length - 6} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
