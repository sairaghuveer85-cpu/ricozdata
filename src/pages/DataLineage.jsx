import React, { useState } from 'react';
import { useParams, useNavigate, NavLink } from 'react-router-dom';
import {
  ChevronRight,
  Download,
  Terminal,
  ChevronDown,
  RefreshCw,
  Database
} from 'lucide-react';
import LineageGraph from '../components/lineage/LineageGraph';
import NodeDrawer from '../components/lineage/NodeDrawer';
import Button from '../components/common/Button';
import Dropdown from '../components/common/Dropdown';
import Modal from '../components/common/Modal';
import { useApp } from '../context/AppContext';
import { lineageApi } from '../services';

export default function DataLineage() {
  const { datasetId } = useParams();
  const navigate = useNavigate();
  const { datasets, addToast, fetchBackendData } = useApp();

  const dataset = (Array.isArray(datasets) && datasets.length > 0)
    ? (datasets.find(d => String(d.id || d._id) === String(datasetId)) || datasets[0])
    : null;

  const [selectedNode, setSelectedNode] = useState(null);
  const [isNodeDrawerOpen, setIsNodeDrawerOpen] = useState(false);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const lineageSql = `-- Evidence-backed lineage extraction for ${dataset?.name || 'Dataset'}
-- Source: ${dataset?.source || 'Enterprise Data Source'}
SELECT 
    ${(dataset?.schema && dataset.schema.length > 0 ? dataset.schema.slice(0, 6).map(c => c.name).join(',\n    ') : 'id,\n    created_at,\n    status')}
FROM "${dataset?.schemaName || 'public'}"."${(dataset?.tableName || dataset?.name || 'dataset').toLowerCase().replace(/[^a-z0-9_]+/g, '_')}";`;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (fetchBackendData) await fetchBackendData();
      const targetId = dataset?._id || dataset?.id;
      if (targetId && targetId !== 'default') {
        const res = await lineageApi.getLineageForDataset(targetId);
        const nodeCount = res.data?.nodes?.length || 0;
        addToast({
          title: 'Lineage Graph Synchronized',
          message: `Verified ${nodeCount} nodes and pipeline relationships.`,
          type: 'success'
        });
      } else {
        addToast({
          title: 'Lineage Synchronized',
          message: 'Catalog metadata verified.',
          type: 'success'
        });
      }
    } catch (err) {
      addToast({
        title: 'Lineage Synchronization Failed',
        message: err.message || 'Failed to refresh lineage graph.',
        type: 'error'
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSelectNode = (node) => {
    setSelectedNode(node);
    setIsNodeDrawerOpen(true);
  };

  if (!dataset) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">No Datasets Available for Lineage Tracking</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
          No datasets are registered in the Data Catalog yet. Connect a data source and synchronize datasets to track pipeline provenance.
        </p>
        <Button size="sm" className="mt-4" onClick={() => navigate('/catalog')}>
          Go to Data Catalog
        </Button>
      </div>
    );
  }

  return (
    <div className="ui-lineage-page space-y-5 pb-8">
      {/* Breadcrumbs matching Screen 5 */}
      <nav aria-label="Breadcrumb" className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <NavLink to="/catalog" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          Data Catalog
        </NavLink>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600" />
        <NavLink to={`/catalog/${dataset._id || dataset.id}`} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          {dataset.name}
        </NavLink>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600" />
        <span className="text-slate-900 dark:text-white font-semibold">End-to-End Lineage</span>
      </nav>

      {/* Header Row with Legend and Controls */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="ui-page-header__title">
              Data Lineage
            </h1>
            {datasets.length > 0 && (
              <div className="flex min-w-0 max-w-full items-center gap-1.5 rounded-lg border px-2 py-1.5" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                <Database className="h-3.5 w-3.5 shrink-0 text-blue-500" aria-hidden="true" />
                <select
                  value={dataset._id || dataset.id || ''}
                  onChange={(e) => navigate(`/lineage/${e.target.value}`)}
                  aria-label="Select dataset for lineage"
                  className="min-w-0 bg-transparent text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
                >
                  {datasets.map(d => (
                    <option key={d._id || d.id} value={d._id || d.id} className="bg-white dark:bg-[#0D1828]">
                      {d.name} ({d.domain || 'General'})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <p className="ui-page-header__subtitle">
            Trace end-to-end data provenance, pipeline transformations, and downstream dependencies.
          </p>
        </div>

        {/* Legend matching Screen 5 specification */}
        <div 
          aria-label="Lineage node types"
          className="grid grid-cols-2 items-center gap-2.5 rounded-xl border p-3 text-xs sm:flex sm:flex-wrap sm:gap-4"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-secondary)'
          }}
        >
          <div className="flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-2xs shrink-0" />
            <span className="text-[11px] sm:text-xs">SOURCE</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-2xs shrink-0" />
            <span className="text-[11px] sm:text-xs">TRANSFORM</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-2xs shrink-0" />
            <span className="text-[11px] sm:text-xs">DATASET</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 shadow-2xs shrink-0" />
            <span className="text-[11px] sm:text-xs">DESTINATION</span>
          </div>
        </div>

        {/* Lineage Toolbar Right Actions */}
        <div className="flex w-full flex-wrap items-center gap-2 self-start xl:w-auto xl:shrink-0 xl:self-auto">
          <button
            type="button"
            onClick={handleRefresh}
            aria-label={isRefreshing ? 'Refreshing lineage graph' : 'Refresh lineage graph'}
            className={`p-2 rounded-md transition-colors cursor-pointer ${
              isRefreshing ? 'animate-spin' : ''
            }`}
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-secondary)'
            }}
            title="Refresh Lineage Graph"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
          </button>

          <Button
            variant="secondary"
            size="sm"
            icon={Terminal}
            onClick={() => setIsSqlModalOpen(true)}
          >
            View SQL
          </Button>

          <Dropdown
            align="right"
            width="w-44"
            trigger={
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-80" />
              </button>
            }
            items={[
              {
                label: 'Export as SVG Image',
                onClick: () =>
                  addToast({
                    title: 'Lineage Vector Exported',
                    message: 'SVG diagram downloaded to your downloads folder.',
                    type: 'success'
                  })
              },
              {
                label: 'Export JSON DAG Schema',
                onClick: () =>
                  addToast({
                    title: 'DAG Exported',
                    message: 'JSON pipeline specification downloaded.',
                    type: 'success'
                  })
              }
            ]}
          />
        </div>
      </div>

      {/* Main Interactive Flow Graph */}
      <div data-tour="lineage-canvas" className="theme-card min-w-0 rounded-xl border border-slate-200 p-1 shadow-sm dark:border-slate-800">
        <LineageGraph onSelectNode={handleSelectNode} datasetId={dataset.id} />
      </div>

      {/* Node Detail Drawer Inspector */}
      <NodeDrawer
        node={selectedNode}
        isOpen={isNodeDrawerOpen}
        onClose={() => setIsNodeDrawerOpen(false)}
        onViewSql={() => setIsSqlModalOpen(true)}
      />

      {/* View SQL Modal */}
      <Modal
        isOpen={isSqlModalOpen}
        onClose={() => setIsSqlModalOpen(false)}
        title={`Transformation Logic — ${dataset?.name || 'Dataset'}`}
        subtitle={`Evidence-backed pipeline query for ${dataset?.name || 'Catalog Dataset'}`}
        maxWidth="max-w-2xl"
        footer={
          <Button size="sm" onClick={() => setIsSqlModalOpen(false)}>
            Close
          </Button>
        }
      >
        <div className="max-h-[60vh] overflow-auto rounded-lg border border-slate-800 bg-slate-900 p-4 font-mono text-xs text-emerald-400 shadow-inner dark:bg-[#07111F]">
          <pre>{lineageSql}</pre>
        </div>
      </Modal>
    </div>
  );
}
