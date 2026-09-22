import React, { useState } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import { DOMAINS } from '../../utils/constants';

export default function AddTermModal({ isOpen, onClose, onAdd }) {
  const [formData, setFormData] = useState({
    term: '',
    definition: '',
    domain: 'Marketing',
    owner: '',
    synonyms: ''
  });

  const [errors, setErrors] = useState({});

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!formData.term.trim()) newErrors.term = 'Term name is required';
    if (!formData.definition.trim()) newErrors.definition = 'Definition is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onAdd({
      ...formData,
      synonyms: formData.synonyms ? formData.synonyms.split(',').map(s => s.trim()) : []
    });

    setFormData({
      term: '',
      definition: '',
      domain: 'Marketing',
      owner: '',
      synonyms: ''
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Glossary Term"
      subtitle="Define enterprise data terminology and establish standardized business semantics"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit}>
            Create Term
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Term Name"
          placeholder="e.g. Net Retention Rate"
          value={formData.term}
          onChange={(e) => handleChange('term', e.target.value)}
          error={errors.term}
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
              Owner
            </label>
            <input
              type="text"
              value={formData.owner}
              onChange={(e) => handleChange('owner', e.target.value)}
              placeholder="e.g. Priya S."
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Synonyms (Optional)
          </label>
          <input
            type="text"
            value={formData.synonyms}
            onChange={(e) => handleChange('synonyms', e.target.value)}
            placeholder="e.g. Dollar Retention, NDR (comma separated)"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Definition
          </label>
          <textarea
            rows={3}
            value={formData.definition}
            onChange={(e) => handleChange('definition', e.target.value)}
            placeholder="Provide a clear, authoritative business definition and calculation formula..."
            className={`w-full rounded-lg border text-xs py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-[#111C2E] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 ${
              errors.definition
                ? 'border-red-300 dark:border-red-900 focus:border-red-500'
                : 'border-slate-200 dark:border-slate-800 focus:border-blue-500'
            }`}
          />
          {errors.definition && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.definition}</p>
          )}
        </div>
      </form>
    </Modal>
  );
}
