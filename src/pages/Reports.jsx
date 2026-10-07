import React, { useMemo } from 'react';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/common/Button';
import { Download, FileText, CheckCircle2, ShieldCheck, Database, FileSpreadsheet, Clock } from 'lucide-react';
import { useApp } from '../context/AppContext';

function formatCell(val, fallback = '') {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object') {
    if (typeof val.toHexString === 'function') return val.toHexString();
    if (typeof val.toString === 'function' && val.toString() !== '[object Object]') {
      const s = val.toString();
      if (s && s !== '[object Object]') return s;
    }
    if (val.name) return String(val.name);
    if (val.title) return String(val.title);
    if (val.email) return String(val.email);
    if (val._id) return formatCell(val._id);
    if (val.id && typeof val.id === 'string') return val.id;
    if (Array.isArray(val)) return val.map(v => formatCell(v)).join('; ');
    try {
      return JSON.stringify(val);
    } catch {
      return fallback;
    }
  }
  return String(val);
}

function downloadCsv(filename, rows) {
  if (!rows || rows.length === 0) return;
  const headers = Object.keys(rows[0]).join(',');
  const csvContent = [
    headers,
    ...rows.map(row => Object.values(row).map(val => `"${formatCell(val).replace(/"/g, '""')}"`).join(','))
  ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function Reports() {
  const { datasets, policies, activities, activityTotalCount, qualityRules, users, addToast } = useApp();

  const handleExportCatalog = () => {
    if (!datasets || datasets.length === 0) {
      addToast({ title: 'Export Notice', message: 'No registered datasets available to export.', type: 'info' });
      return;
    }
    const rows = datasets.map(d => {
      const rowsNum = parseInt(d.rows || d.rowCount || '0', 10);
      const colsNum = Number(d.columnsCount || (d.schema ? d.schema.length : (d.columns ? d.columns.length : 0)));
      const hasZeroData = rowsNum === 0 && colsNum === 0;

      let qualityDisplay;
      if (hasZeroData && (d.qualityScore === 100 || d.quality === 100)) {
        qualityDisplay = 'NOT ASSESSED';
      } else if (d.qualityScore != null || d.quality != null) {
        qualityDisplay = `${d.qualityScore ?? d.quality}%`;
      } else {
        qualityDisplay = 'NOT ASSESSED';
      }

      return {
        ID: formatCell(d.id || d._id, 'N/A'),
        Name: formatCell(d.name, 'Unnamed Dataset'),
        Source: formatCell(d.source, 'Warehouse'),
        Domain: formatCell(d.domain || d.domainId, 'General'),
        Rows: d.rows || d.rowCount || '0',
        Columns: colsNum,
        QualityScore: qualityDisplay,
        Sensitivity: formatCell(d.sensitivity, 'Internal'),
        Status: formatCell(d.status, 'Active'),
        LastUpdated: d.updated || d.updatedAt || 'N/A'
      };
    });
    downloadCsv(`RicozData_Catalog_Inventory_${new Date().toISOString().split('T')[0]}.csv`, rows);
    addToast({ title: 'Export Complete', message: `Exported ${rows.length} cataloged datasets to CSV.`, type: 'success' });
  };

  const handleExportQuality = () => {
    const rulesToExport = qualityRules && qualityRules.length > 0 ? qualityRules : [];
    if (rulesToExport.length === 0) {
      addToast({ title: 'Export Notice', message: 'No quality rules recorded to export.', type: 'info' });
      return;
    }
    const rows = rulesToExport.map(r => {
      const datasetRef = typeof r.datasetId === 'object' && r.datasetId !== null
        ? (r.datasetId.name || r.datasetId._id || 'Global')
        : (r.datasetId || 'Global');

      return {
        RuleID: formatCell(r.id || r._id, 'N/A'),
        Name: formatCell(r.name, 'Unnamed Rule'),
        Dataset: formatCell(datasetRef, 'Global'),
        Column: formatCell(r.field || r.targetColumn, 'All columns'),
        ConstraintType: formatCell(r.ruleType || r.type, 'VALIDATION'),
        Threshold: `${r.threshold ?? 95}%`,
        Severity: formatCell(r.severity, 'Medium'),
        LastResult: formatCell(r.lastResult || r.status, 'Pending'),
        Status: r.enabled ? 'Enabled' : 'Disabled'
      };
    });
    downloadCsv(`RicozData_Quality_SLA_${new Date().toISOString().split('T')[0]}.csv`, rows);
    addToast({ title: 'Export Complete', message: `Exported ${rows.length} quality rules and results to CSV.`, type: 'success' });
  };

  const handleExportGovernance = () => {
    if (!policies || policies.length === 0) {
      addToast({ title: 'Export Notice', message: 'No governance policies available to export.', type: 'info' });
      return;
    }
    const rows = policies.map(p => ({
      PolicyID: formatCell(p.id || p._id, 'N/A'),
      Name: formatCell(p.name, 'Unnamed Policy'),
      Description: formatCell(p.description, ''),
      Category: formatCell(p.category, 'Data Protection'),
      Status: formatCell(p.status, 'Active'),
      EnforcementLevel: formatCell(p.enforcementLevel || p.severity, 'Automated'),
      AppliesTo: formatCell(p.appliesTo, 'All Datasets')
    }));
    downloadCsv(`RicozData_Governance_Policies_${new Date().toISOString().split('T')[0]}.csv`, rows);
    addToast({ title: 'Export Complete', message: `Exported ${rows.length} governance policies to CSV.`, type: 'success' });
  };

  const handleExportActivities = () => {
    if (!activities || activities.length === 0) {
      addToast({ title: 'Export Notice', message: 'No activity logs available to export.', type: 'info' });
      return;
    }
    const rows = activities.map(a => {
      let targetName = 'System';
      if (typeof a.target === 'string' && a.target.trim()) {
        targetName = a.target.trim();
      } else if (a.target && typeof a.target === 'object') {
        targetName = a.target.name || a.target.title || a.target._id || 'System';
      } else if (a.datasetId && typeof a.datasetId === 'object') {
        targetName = a.datasetId.name || a.datasetId._id || 'System';
      } else if (typeof a.datasetId === 'string' && a.datasetId.trim()) {
        targetName = a.datasetId.trim();
      } else if (a.metadata && typeof a.metadata === 'object') {
        targetName = a.metadata.dataSourceName || a.metadata.name || a.metadata.term || 'System';
      }

      let actorName = 'Administrator';
      if (typeof a.user === 'string' && a.user.trim()) {
        actorName = a.user.trim();
      } else if (typeof a.actor === 'string' && a.actor.trim()) {
        actorName = a.actor.trim();
      } else if (a.actorId && typeof a.actorId === 'object') {
        actorName = a.actorId.name || a.actorId.email || a.actorId._id || 'Administrator';
      } else if (typeof a.actorId === 'string' && a.actorId.trim()) {
        actorName = a.actorId.trim();
      }

      let formattedTimestamp = 'Recently';
      if (a.timestamp) {
        try {
          formattedTimestamp = new Date(a.timestamp).toISOString();
        } catch {
          formattedTimestamp = String(a.timestamp);
        }
      } else if (a.time) {
        formattedTimestamp = String(a.time);
      }

      return {
        ActivityID: formatCell(a.id || a._id, 'N/A'),
        Action: formatCell(a.title || a.action, 'System Event'),
        Target: formatCell(targetName, 'System'),
        Actor: formatCell(actorName, 'Administrator'),
        Timestamp: formattedTimestamp
      };
    });
    downloadCsv(`RicozData_System_Audit_Log_${new Date().toISOString().split('T')[0]}.csv`, rows);
    addToast({ title: 'Export Complete', message: `Exported ${rows.length} system audit logs to CSV.`, type: 'success' });
  };

  const reportCards = [
    {
      title: 'Enterprise Catalog Inventory',
      description: 'Comprehensive export of all registered datasets, schemas, schemas count, row counts, and verified sources.',
      recordCount: `${datasets.length} datasets`,
      type: 'CSV',
      action: handleExportCatalog,
      icon: Database
    },
    {
      title: 'Data Quality & SLA Compliance',
      description: 'Audit report of validation rules, thresholds, execution outcomes, and dataset quality ratings.',
      recordCount: `${qualityRules?.length || 0} validation rules`,
      type: 'CSV',
      action: handleExportQuality,
      icon: FileSpreadsheet
    },
    {
      title: 'Governance & Access Control Log',
      description: 'Full registry of active security policies, enforcement levels, RBAC entitlements, and compliance coverage.',
      recordCount: `${policies.filter(p => p.status === 'active').length} active policies`,
      type: 'CSV',
      action: handleExportGovernance,
      icon: ShieldCheck
    },
    {
      title: 'System Activity & Ingestion Audit',
      description: 'Immutable historical audit trail of user actions, catalog modifications, and pipeline sync operations.',
      recordCount: `${activities.length} logged activities`,
      type: 'CSV',
      action: handleExportActivities,
      icon: Clock
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Compliance Audits"
        subtitle="Export verified production snapshots, data quality SLA certifications, and governance audit records."
        actions={
          <Button
            size="md"
            icon={Download}
            onClick={handleExportCatalog}
            className="w-full sm:w-auto"
          >
            Export Catalog Summary
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reportCards.map((rep, idx) => {
          const Icon = rep.icon;
          return (
            <div
              key={idx}
              className="enterprise-panel rounded-lg p-4 sm:p-5 flex flex-col justify-between gap-4"
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0" aria-hidden="true">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">{rep.title}</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{rep.description}</p>
                  <span className="inline-block mt-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">{rep.recordCount}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end">
                <Button
                  variant="secondary"
                  size="xs"
                  icon={Download}
                  aria-label={`Export ${rep.title} as ${rep.type}`}
                  onClick={rep.action}
                  className="shrink-0 justify-center"
                >
                  Export {rep.type}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Audit Log Stream */}
      <div className="enterprise-panel rounded-lg p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Recent System Audit Stream
          </h3>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {(activityTotalCount || activities.length).toLocaleString()} total events
            </span>
            {activities.length > 0 && (
              <>
                <span className="text-slate-300 dark:text-slate-600">&bull;</span>
                <span>Showing latest {activities.length}</span>
              </>
            )}
          </div>
        </div>

        {activities.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
            No audit activities logged in current session. Operations will appear here automatically.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-[#1D3047] text-xs">
            {activities.slice(0, 30).map(act => (
              <div key={act.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{act.title}</span>
                  {act.target && (
                    <span className="text-slate-500 dark:text-slate-400 ml-1.5 sm:ml-2">({act.target})</span>
                  )}
                  {act.user && (
                    <span className="text-slate-400 dark:text-slate-500 text-[11px] ml-2">by {act.user}</span>
                  )}
                </div>
                <div className="text-slate-400 dark:text-slate-500 text-[11px] shrink-0">
                  {act.timestamp ? new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (act.time || 'Recently')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
