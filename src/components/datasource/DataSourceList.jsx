import React, { useState, useEffect } from 'react';
import Button from '../common/Button';
import Badge from '../common/Badge';
import Modal from '../common/Modal';
import {
  Database,
  Server,
  Cloud,
  Layers,
  HardDrive,
  Play,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Lock,
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  Eye,
  Activity,
  Sparkles,
  Columns,
  Table,
  ShieldCheck,
  Check,
  Clock,
  Zap,
  Filter,
  ArrowUpDown
} from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useApp } from '../../context/AppContext';
import AddDataSourceModal from './AddDataSourceModal';
import DiscoverAssetsModal from './DiscoverAssetsModal';
import EditDataSourceModal from './EditDataSourceModal';

const ENGINE_CONFIG = {
  postgresql: {
    label: 'PostgreSQL',
    icon: Database,
    color: 'text-sky-600 dark:text-sky-400',
    bg: 'bg-sky-50 dark:bg-sky-950/50 border-sky-200 dark:border-sky-800'
  },
  mysql: {
    label: 'MySQL',
    icon: Database,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800'
  },
  sqlserver: {
    label: 'SQL Server',
    icon: Server,
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800'
  },
  snowflake: {
    label: 'Snowflake',
    icon: Cloud,
    color: 'text-cyan-600 dark:text-cyan-400',
    bg: 'bg-cyan-50 dark:bg-cyan-950/50 border-cyan-200 dark:border-cyan-800'
  },
  mongodb: {
    label: 'MongoDB',
    icon: Layers,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800'
  },
  s3: {
    label: 'Amazon S3',
    icon: HardDrive,
    color: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-800'
  }
};

