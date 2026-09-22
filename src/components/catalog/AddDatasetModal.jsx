import React, { useState } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import { DOMAINS, DATA_SOURCES, SENSITIVITY_LEVELS } from '../../utils/constants';

export default function AddDatasetModal({
  isOpen,
  onClose,
  onAdd
}) {
  const [formData, setFormData] = useState({
    name: '',
    domain: 'Marketing',
    source: 'Snowflake',
    sensitivity: 'PII',
    status: 'Certified',
    description: '',
    owner: 'Priya S.',
    rows: '1.2M',
    columnsCount: 24,
    quality: 95
  });

  const [errors, setErrors] = useState({});

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Dataset name is required';
    if (!formData.description.trim()) newErrors.description = 'Description is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onAdd(formData);
    onClose();
    // Reset form
    setFormData({
      name: '',
      domain: 'Marketing',
      source: 'Snowflake',
      sensitivity: 'PII',
      status: 'Certified',
      description: '',
      owner: 'Priya S.',
      rows: '1.2M',
      columnsCount: 24,
      quality: 95
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Dataset"
      subtitle="Register a new data source or warehouse table into the catalog"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit}>
            Register Dataset
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Dataset Name"
          placeholder="e.g. User Behavior Events"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          error={errors.name}
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Domain
            </label>
            <select
              value={formData.domain}
              onChange={(e) => handleChange('domain', e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] text-xs text-slate-900 dark:text-white py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              {DOMAINS.filter(d => d !== 'All Domains').map(d => (
                <option key={d} value={d} className="bg-white dark:bg-[#111C2E] text-slate-900 dark:text-white">{d}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Data Source
            </label>
            <select
              value={formData.source}
              onChange={(e) => handleChange('source', e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] text-xs text-slate-900 dark:text-white py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              {DATA_SOURCES.map(s => (
                <option key={s} value={s} className="bg-white dark:bg-[#111C2E] text-slate-900 dark:text-white">{s}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Sensitivity
            </label>
            <select
              value={formData.sensitivity}
              onChange={(e) => handleChange('sensitivity', e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] text-xs text-slate-900 dark:text-white py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              {SENSITIVITY_LEVELS.map(s => (
                <option key={s} value={s} className="bg-white dark:bg-[#111C2E] text-slate-900 dark:text-white">{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Certification Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => handleChange('status', e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] text-xs text-slate-900 dark:text-white py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="Certified" className="bg-white dark:bg-[#111C2E] text-slate-900 dark:text-white">Certified</option>
              <option value="In Review" className="bg-white dark:bg-[#111C2E] text-slate-900 dark:text-white">In Review</option>
              <option value="Not Certified" className="bg-white dark:bg-[#111C2E] text-slate-900 dark:text-white">Not Certified</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Owner Name
          </label>
          <input
            type="text"
            value={formData.owner}
            onChange={(e) => handleChange('owner', e.target.value)}
            placeholder="e.g. Priya S."
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Description
          </label>
          <textarea
            rows={3}
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Provide a clear description of the data contents, purpose, and update frequency..."
            className={`w-full rounded-lg border text-xs py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-[#111C2E] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 ${
              errors.description
                ? 'border-red-300 dark:border-red-900 focus:border-red-500'
                : 'border-slate-200 dark:border-slate-800 focus:border-blue-500'
            }`}
          />
          {errors.description && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.description}</p>
          )}
        </div>
      </form>
    </Modal>
  );
}
