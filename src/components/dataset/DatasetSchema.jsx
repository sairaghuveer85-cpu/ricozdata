import React, { useState } from 'react';
import { Key, Shield, Search, Edit2, Save, X, Tag, AlertTriangle, Download } from 'lucide-react';
import EmptyState from '../common/EmptyState';
import { PERMISSIONS } from '../../constants/rbac';
import { useApp } from '../../context/AppContext';
import datasetApi from '../../services/datasetApi';
import { exportDatasetSchema } from '../../utils/schemaExporter';

export default function DatasetSchema({ schema = [], dataset, datasetId, onUpdateSuccess }) {
  const [filter, setFilter] = useState('');
  const { hasPermission, addToast } = useApp();
  const [editingColumn, setEditingColumn] = useState(null);
  const [editValues, setEditValues] = useState({});

  const canEdit = hasPermission(PERMISSIONS.DATASET_UPDATE);

  const filteredSchema = schema.filter(col =>
    col.name.toLowerCase().includes(filter.toLowerCase()) ||
    col.type.toLowerCase().includes(filter.toLowerCase()) ||
    (col.description && col.description.toLowerCase().includes(filter.toLowerCase()))
  );

  const startEdit = (col) => {
    if (!canEdit) return;
    setEditingColumn(col.name);
    setEditValues({
      description: col.description || '',
      sensitivity: col.sensitivity || 'Internal',
      primaryKey: col.primaryKey || false,
      businessMeaning: col.businessMeaning || ''
    });
  };

  const cancelEdit = () => {
    setEditingColumn(null);
    setEditValues({});
  };

  const saveEdit = async (col) => {
    try {
      await datasetApi.updateColumnMetadata(datasetId, col.name, editValues);
      addToast({
        title: 'Column Metadata Updated',
        message: `Metadata for column "${col.name}" saved successfully`,
        type: 'success'
      });
      if (onUpdateSuccess) {
        onUpdateSuccess();
      }
      setEditingColumn(null);
      setEditValues({});
    } catch (error) {
      console.error('Failed to update column metadata:', error);
      addToast({
        title: 'Error',
        message: 'Failed to update column metadata',
        type: 'error'
      });
    }
  };

  return (
    <div className="theme-card rounded-lg border border-slate-200 dark:border-[#1D3047] shadow-2xs overflow-hidden">
      <div className="p-4 border-b border-slate-100 dark:border-[#1D3047] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Schema Definition ({schema.length} fields)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Field names, types, constraints, and classification tags</p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Filter columns..."
              aria-label="Filter columns"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full text-xs rounded-md border border-slate-200 dark:border-[#1D3047] bg-white dark:bg-[#0D1828] text-slate-900 dark:text-white pl-8 pr-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-2.5" aria-hidden="true" />
          </div>
          <button
            type="button"
            onClick={() => exportDatasetSchema(dataset || { columns: schema, _id: datasetId, id: datasetId }, {
              getFullDataset: (id) => datasetApi.getDatasetById(id),
              addToast
            })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 dark:border-[#1D3047] hover:bg-slate-50 dark:hover:bg-[#111C2E] text-slate-700 dark:text-slate-200 text-xs font-semibold shrink-0 cursor-pointer transition-colors"
            title="Export Schema Definition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Schema</span>
          </button>
        </div>
      </div>

      {filteredSchema.length === 0 ? (
        <div className="p-4">
          <EmptyState
            title="No matching columns"
            description={`No schema columns match "${filter}".`}
            actionLabel="Reset filter"
            onAction={() => setFilter('')}
          />
        </div>
      ) : (
        <>
          {/* Mobile Schema Cards (< md) */}
          <div className="md:hidden divide-y divide-slate-100 dark:divide-[#1D3047]">
            {filteredSchema.map((col, idx) => {
              const isEditing = editingColumn === col.name;
              return (
                <div key={idx} className="p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-900 dark:text-white">
                      {col.primaryKey && (
                        <Key className="w-3.5 h-3.5 text-amber-500 shrink-0" aria-label="Primary Key" />
                      )}
                      <span>{col.name}</span>
                      {col.pii && (
                        <span title="PII">
                          <AlertTriangle className="w-3 h-3 text-rose-500" />
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {col.type}
                      </span>
                      {canEdit && isEditing && (
                        <button
                          onClick={() => saveEdit(col)}
                          className="p-0.5 text-emerald-600 dark:text-emerald-400 hover:text-emerald-500"
                          title="Save"
                        >
                          <Save className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canEdit && !isEditing && (
                        <button
                          onClick={() => startEdit(col)}
                          className="p-0.5 text-slate-400 hover:text-slate-600"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  {!isEditing ? (
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 gap-2">
                      <span className="shrink-0">{col.nullable ? 'Nullable' : 'NOT NULL'}</span>
                      <span className="text-right truncate">{col.description || 'No description provided'}</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Sensitivity</label>
                        <select
                          value={editValues.sensitivity}
                          onChange={(e) => setEditValues({ ...editValues, sensitivity: e.target.value })}
                          className="w-full text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0D1828] text-slate-900 dark:text-white py-1 px-2"
                        >
                          <option value="Public">Public</option>
                          <option value="Internal">Internal</option>
                          <option value="Confidential">Confidential</option>
                          <option value="Restricted">Restricted</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Business Meaning</label>
                        <input
                          type="text"
                          value={editValues.businessMeaning}
                          onChange={(e) => setEditValues({ ...editValues, businessMeaning: e.target.value })}
                          className="w-full text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0D1828] text-slate-900 dark:text-white py-1 px-2"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={cancelEdit}
                          className="px-2 py-1 text-[10px] text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => saveEdit(col)}
                          className="px-2 py-1 text-[10px] text-emerald-600 hover:bg-emerald-50 dark:bg-emerald-950/20 rounded"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop Table (>= md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse" aria-label="Dataset Schema Columns">
              <thead>
                <tr className="bg-slate-50 dark:bg-[#111E30] border-b border-slate-200 dark:border-[#1D3047] text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-2.5 px-4">Column Name</th>
                  <th className="py-2.5 px-4">Data Type</th>
                  <th className="py-2.5 px-4">Constraints</th>
                  <th className="py-2.5 px-4">Classification</th>
                  <th className="py-2.5 px-4">Sensitivity</th>
                  <th className="py-2.5 px-4">Business Meaning</th>
                  <th className="py-2.5 px-4">Description</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1D3047] text-xs">
                {filteredSchema.map((col, idx) => {
                  const isEditing = editingColumn === col.name;
                  return (
                    <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-[#111E30]/40 transition-colors">
                      <td className="py-2.5 px-4 font-mono font-medium text-slate-900 dark:text-white">
                        <div className="flex items-center gap-1.5">
                          {col.primaryKey && (
                            <span title="Primary Key">
                              <Key className="w-3.5 h-3.5 text-amber-500 shrink-0" aria-label="Primary Key" />
                            </span>
                          )}
                          <span>{col.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-400">
                        {col.type}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">
                        <span className="text-[11px]">
                          {col.nullable ? 'Nullable' : 'NOT NULL'}
                          {col.primaryKey && ' • PK'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        {col.pii ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50">
                            <Shield className="w-3 h-3 text-rose-500" aria-hidden="true" />
                            PII
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        {isEditing ? (
                          <select
                            value={editValues.sensitivity}
                            onChange={(e) => setEditValues({ ...editValues, sensitivity: e.target.value })}
                            className="text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0D1828] text-slate-900 dark:text-white py-1 px-2"
                          >
                            <option value="Public">Public</option>
                            <option value="Internal">Internal</option>
                            <option value="Confidential">Confidential</option>
                            <option value="Restricted">Restricted</option>
                          </select>
                        ) : (
                          <span className={`text-xs font-medium ${
                            col.sensitivity === 'Restricted' ? 'text-rose-600 dark:text-rose-400' :
                            col.sensitivity === 'Confidential' ? 'text-amber-600 dark:text-amber-400' :
                            col.sensitivity === 'Internal' ? 'text-slate-600 dark:text-slate-400' :
                            'text-blue-600 dark:text-blue-400'
                          }`}>
                            {col.sensitivity || 'Internal'}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editValues.businessMeaning}
                            onChange={(e) => setEditValues({ ...editValues, businessMeaning: e.target.value })}
                            className="text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0D1828] text-slate-900 dark:text-white py-1 px-2 w-full"
                            placeholder="e.g. Unique customer identifier"
                          />
                        ) : (
                          <span className="text-slate-500 dark:text-slate-400">
                            {col.businessMeaning || '-'}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400">
                        {col.description || 'No description provided'}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        {canEdit && (
                          isEditing ? (
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={cancelEdit}
                                title="Cancel"
                                className="p-1 text-slate-400 hover:text-slate-600"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => saveEdit(col)}
                                title="Save"
                                className="p-1 text-emerald-600 hover:text-emerald-500"
                              >
                                <Save className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEdit(col)}
                              title="Edit Column"
                              className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}