import React, { useState } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import { useApp } from '../../context/AppContext';

export default function PolicyModal({ isOpen, onClose, onAdd }) {
  const { datasets } = useApp();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'Data Protection',
    status: 'draft',
    severity: 'Medium',
    priority: 'Medium',
    datasetIds: [],
    reviewFrequency: 'Quarterly',
  });

  const [errors, setErrors] = useState({});

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handleDatasetToggle = (dsId) => {
    setFormData((prev) => {
      const exists = prev.datasetIds.includes(dsId);
      return {
        ...prev,
        datasetIds: exists
          ? prev.datasetIds.filter((id) => id !== dsId)
          : [...prev.datasetIds, dsId],
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!formData.name.trim() || formData.name.trim().length < 3) {
      newErrors.name = 'Policy name is required (min 3 characters)';
    }
    if (!formData.description.trim() || formData.description.trim().length < 10) {
      newErrors.description = 'Description is required (min 10 characters)';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      await onAdd(formData);
      onClose();
      setFormData({
        name: '',
        description: '',
        category: 'Data Protection',
        status: 'draft',
        severity: 'Medium',
        priority: 'Medium',
        datasetIds: [],
        reviewFrequency: 'Quarterly',
      });
    } catch (err) {
      // toast shown in context
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Governance Policy"
      subtitle="Define organizational requirements, ownership, and target datasets"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit}>
            Create Policy
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
        <Input
          label="Policy Name"
          placeholder="e.g. Sensitive Customer Personal Information Protection Policy"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          error={errors.name}
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Category</label>
            <select
              value={formData.category}
              onChange={(e) => handleChange('category', e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] p-2 text-slate-900 dark:text-white"
            >
              <option value="Data Protection">Data Protection</option>
              <option value="Access Control">Access Control</option>
              <option value="Data Quality">Data Quality</option>
              <option value="Lifecycle">Lifecycle</option>
              <option value="Data Sharing">Data Sharing</option>
              <option value="Security">Security</option>
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Initial Status</label>
            <select
              value={formData.status}
              onChange={(e) => handleChange('status', e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] p-2 text-slate-900 dark:text-white"
            >
              <option value="draft">Draft</option>
              <option value="under_review">Under Review</option>
              <option value="active">Active</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Severity / Priority</label>
            <select
              value={formData.severity}
              onChange={(e) => {
                handleChange('severity', e.target.value);
                handleChange('priority', e.target.value);
              }}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] p-2 text-slate-900 dark:text-white"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Review Frequency</label>
            <select
              value={formData.reviewFrequency}
              onChange={(e) => handleChange('reviewFrequency', e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] p-2 text-slate-900 dark:text-white"
            >
              <option value="Monthly">Monthly</option>
              <option value="Quarterly">Quarterly</option>
              <option value="Semiannual">Semiannual</option>
              <option value="Annual">Annual</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
            Target Catalog Datasets ({formData.datasetIds.length} selected)
          </label>
          <div className="max-h-28 overflow-y-auto p-2 border border-slate-200 dark:border-slate-800 rounded-lg space-y-1 bg-white dark:bg-[#0B1628]">
            {datasets.map((d) => {
              const dsId = d.id || d._id;
              const isChecked = formData.datasetIds.includes(dsId);
              return (
                <label key={dsId} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 p-1 rounded">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleDatasetToggle(dsId)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="truncate">{d.name} ({d.tableName || 'Table'})</span>
                </label>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Description & Requirements</label>
          <textarea
            rows={3}
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Detail the mandatory data protection, classification, or retention requirements..."
            className={`w-full rounded-lg border p-2 bg-white dark:bg-[#111C2E] text-slate-900 dark:text-white placeholder-slate-400 ${
              errors.description ? 'border-red-400' : 'border-slate-200 dark:border-slate-800'
            }`}
          />
          {errors.description && <p className="mt-1 text-red-500 text-[11px]">{errors.description}</p>}
        </div>
      </form>
    </Modal>
  );
}
