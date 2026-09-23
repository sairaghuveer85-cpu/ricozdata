import React, { useState } from 'react';
import { useParams, NavLink } from 'react-router-dom';
import {
  ChevronRight,
  Download,
  Terminal,
  ChevronDown,
  RefreshCw
} from 'lucide-react';
import LineageGraph from '../components/lineage/LineageGraph';
import NodeDrawer from '../components/lineage/NodeDrawer';
import Button from '../components/common/Button';
import Dropdown from '../components/common/Dropdown';
import Modal from '../components/common/Modal';
import { useApp } from '../context/AppContext';

export default function DataLineage() {
  const { datasetId } = useParams();
  const { datasets, addToast } = useApp();

  const dataset = datasets.find(d => d.id === datasetId) || datasets[0];

  const [selectedNode, setSelectedNode] = useState(null);
  const [isNodeDrawerOpen, setIsNodeDrawerOpen] = useState(false);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const lineageSql = `-- Upstream dbt transformation model: models/marts/customer_database.sql
WITH raw_salesforce_contacts AS (
    SELECT 
        id AS contact_id,
        email,
        firstname AS first_name,
        lastname AS last_name,
        phone AS phone_number,
        createddate AS signup_date
    FROM {{ source('salesforce', 'contact') }}
),

scored_churn AS (
    SELECT
        customer_id,
        churn_risk_score,
        tier
    FROM {{ ref('int_churn_scoring') }}
)

SELECT 
    c.contact_id AS customer_id,
    c.email,
    c.first_name,
    c.last_name,
    c.phone_number,
    c.signup_date,
    s.tier,
    s.churn_risk_score
FROM raw_salesforce_contacts c
LEFT JOIN scored_churn s ON c.contact_id = s.customer_id;`;

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      addToast({
        title: 'Lineage Graph Synchronized',
        message: 'All 6 nodes and dependencies re-verified with warehouse catalog.',
        type: 'success'
      });
    }, 600);
  };

  const handleSelectNode = (node) => {
    setSelectedNode(node);
    setIsNodeDrawerOpen(true);
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Breadcrumbs matching Screen 5 */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <NavLink to="/catalog" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          Data Catalog
        </NavLink>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600" />
        <NavLink to={`/catalog/${dataset.id}`} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          {dataset.name}
        </NavLink>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600" />
        <span className="text-slate-900 dark:text-white font-semibold">End-to-End Lineage</span>
      </nav>

      {/* Header Row with Legend and Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Data Lineage
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Trace end-to-end data provenance, pipeline transformations, and downstream dependencies.
          </p>
        </div>

        {/* Legend matching Screen 5 specification */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2.5 sm:gap-4 text-xs text-slate-600 dark:text-slate-300 p-2.5 rounded-lg bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800">
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
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleRefresh}
            className={`p-2 rounded-md bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer ${
              isRefreshing ? 'animate-spin' : ''
            }`}
            title="Refresh Lineage Graph"
          >
            <RefreshCw className="w-4 h-4" />
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
      <div className="theme-card rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs p-1">
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
        title="dbt Mart Transformation Logic"
        subtitle="Upstream compilation for Customer Database"
        maxWidth="max-w-2xl"
        footer={
          <Button size="sm" onClick={() => setIsSqlModalOpen(false)}>
            Close
          </Button>
        }
      >
        <div className="bg-slate-900 dark:bg-[#07111F] rounded-md p-4 text-emerald-400 font-mono text-xs overflow-x-auto shadow-inner border border-slate-800">
          <pre>{lineageSql}</pre>
        </div>
      </Modal>
    </div>
  );
}
