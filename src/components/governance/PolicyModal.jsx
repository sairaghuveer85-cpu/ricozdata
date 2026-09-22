import React, { useState } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';

export default function PolicyModal({ isOpen, onClose, onAdd }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    appliesTo: 'Customer Data',
    status: 'Active',
    category: 'Security',
    enforcementLevel: 'Strict'
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
    if (!formData.name.trim()) newErrors.name = 'Policy name is required';
    if (!formData.description.trim()) newErrors.description = 'Description is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onAdd(formData);
    onClose();
    setFormData({
      name: '',
      description: '',
      appliesTo: 'Customer Data',
      status: 'Active',
      category: 'Security',
      enforcementLevel: 'Strict'
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Governance Policy"
      subtitle="Define organizational security, retention, or privacy guardrails"
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
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Policy Name"
          placeholder="e.g. Geographic Data Residency Restriction"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          error={errors.name}
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Applies To
            </label>
            <select
              value={formData.appliesTo}
              onChange={(e) => handleChange('appliesTo', e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] text-xs text-slate-900 dark:text-white py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="Customer Data" className="bg-white dark:bg-[#111C2E] text-slate-900 dark:text-white">Customer Data</option>
              <option value="All Datasets" className="bg-white dark:bg-[#111C2E] text-slate-900 dark:text-white">All Datasets</option>
              <option value="PII Columns" className="bg-white dark:bg-[#111C2E] text-slate-900 dark:text-white">PII Columns</option>
              <option value="All Users" className="bg-white dark:bg-[#111C2E] text-slate-900 dark:text-white">All Users</option>
              <option value="Financial Tables" className="bg-white dark:bg-[#111C2E] text-slate-900 dark:text-white">Financial Tables</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => handleChange('status', e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] text-xs text-slate-900 dark:text-white py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="Active" className="bg-white dark:bg-[#111C2E] text-slate-900 dark:text-white">Active</option>
              <option value="Inactive" className="bg-white dark:bg-[#111C2E] text-slate-900 dark:text-white">Inactive</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Category
          </label>
          <select
            value={formData.category}
            onChange={(e) => handleChange('category', e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] text-xs text-slate-900 dark:text-white py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="Security" className="bg-white dark:bg-[#111C2E] text-slate-900 dark:text-white">Security</option>
            <option value="Lifecycle" className="bg-white dark:bg-[#111C2E] text-slate-900 dark:text-white">Lifecycle</option>
            <option value="Privacy" className="bg-white dark:bg-[#111C2E] text-slate-900 dark:text-white">Privacy</option>
            <option value="Compliance" className="bg-white dark:bg-[#111C2E] text-slate-900 dark:text-white">Compliance</option>
            <option value="Egress" className="bg-white dark:bg-[#111C2E] text-slate-900 dark:text-white">Egress</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Description
          </label>
          <textarea
            rows={3}
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Describe what this policy enforces, triggers, and penalty conditions..."
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
