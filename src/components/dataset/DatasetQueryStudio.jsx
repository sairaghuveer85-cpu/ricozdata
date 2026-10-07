import React, { useState } from 'react';
import { Play, RotateCcw, AlertCircle, Database, CheckCircle2, Terminal, Code2 } from 'lucide-react';
import Button from '../common/Button';
import datasetApi from '../../services/datasetApi';

export default function DatasetQueryStudio({ dataset }) {
  const sourceType = (dataset?.sourceType || dataset?.sourceDetails?.rawType || '').toLowerCase();
  const isMongo = sourceType === 'mongodb' || dataset?.type === 'collection';
  const isS3 = sourceType === 's3' || dataset?.type === 'file';
  const isMySQL = sourceType === 'mysql';
  const isSqlServer = sourceType === 'sqlserver';

  const defaultQuery = () => {
    if (isMongo) {
      return '{\n  "status": { "$exists": true }\n}';
    }
    const schema = dataset?.schemaName || dataset?.sourceDetails?.schema || (isMySQL ? '' : (isSqlServer ? 'dbo' : 'public'));
    const tableName = dataset?.tableName || dataset?.name;

    if (isSqlServer) {
      const safeTable = `[${(tableName || 'table').replace(/\]/g, ']]')}]`;
      if (schema) {
        const safeSchema = `[${schema.replace(/\]/g, ']]')}]`;
        return `SELECT TOP 50 *\nFROM ${safeSchema}.${safeTable};`;
      }
      return `SELECT TOP 50 *\nFROM ${safeTable};`;
    }

    if (isMySQL) {
      const safeTable = `\`${(tableName || 'table').replace(/`/g, '``')}\``;
      if (schema) {
        const safeDb = `\`${schema.replace(/`/g, '``')}\``;
        return `SELECT *\nFROM ${safeDb}.${safeTable}\nLIMIT 50;`;
      }
      return `SELECT *\nFROM ${safeTable}\nLIMIT 50;`;
    }

    const safeSchema = `"${schema.replace(/"/g, '""')}"`;
    const safeTable = `"${tableName.replace(/"/g, '""')}"`;
    return `SELECT *\nFROM ${safeSchema}.${safeTable}\nLIMIT 50;`;
  };

  const [query, setQuery] = useState(defaultQuery);
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const datasetId = dataset?._id || dataset?.id;

  const handleExecute = async () => {
    if (!datasetId || !query.trim()) return;
    setIsExecuting(true);
    setError(null);
    setResult(null);

    try {
      const res = await datasetApi.executeQuery(datasetId, query.trim(), 50);
      const resData = res?.data || res;
      if (res && (res.success || resData.rows || resData.columns)) {
        setResult(res.data?.data || res.data || res);
      } else {
        const errObj = res?.error || res?.data?.error || {};
        setError({
          title: errObj.code || 'Query Execution Error',
          message: errObj.message || 'The external data source rejected the query.',
          hint: errObj.details?.hint || errObj.details?.detail || null
        });
      }
    } catch (err) {
      const errResponse = err.response?.data || {};
      const errDetail = errResponse.error || errResponse;
      setError({
        title: errDetail.code || 'Connection Error',
        message: errDetail.message || err.message || 'Failed to communicate with data source.',
        hint: errDetail.details?.detail || errDetail.details?.hint || 'Verify the external data engine is online and network credentials are valid.'
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const rows = result?.rows || [];
  const columns = result?.columns || (rows.length > 0 && typeof rows[0] === 'object' && !Array.isArray(rows[0]) ? Object.keys(rows[0]) : []);

  return (
    <div className="space-y-4">
      {/* Studio Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg bg-white dark:bg-[#0D1828] border border-slate-200 dark:border-[#1D3047] shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-500" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Interactive Query Studio
            </h3>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              {isMongo ? 'MongoDB Query' : isS3 ? 'S3 Object Query' : 'Read-Only SQL'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isMongo
              ? 'Execute safe JSON queries against the live MongoDB collection.'
              : isS3
              ? 'Execute bounded queries against S3 structured object storage.'
              : 'Execute read-only SQL queries against the external database through connection pools.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            icon={RotateCcw}
            onClick={() => setQuery(defaultQuery())}
          >
            Reset
          </Button>
          <Button
            size="sm"
            icon={Play}
            loading={isExecuting}
            onClick={handleExecute}
          >
            Execute Query
          </Button>
        </div>
      </div>

      {/* Editor Box */}
      <div className="rounded-lg border border-slate-200 dark:border-[#1D3047] overflow-hidden bg-slate-950">
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400">
          <span>{isMongo ? 'JSON Filter / Document Spec' : 'SQL Console (LIMIT 50 enforced)'}</span>
          <span className="font-mono text-[10px]">Source: {dataset?.source || 'External'}</span>
        </div>
        <textarea
          rows={5}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full p-3 font-mono text-xs text-emerald-400 bg-slate-950 focus:outline-none resize-y"
          placeholder={isMongo ? '{\n  "field": "value"\n}' : 'SELECT * FROM table LIMIT 50;'}
        />
      </div>

      {/* Query Error Notice */}
      {error && (
        <div className="p-4 bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 rounded-lg text-xs space-y-1">
          <div className="flex items-center gap-2 font-semibold text-rose-800 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error.title}</span>
          </div>
          <p className="text-rose-700 dark:text-rose-400 pl-6">{error.message}</p>
          {error.hint && (
            <p className="text-slate-500 dark:text-slate-400 pl-6 text-[11px] italic">
              Hint: {error.hint}
            </p>
          )}
        </div>
      )}

      {/* Query Result View */}
      {result && (
        <div className="rounded-lg border border-slate-200 dark:border-[#1D3047] bg-white dark:bg-[#0D1828] overflow-hidden shadow-2xs space-y-2 p-3">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Query Executed Successfully</span>
            </div>
            <div className="flex items-center gap-3 font-mono text-[11px]">
              <span>{result.rowCount ?? rows.length} rows returned</span>
              {result.executionTimeMs != null && (
                <span>{result.executionTimeMs} ms</span>
              )}
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              Query completed with 0 matching records.
            </div>
          ) : isMongo ? (
            <div className="space-y-2 pt-2">
              {rows.map((doc, idx) => (
                <pre
                  key={idx}
                  className="p-2.5 rounded bg-slate-50 dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-800 dark:text-slate-200 overflow-x-auto"
                >
                  {JSON.stringify(doc, null, 2)}
                </pre>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead>
                  <tr className="bg-slate-50 dark:bg-[#111C2E] border-b border-slate-200 dark:border-[#1D3047]">
                    <th className="py-2 px-3 text-slate-400 text-center w-10">#</th>
                    {columns.map((c) => (
                      <th key={c} className="py-2 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {rows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-50/60 dark:hover:bg-[#111E30]/40">
                      <td className="py-1.5 px-3 text-slate-400 text-center text-[10px] select-none">
                        {rIdx + 1}
                      </td>
                      {columns.map((c) => {
                        const val = row[c];
                        return (
                          <td key={c} className="py-1.5 px-3 text-slate-800 dark:text-slate-200 whitespace-nowrap max-w-xs truncate">
                            {val === null || val === undefined ? (
                              <span className="text-slate-400 italic">null</span>
                            ) : typeof val === 'object' ? (
                              JSON.stringify(val)
                            ) : (
                              String(val)
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
