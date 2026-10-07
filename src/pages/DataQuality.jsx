import React, { useState } from 'react';
import { useParams, useNavigate, NavLink } from 'react-router-dom';
import { ChevronRight, Play, Loader2, RefreshCw, Database } from 'lucide-react';
import QualityScore from '../components/quality/QualityScore';
import QualityMetrics from '../components/quality/QualityMetrics';
import QualityIssues from '../components/quality/QualityIssues';
import QualityTrends from '../components/quality/QualityTrends';
import RulesTable from '../components/governance/RulesTable';
import Button from '../components/common/Button';
import { useApp } from '../context/AppContext';

export default function DataQuality() {
  const { datasetId } = useParams();
  const navigate = useNavigate();
  const { datasets, getQualityForDataset, evaluateDatasetQuality } = useApp();

  const dataset = (Array.isArray(datasets) && datasets.length > 0)
    ? (datasets.find(d => String(d.id || d._id) === String(datasetId)) || datasets[0])
    : null;
  const currentDatasetId = dataset ? (dataset.id || dataset._id) : null;
  const quality = (getQualityForDataset && currentDatasetId) ? getQualityForDataset(currentDatasetId) : null;

  const [activeTab, setActiveTab] = useState('issues');
  const [timeRange, setTimeRange] = useState('Last 30 days');
  const [evaluating, setEvaluating] = useState(false);

  const handleEvaluate = async () => {
    if (!currentDatasetId) return;
    setEvaluating(true);
    try {
      if (evaluateDatasetQuality) {
        await evaluateDatasetQuality(currentDatasetId);
      }
    } catch (err) {
      console.warn('Evaluation failed:', err);
    } finally {
      setEvaluating(false);
    }
  };

  if (!dataset) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">No Datasets Available for Quality Analysis</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
          No datasets are registered in the Data Catalog yet. Connect a data source and synchronize datasets to track data quality.
        </p>
        <Button size="sm" className="mt-4" onClick={() => navigate('/catalog')}>
          Go to Data Catalog
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <nav 
        className="flex items-center gap-1.5 text-xs"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <NavLink to="/catalog" className="hover:underline transition-colors" style={{ color: 'var(--color-text-secondary)' }}>
          Data Catalog
        </NavLink>
        <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--color-text-muted)' }} />
        <NavLink to={`/catalog/${dataset.id}`} className="hover:underline transition-colors" style={{ color: 'var(--color-text-secondary)' }}>
          {dataset.name}
        </NavLink>
        <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--color-text-muted)' }} />
        <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>Data Quality</span>
      </nav>

      {/* Header Row with Timeframe Dropdown & Evaluate Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 
              className="text-xl sm:text-2xl font-bold tracking-tight"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Data Quality
            </h1>
            {datasets.length > 0 && (
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700">
                <Database className="w-3.5 h-3.5 text-blue-500" />
                <select
                  value={dataset.id || dataset._id || ''}
                  onChange={(e) => navigate(`/quality/${e.target.value}`)}
                  className="bg-transparent text-xs font-semibold text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                >
                  {datasets.map(d => (
                    <option key={d.id || d._id} value={d.id || d._id} className="bg-white dark:bg-[#0D1828]">
                      {d.name} ({d.qualityScore ?? d.quality ?? 0}%)
                    </option>
                  ))}
                </select>
              </div>
            )}
            {(dataset.source || dataset.sourceSystem || quality?.sourceType) && (
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800 uppercase tracking-wider">
                {dataset.source || dataset.sourceSystem || quality?.sourceType}
              </span>
            )}
          </div>
          <p 
            className="mt-1 text-xs sm:text-sm"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Real-time quality validation, schema constraints, and SLA compliance for {dataset.name} on {dataset.source || dataset.sourceSystem || quality?.sourceType || 'Data Source'}.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            size="sm"
            onClick={handleEvaluate}
            disabled={evaluating}
            icon={evaluating ? Loader2 : Play}
            className={evaluating ? 'opacity-80' : ''}
          >
            {evaluating ? 'Evaluating...' : 'Run Evaluation'}
          </Button>

          {/* Timeframe Dropdown */}
          <div className="relative inline-block">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer focus:outline-none"
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)'
              }}
            >
              <option value="Last 7 days">Last 7 days</option>
              <option value="Last 30 days">Last 30 days</option>
              <option value="Last 90 days">Last 90 days</option>
              <option value="Year to date">Year to date</option>
            </select>
          </div>
        </div>
      </div>

      {/* Top Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <QualityScore
            score={dataset?.qualityScore ?? dataset?.quality ?? quality?.score ?? null}
            grade={quality?.grade || (dataset?.qualityScore != null ? (dataset.qualityScore >= 95 ? 'Excellent' : dataset.qualityScore >= 90 ? 'Good' : dataset.qualityScore >= 75 ? 'Fair' : 'At Risk') : 'Unrated')}
            trend={quality?.trendText || (dataset?.qualityScore != null ? 'Verified live PostgreSQL evaluation' : 'Run evaluation to calculate score')}
          />
        </div>
        <div className="lg:col-span-2">
          <QualityMetrics dimensions={dataset?.dimensions || quality?.dimensions || []} />
        </div>
      </div>

      {/* Bottom Tabs */}
      <div className="space-y-4">
        <div className="border-b border-slate-200 dark:border-slate-800 -mx-3.5 px-3.5 sm:mx-0 sm:px-0">
          <nav className="flex space-x-6 overflow-x-auto no-scrollbar py-0.5">
            {[
              { id: 'issues', label: 'Issues' },
              { id: 'rules', label: 'Quality Rules' },
              { id: 'trends', label: 'Trends' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`
                  py-3 px-1 border-b-2 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0
                  ${activeTab === tab.id
                    ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
                  }
                `}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'issues' && <QualityIssues datasetId={currentDatasetId} />}
        {activeTab === 'rules' && <RulesTable activeSubTab="rules" datasetId={currentDatasetId} />}
        {activeTab === 'trends' && <QualityTrends datasetId={currentDatasetId} timeRange={timeRange} />}
      </div>
    </div>
  );
}
