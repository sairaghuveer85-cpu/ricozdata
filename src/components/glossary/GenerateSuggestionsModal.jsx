import React, { useState, useEffect } from 'react';
import { Sparkles, Database, Layers, AlertCircle } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import datasetApi from '../../services/datasetApi';

export default function GenerateSuggestionsModal({ isOpen, onClose, onGenerate }) {
  const [scope, setScope] = useState('all'); // 'all' | 'dataset'
  const [selectedDatasetId, setSelectedDatasetId] = useState('');
  const [datasets, setDatasets] = useState([]);
  const [loadingDatasets, setLoadingDatasets] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      fetchDatasets();
    }
  }, [isOpen]);

  const fetchDatasets = async () => {
    setLoadingDatasets(true);
    try {
      const res = await datasetApi.getDatasets({ limit: 100 });
      const envelope = (res && res.success !== undefined) ? res : (res?.data || {});
      const items = Array.isArray(envelope.data) 
        ? envelope.data 
        : (envelope.data?.items || envelope.data?.datasets || []);
      setDatasets(items);
      if (items.length > 0 && !selectedDatasetId) {
        setSelectedDatasetId(items[0]._id || items[0].id);
      }
    } catch (err) {
      console.error('Failed to load datasets for suggestion generation:', err);
    } finally {
      setLoadingDatasets(false);
    }
  };

  const handleStartGeneration = async () => {
    setError(null);
    setGenerating(true);
    try {
      const payload = {};
      if (scope === 'dataset') {
        if (!selectedDatasetId) {
          setError('Please select a dataset to analyze.');
          setGenerating(false);
          return;
        }
        payload.datasetId = selectedDatasetId;
      }

      await onGenerate(payload);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to generate suggestions');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Generate Glossary Suggestions"
      subtitle="Analyze Data Catalog metadata using semantic rules and pattern recognition to discover candidate business terms."
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={generating}>
            Cancel
          </Button>
          <Button
            size="sm"
            icon={Sparkles}
            onClick={handleStartGeneration}
            disabled={generating || (scope === 'dataset' && !selectedDatasetId)}
          >
            {generating ? 'Analyzing Metadata...' : 'Run Analysis'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 text-xs rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
          <div className="font-semibold flex items-center gap-1.5 mb-1 text-blue-800 dark:text-blue-300">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Advisory Semantic Discovery</span>
          </div>
          Suggestions will be placed in the review queue. No authoritative glossary terms will be created or modified without human verification.
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Analysis Scope
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setScope('all')}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                scope === 'all'
                  ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 font-medium text-xs mb-1">
                <Layers className="w-4 h-4 text-blue-500" />
                <span>All Catalog Datasets</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Scan all registered datasets and embedded columns across the enterprise catalog.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setScope('dataset')}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                scope === 'dataset'
                  ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 font-medium text-xs mb-1">
                <Database className="w-4 h-4 text-blue-500" />
                <span>Single Dataset</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Target analysis to a specific dataset for rapid scoped discovery and inspection.
              </p>
            </button>
          </div>
        </div>

        {scope === 'dataset' && (
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Select Dataset
            </label>
            {loadingDatasets ? (
              <div className="text-xs text-slate-400 animate-pulse py-2">Loading catalog datasets...</div>
            ) : (
              <select
                value={selectedDatasetId}
                onChange={(e) => setSelectedDatasetId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] text-xs text-slate-900 dark:text-white py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                {datasets.map((ds) => (
                  <option key={ds._id || ds.id} value={ds._id || ds.id}>
                    {ds.name} ({ds.dataSourceName || ds.source || 'Dataset'} · {ds.columns?.length || 0} cols)
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