export default function DataSourceList() {
  const { addToast, fetchBackendData } = useApp();
  const [dataSources, setDataSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedSourceForDiscover, setSelectedSourceForDiscover] = useState(null);
  const [selectedSourceForEdit, setSelectedSourceForEdit] = useState(null);
  const [sourceToDelete, setSourceToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Action loading indicators by data source ID
  const [testingIds, setTestingIds] = useState(new Set());
  const [syncingIds, setSyncingIds] = useState(new Set());

  const fetchDataSources = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/data-sources');
      if (res.success && res.data) {
        setDataSources(res.data.dataSources || res.data || []);
      }
    } catch (err) {
      addToast({
        title: 'Error loading data sources',
        message: err.message || 'Failed to fetch configured data sources.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDataSources();
  }, []);

  const handleTestConnection = async (source) => {
    const id = source._id || source.id;
    setTestingIds(prev => new Set(prev).add(id));

    try {
      const res = await apiClient.post(`/data-sources/${id}/test`);
      if (res.success) {
        const latency = res.data?.latencyMs != null ? `${res.data.latencyMs}ms` : 'fast';
        addToast({
          title: 'Connection Test Succeeded',
          message: `Connected to ${source.name} successfully (Latency: ${latency}).`,
          type: 'success'
        });
        fetchDataSources();
      } else {
        addToast({
          title: 'Connection Test Failed',
          message: res.error?.message || res.data?.error || 'Remote host rejected connection.',
          type: 'error'
        });
        fetchDataSources();
      }
    } catch (err) {
      addToast({
        title: 'Connection Test Failed',
        message: err.response?.data?.message || err.message || 'Failed to test connection.',
        type: 'error'
      });
    } finally {
      setTestingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleSyncCatalog = async (source) => {
    const id = source._id || source.id;
    setSyncingIds(prev => new Set(prev).add(id));

    try {
      const res = await apiClient.post(`/data-sources/${id}/sync`);
      if (res.success) {
        const createdCount = res.data?.added || res.data?.createdCount || 0;
        const updatedCount = res.data?.updated || 0;
        addToast({
          title: 'Catalog Synchronized',
          message: `Successfully reconciled schemas for ${source.name}. (${createdCount} new, ${updatedCount} updated)`,
          type: 'success'
        });
        fetchDataSources();
        if (typeof fetchBackendData === 'function') fetchBackendData();
      } else {
        addToast({
          title: 'Sync Failed',
          message: res.error?.message || 'Could not synchronize datasets.',
          type: 'error'
        });
      }
    } catch (err) {
      addToast({
        title: 'Sync Error',
        message: err.response?.data?.message || err.message || 'Failed to sync catalog schemas.',
        type: 'error'
      });
    } finally {
      setSyncingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleDelete = async () => {
    if (!sourceToDelete) return;
    setIsDeleting(true);

    const id = sourceToDelete._id || sourceToDelete.id;
    try {
      const res = await apiClient.delete(`/data-sources/${id}`);
      if (res.success) {
        addToast({
          title: 'Data Source Deleted',
          message: `Removed ${sourceToDelete.name} from workspace.`,
          type: 'success'
        });
        setSourceToDelete(null);
        fetchDataSources();
        if (typeof fetchBackendData === 'function') fetchBackendData();
      } else {
        addToast({
          title: 'Delete Failed',
          message: res.error?.message || 'Could not delete data source.',
          type: 'error'
        });
      }
    } catch (err) {
      addToast({
        title: 'Delete Error',
        message: err.response?.data?.message || err.message || 'Failed to remove data source.',
        type: 'error'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredDataSources = dataSources.filter(s => {
    const matchesSearch =
      s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'ALL' || s.type === typeFilter;
    const matchesStatus = statusFilter === 'ALL' || (s.healthStatus || s.status) === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const healthyCount = dataSources.filter(s => s.healthStatus === 'HEALTHY' || s.connectionState === 'CONNECTED').length;

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-[#0D1828] p-5 rounded-xl border border-slate-200 dark:border-[#1D3047] shadow-2xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-600" />
            Connected Data Sources
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configure RDBMS, data warehouses, and cloud storage connectors with AES-256-GCM envelope encryption.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            disabled={loading}
            onClick={fetchDataSources}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={() => setIsAddModalOpen(true)}
          >
            Add Data Source
          </Button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-white dark:bg-[#0D1828] rounded-lg border border-slate-200 dark:border-[#1D3047]">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Configured Sources</div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-1 font-mono">{dataSources.length}</div>
        </div>
        <div className="p-3.5 bg-white dark:bg-[#0D1828] rounded-lg border border-slate-200 dark:border-[#1D3047]">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Healthy Connections</div>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 font-mono flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            {healthyCount} / {dataSources.length}
          </div>
        </div>
        <div className="p-3.5 bg-white dark:bg-[#0D1828] rounded-lg border border-slate-200 dark:border-[#1D3047]">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Security Boundary</div>
          <div className="text-xs font-semibold text-slate-900 dark:text-white mt-1.5 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-blue-500" />
            AES-256-GCM Vault
          </div>
        </div>
        <div className="p-3.5 bg-white dark:bg-[#0D1828] rounded-lg border border-slate-200 dark:border-[#1D3047]">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Live Engine Drivers</div>
          <div className="text-xs font-semibold text-slate-900 dark:text-white mt-1.5 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            6 Supported Engines
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search data sources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#1D3047] bg-white dark:bg-[#0D1828] text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-[#1D3047] bg-white dark:bg-[#0D1828] text-xs text-slate-900 dark:text-white py-1.5 px-3 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Engine Types</option>
            <option value="postgresql">PostgreSQL</option>
            <option value="mysql">MySQL</option>
            <option value="sqlserver">SQL Server</option>
            <option value="snowflake">Snowflake</option>
            <option value="mongodb">MongoDB</option>
            <option value="s3">Amazon S3</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-[#1D3047] bg-white dark:bg-[#0D1828] text-xs text-slate-900 dark:text-white py-1.5 px-3 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="HEALTHY">Healthy</option>
            <option value="ACTIVE">Active</option>
            <option value="ERROR">Error</option>
          </select>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="py-16 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
          <p className="text-xs text-slate-500 dark:text-slate-400">Loading data sources & connection statuses...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredDataSources.length === 0 && (
        <div className="p-12 text-center bg-white dark:bg-[#0D1828] rounded-xl border border-dashed border-slate-200 dark:border-[#1D3047] space-y-3">
          <Database className="w-10 h-10 text-slate-400 mx-auto opacity-60" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">No Data Sources Found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {searchQuery || typeFilter !== 'ALL'
              ? 'No connectors match your active search filters. Try clearing search or filter selections.'
              : 'Connect your first database, Snowflake warehouse, or S3 data lake to enable automated schema discovery and catalog sync.'}
          </p>
          <div className="pt-2">
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => setIsAddModalOpen(true)}
            >
              Add First Data Source
            </Button>
          </div>
        </div>
      )}

      {/* Card Grid */}
      {!loading && filteredDataSources.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredDataSources.map((source) => {
            const id = source._id || source.id;
            const typeKey = (source.type || 'postgresql').toLowerCase();
            const engine = ENGINE_CONFIG[typeKey] || ENGINE_CONFIG.postgresql;
            const EngineIcon = engine.icon;
            const isTesting = testingIds.has(id);
            const isSyncing = syncingIds.has(id);
            const cfg = source.configuration || source.connectionConfig || {};

            const isHealthy = source.healthStatus === 'HEALTHY' || source.connectionState === 'CONNECTED';
            const isError = source.healthStatus === 'ERROR' || source.healthStatus === 'UNHEALTHY' || source.connectionState === 'ERROR';

            return (
              <div
                key={id}
                className="bg-white dark:bg-[#0D1828] rounded-xl border border-slate-200 dark:border-[#1D3047] p-4 flex flex-col justify-between hover:shadow-xs transition-shadow space-y-4"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-lg border ${engine.bg}`}>
                        <EngineIcon className={`w-5 h-5 ${engine.color}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-bold text-slate-900 dark:text-white">{source.name}</h3>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${engine.bg} ${engine.color}`}>
                            {engine.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                          {source.description || 'Enterprise data source connector'}
                        </p>
                      </div>
                    </div>

                    {/* Status Pill */}
                    <div>
                      {isHealthy ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          HEALTHY
                        </span>
                      ) : isError ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          ERROR
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          UNTESTED
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-[#1D3047] grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-400">Host / Target:</span>
                      <div className="font-mono text-slate-700 dark:text-slate-300 truncate font-medium">
                        {cfg.host ? `${cfg.host}:${cfg.port || ''}` : cfg.account || cfg.bucket || 'Cloud Endpoint'}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400">Database / Schema:</span>
                      <div className="font-mono text-slate-700 dark:text-slate-300 truncate font-medium">
                        {cfg.database ? `${cfg.database}${cfg.schema ? `.${cfg.schema}` : ''}` : cfg.warehouse || cfg.prefix || 'Default'}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400">Last Latency:</span>
                      <div className="text-slate-700 dark:text-slate-300 font-mono font-medium flex items-center gap-1">
                        <Zap className="w-3 h-3 text-amber-500" />
                        {source.lastTestLatencyMs != null ? `${source.lastTestLatencyMs}ms` : 'Not recorded'}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400">Last Health Check:</span>
                      <div className="text-slate-700 dark:text-slate-300 truncate">
                        {source.lastTestedAt ? new Date(source.lastTestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}
                      </div>
                    </div>
                  </div>

                  {/* Last Error Note if any */}
                  {source.lastTestError && (
                    <div className="mt-2.5 p-2 bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40 rounded text-[10px] text-rose-800 dark:text-rose-300 line-clamp-1">
                      Error: {source.lastTestError}
                    </div>
                  )}

                  {/* Tags */}
                  {Array.isArray(source.tags) && source.tags.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
                      {source.tags.map((tag, tIdx) => (
                        <span
                          key={tIdx}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#152338] text-slate-600 dark:text-slate-400"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action Toolbar */}
                <div className="pt-3 border-t border-slate-100 dark:border-[#1D3047] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="xs"
                      variant="secondary"
                      icon={isTesting ? RefreshCw : Play}
                      loading={isTesting}
                      disabled={isTesting || isSyncing}
                      onClick={() => handleTestConnection(source)}
                    >
                      Test
                    </Button>

                    <Button
                      size="xs"
                      variant="secondary"
                      icon={Table}
                      disabled={isTesting || isSyncing}
                      onClick={() => setSelectedSourceForDiscover(source)}
                    >
                      Discover
                    </Button>

                    <Button
                      size="xs"
                      variant="secondary"
                      icon={isSyncing ? RefreshCw : Sparkles}
                      loading={isSyncing}
                      disabled={isTesting || isSyncing}
                      onClick={() => handleSyncCatalog(source)}
                    >
                      Sync
                    </Button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSelectedSourceForEdit(source)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Edit Configuration"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSourceToDelete(source)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Delete Data Source"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Modal */}
      <AddDataSourceModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={(newSource) => {
          addToast({
            title: 'Data Source Created',
            message: `Registered ${newSource?.name || 'connector'} with encrypted credentials.`,
            type: 'success'
          });
          fetchDataSources();
          if (typeof fetchBackendData === 'function') fetchBackendData();
        }}
      />

      {/* Discover Modal */}
      <DiscoverAssetsModal
        isOpen={Boolean(selectedSourceForDiscover)}
        onClose={() => setSelectedSourceForDiscover(null)}
        dataSource={selectedSourceForDiscover}
        onSyncSuccess={() => {
          fetchDataSources();
          if (typeof fetchBackendData === 'function') fetchBackendData();
        }}
      />

      {/* Edit Modal */}
      <EditDataSourceModal
        isOpen={Boolean(selectedSourceForEdit)}
        onClose={() => setSelectedSourceForEdit(null)}
        dataSource={selectedSourceForEdit}
        onSuccess={() => {
          addToast({
            title: 'Data Source Updated',
            message: 'Updated data source configuration.',
            type: 'success'
          });
          fetchDataSources();
        }}
      />

      {/* Delete Confirmation */}
      <Modal
        isOpen={Boolean(sourceToDelete)}
        onClose={() => setSourceToDelete(null)}
        title="Delete Data Source"
        subtitle="This action permanently removes this connector and its configurations."
        maxWidth="max-w-md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setSourceToDelete(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              loading={isDeleting}
              onClick={handleDelete}
            >
              Delete Data Source
            </Button>
          </div>
        }
      >
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          Are you sure you want to delete <strong className="text-slate-900 dark:text-white font-semibold">{sourceToDelete?.name}</strong>? All associated driver pools and connection configurations will be permanently removed.
        </p>
      </Modal>
    </div>
  );
}
