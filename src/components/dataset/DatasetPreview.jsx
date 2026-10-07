import React, { useState, useEffect } from 'react';
import { Eye, RefreshCw, AlertCircle, Database, FileText, Code2, Table } from 'lucide-react';
import Button from '../common/Button';
import datasetApi from '../../services/datasetApi';

export default function DatasetPreview({ dataset }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const datasetId = dataset?.id || dataset?._id;
  const sourceType = (dataset?.sourceType || dataset?.sourceDetails?.rawType || '').toLowerCase();
  const isMongo = sourceType === 'mongodb' || dataset?.type === 'collection';
  const isS3 = sourceType === 's3' || dataset?.type === 'file';

  const fetchPreview = async () => {
    if (!datasetId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await datasetApi.getDatasetPreview(datasetId, 25);
      if (res?.success && res.data) {
        setData(res.data);
      } else {
        setError(res?.error?.message || 'Unable to retrieve preview records from external source.');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch live sample data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPreview();
  }, [datasetId]);

  const rows = data?.rows || [];
  const columns = data?.columns || (rows.length > 0 && typeof rows[0] === 'object' && !Array.isArray(rows[0]) ? Object.keys(rows[0]) : []);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg bg-white dark:bg-[#0D1828] border border-slate-200 dark:border-[#1D3047] shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Live Source Data Preview
            </h3>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {dataset?.sourceDetails?.type || dataset?.sourceType || 'External Source'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isMongo
              ? 'Bounded sample documents retrieved live from MongoDB collection'
              : isS3
              ? 'Bounded object/file lines retrieved live from Amazon S3'
              : 'Bounded sample rows retrieved live from relational source table'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {data && (
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              {data.returnedCount ?? rows.length} records sample
            </span>
          )}
          <Button
            size="sm"
            variant="secondary"
            icon={RefreshCw}
            loading={loading}
            onClick={fetchPreview}
          >
            Refresh Preview
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 space-y-3 rounded-lg border border-slate-200 dark:border-[#1D3047] bg-white dark:bg-[#0D1828]">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Querying bounded preview sample from {dataset?.source || 'data source'}...
          </span>
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-50/30 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-lg text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
            Source Preview Unavailable
          </h4>
          <p className="text-xs text-rose-600 dark:text-rose-400 max-w-lg mx-auto">
            {error}
          </p>
          <div className="pt-2">
            <Button size="xs" variant="secondary" onClick={fetchPreview}>
              Retry Connection
            </Button>
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="p-12 text-center rounded-lg border border-slate-200 dark:border-[#1D3047] bg-white dark:bg-[#0D1828] space-y-2">
          <Database className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
            No sample records found in source asset.
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            The target table, collection, or file may currently be empty.
          </p>
        </div>
      ) : isMongo ? (
        /* MongoDB Document View */
        <div className="space-y-3">
          {rows.map((doc, idx) => (
            <div
              key={idx}
              className="p-3 rounded-lg border border-slate-200 dark:border-[#1D3047] bg-white dark:bg-[#0D1828] font-mono text-xs overflow-x-auto"
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
                <span className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                  <Code2 className="w-3.5 h-3.5" /> Document #{idx + 1}
                </span>
                {doc._id && <span>_id: {String(doc._id)}</span>}
              </div>
              <pre className="text-slate-800 dark:text-slate-200 text-[11px] whitespace-pre-wrap">
                {JSON.stringify(doc, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      ) : (
        /* Relational Tabular / S3 Structured Grid */
        <div className="rounded-lg border border-slate-200 dark:border-[#1D3047] bg-white dark:bg-[#0D1828] overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-[#111C2E] border-b border-slate-200 dark:border-[#1D3047]">
                  <th className="py-2.5 px-3 font-semibold text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider w-12 text-center">
                    #
                  </th>
                  {columns.map((col) => (
                    <th
                      key={col}
                      className="py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-300 text-[11px] whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                {rows.map((row, rIdx) => (
                  <tr
                    key={rIdx}
                    className="hover:bg-slate-50/60 dark:hover:bg-[#111E30]/40 transition-colors"
                  >
                    <td className="py-2 px-3 text-slate-400 text-center text-[10px] select-none">
                      {rIdx + 1}
                    </td>
                    {columns.map((col) => {
                      const val = row[col];
                      const display =
                        val === null || val === undefined
                          ? <span className="text-slate-400 italic">null</span>
                          : typeof val === 'object'
                          ? JSON.stringify(val)
                          : String(val);

                      return (
                        <td
                          key={col}
                          className="py-2 px-3 text-slate-800 dark:text-slate-200 text-xs whitespace-nowrap max-w-xs truncate"
                          title={typeof val === 'string' ? val : ''}
                        >
                          {display}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
