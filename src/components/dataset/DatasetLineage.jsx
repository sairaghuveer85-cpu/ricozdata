import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { GitFork, Loader2, Database, Table, ArrowRight, ShieldCheck, CheckCircle2, Info } from 'lucide-react';
import Button from '../common/Button';
import { useApp } from '../../context/AppContext';

export default function DatasetLineage({ dataset }) {
  const { getDatasetLineage } = useApp();
  const [lineageGraph, setLineageGraph] = useState(null);
  const [loading, setLoading] = useState(true);

  const datasetId = dataset?._id || dataset?.id;

  useEffect(() => {
    let isMounted = true;
    async function fetchLineage() {
      if (!datasetId) {
        setLineageGraph(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const data = await getDatasetLineage(datasetId);
        if (isMounted) {
          setLineageGraph(data);
        }
      } catch (err) {
        console.warn('Failed to load dataset lineage:', err);
        if (isMounted) setLineageGraph(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchLineage();
    return () => { isMounted = false; };
  }, [datasetId, getDatasetLineage]);

  const nodes = lineageGraph?.nodes || [];
  const edges = lineageGraph?.edges || [];

  const sourceNode = nodes.find(n => n.data?.categoryType === 'source');
  const transformNode = nodes.find(n => n.data?.categoryType === 'transformation');
  const primaryNode = nodes.find(n => n.data?.isPrimary) || nodes.find(n => n.data?.categoryType === 'dataset');
  const upstreamDatasets = nodes.filter(n => n.data?.categoryType === 'dataset' && !n.data?.isPrimary);
  const destNodes = nodes.filter(n => n.data?.categoryType === 'destination');

  const upstreamFkEdges = edges.filter(e => e.data?.relationshipType === 'references');
  const downstreamFkEdges = edges.filter(e => e.data?.relationshipType === 'referenced_by');

  return (
    <div className="theme-card rounded-lg p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Lineage Map Overview</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Trace upstream data sources, schema foreign keys, and downstream analytics dependencies
          </p>
        </div>
        {datasetId && (
          <NavLink to={`/lineage/${datasetId}`}>
            <Button size="sm" icon={GitFork}>
              Open Interactive Lineage
            </Button>
          </NavLink>
        )}
      </div>

      {loading ? (
        <div className="bg-slate-50 dark:bg-slate-850/60 p-10 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
          <Loader2 className="w-7 h-7 animate-spin text-blue-500 mx-auto mb-2" />
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Loading verified lineage graph...</p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Retrieving authoritative metadata from catalog</p>
        </div>
      ) : nodes.length === 0 ? (
        <div className="bg-slate-50 dark:bg-slate-850/60 p-8 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
          <GitFork className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">No lineage relationships discovered from available source metadata</p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
            Upstream ingestion sources and downstream consumption pipelines have not been mapped for this dataset yet.
          </p>
        </div>
      ) : (
        <>
          {/* Visual Pipeline Summary Card */}
          <div className="bg-slate-50 dark:bg-slate-850/60 p-5 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Source */}
            <div className="bg-white dark:bg-[#0f172a] p-3 rounded-md border border-slate-200 dark:border-slate-700/80 text-center w-full md:w-52 shadow-2xs">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-1">Source</span>
              <span className="text-xs font-semibold text-slate-900 dark:text-white block truncate">
                {sourceNode?.data?.label || dataset.source || 'Direct Source'}
              </span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate block">
                {sourceNode?.data?.typeLabel || dataset.sourceType || dataset.format || 'Database'}
              </span>
            </div>

            <div className="text-slate-400 dark:text-slate-600 font-bold hidden md:block">→</div>

            {/* Upstream / Transformation */}
            <div className="bg-white dark:bg-[#0f172a] p-3 rounded-md border border-slate-200 dark:border-slate-700/80 text-center w-full md:w-52 shadow-2xs">
              {upstreamDatasets.length > 0 ? (
                <>
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block mb-1">
                    Upstream Dependency
                  </span>
                  <span className="text-xs font-semibold text-slate-900 dark:text-white block truncate">
                    {upstreamDatasets.map(u => u.data?.label).join(', ')}
                  </span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate block">
                    {upstreamDatasets.length} {upstreamDatasets.length === 1 ? 'Parent Table (Foreign Key)' : 'Parent Tables (Foreign Keys)'}
                  </span>
                </>
              ) : transformNode ? (
                <>
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block mb-1">Transformation</span>
                  <span className="text-xs font-semibold text-slate-900 dark:text-white block truncate">
                    {transformNode.data?.label || 'Direct Ingestion'}
                  </span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate block">
                    {transformNode.data?.typeLabel || 'No intermediate ETL'}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block mb-1">Ingestion Pipeline</span>
                  <span className="text-xs font-semibold text-slate-900 dark:text-white block truncate">
                    Direct Ingestion (Raw)
                  </span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate block">
                    Verified catalog synchronization
                  </span>
                </>
              )}
            </div>

            <div className="text-slate-400 dark:text-slate-600 font-bold hidden md:block">→</div>

            {/* This Dataset */}
            <div className="bg-blue-50/60 dark:bg-blue-950/40 p-3 rounded-md border border-blue-500/80 text-center w-full md:w-52 shadow-2xs">
              <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider block mb-1">This Dataset</span>
              <span className="text-xs font-semibold text-blue-950 dark:text-blue-200 block truncate">{dataset.name}</span>
              <span className="text-[11px] text-blue-600 dark:text-blue-400">{dataset.rows ?? dataset.rowCount ?? 0} rows</span>
            </div>

            <div className="text-slate-400 dark:text-slate-600 font-bold hidden md:block">→</div>

            {/* Downstream */}
            <div className="bg-white dark:bg-[#0f172a] p-3 rounded-md border border-slate-200 dark:border-slate-700/80 text-center w-full md:w-52 shadow-2xs">
              <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider block mb-1">
                {destNodes.length} {destNodes.length === 1 ? 'Destination' : 'Destinations'}
              </span>
              <span className="text-xs font-semibold text-slate-900 dark:text-white block truncate">
                {destNodes.length > 0 ? destNodes.map(d => d.data?.label).join(', ') : 'None mapped'}
              </span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate block">
                {destNodes.length > 1
                  ? `+${destNodes.length - 1} other consumer(s)`
                  : destNodes.length === 1
                  ? 'Active Dependent Table'
                  : 'No downstream consumers'}
              </span>
            </div>
          </div>

          {/* Detailed Relationships & Metadata Breakdown */}
          <div className="space-y-4 pt-2">
            <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Discovered Relationships & Schema Dependencies
            </h4>

            {/* Upstream Section */}
            <div className="bg-white dark:bg-[#0f172a] rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-emerald-500" />
                  Upstream Lineage & Ingestion Sources
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {1 + upstreamDatasets.length} registered upstream source(s)
                </span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                {/* Source connection entry */}
                <div className="p-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-900 dark:text-white block truncate">
                      {sourceNode?.data?.label || dataset.source || 'Enterprise Database'}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Source Type: {sourceNode?.data?.typeLabel || dataset.sourceType || 'POSTGRESQL'} • Schema: {dataset.schemaName || 'public'}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                      Direct Ingestion
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 block mt-0.5">Incoming</span>
                  </div>
                </div>

                {/* Upstream dataset parent foreign key entries */}
                {upstreamDatasets.map(up => {
                  const edge = upstreamFkEdges.find(e => e.source === `dataset-${up.data?.datasetId}`);
                  return (
                    <div key={up.id} className="p-3 flex items-center justify-between gap-4 bg-blue-50/20 dark:bg-blue-950/10">
                      <div className="min-w-0">
                        <NavLink
                          to={`/catalog/${up.data?.datasetId}`}
                          className="font-semibold text-blue-600 dark:text-blue-400 hover:underline block truncate"
                        >
                          {up.data?.label}
                        </NavLink>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {edge?.data?.evidence || `Parent table relationship via foreign key`}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                          Foreign Key Parent
                        </span>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 block mt-0.5">Upstream (Incoming)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Downstream Section */}
            <div className="bg-white dark:bg-[#0f172a] rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Table className="w-3.5 h-3.5 text-cyan-500" />
                  Downstream Lineage & Dependent Datasets
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {destNodes.length} active consumer(s)
                </span>
              </div>
              {destNodes.length > 0 ? (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                  {destNodes.map(dest => {
                    const edge = downstreamFkEdges.find(e => e.target === `dataset-${dest.data?.datasetId}`);
                    return (
                      <div key={dest.id} className="p-3 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <NavLink
                            to={`/catalog/${dest.data?.datasetId}`}
                            className="font-semibold text-cyan-600 dark:text-cyan-400 hover:underline block truncate"
                          >
                            {dest.data?.label}
                          </NavLink>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            {edge?.data?.evidence || `Referencing table via foreign key dependency`}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/60">
                            Foreign Key Dependent
                          </span>
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 block mt-0.5">Downstream (Outgoing)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 text-center text-xs text-slate-400 dark:text-slate-500">
                  No downstream dependent tables discovered in source schema.
                </div>
              )}
            </div>

            {/* Standalone Entity Explanation (For datasets with no inter-table foreign keys, like dq_quality_test) */}
            {upstreamDatasets.length === 0 && destNodes.length === 0 && (
              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
                <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  <span className="font-semibold text-slate-900 dark:text-white block">
                    Standalone Table Structure
                  </span>
                  No inter-table foreign keys or cross-dataset dependencies were discovered from the external PostgreSQL schema. This dataset operates as an independent table in schema &quot;{dataset.schemaName || 'public'}&quot;.
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
