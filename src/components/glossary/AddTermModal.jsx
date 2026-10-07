import React, { useState } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import { DOMAINS } from '../../utils/constants';

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'approved', label: 'Approved' },
  { value: 'deprecated', label: 'Deprecated' },
  { value: 'archived', label: 'Archived' },
];

export default function AddTermModal({ isOpen, onClose, onAdd }) {
  const [formData, setFormData] = useState({
    term: '',
    definition: '',
    domain: 'Customer',
    owner: '',
    status: 'draft',
    synonyms: '',
    tags: '',
    examples: '',
    businessRules: '',
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    const newErrors = {};

    const trimmedTerm = formData.term.trim();
    if (!trimmedTerm) {
      newErrors.term = 'Term name is required';
    } else if (trimmedTerm.length < 2) {
      newErrors.term = 'Term name must be at least 2 characters';
    }

    const trimmedDef = formData.definition.trim();
    if (!trimmedDef) {
      newErrors.definition = 'Definition is required';
    } else if (trimmedDef.length < 10) {
      newErrors.definition = 'Definition must be at least 10 characters';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    try {
      await onAdd({
        term: trimmedTerm,
        definition: trimmedDef,
        domain: formData.domain,
        owner: formData.owner ? formData.owner.trim() : undefined,
        status: formData.status,
        synonyms: formData.synonyms
          ? formData.synonyms.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
        tags: formData.tags
          ? formData.tags.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
        examples: formData.examples
          ? formData.examples.split('\n').map((s) => s.trim()).filter(Boolean)
          : [],
        businessRules: formData.businessRules
          ? formData.businessRules.split('\n').map((s) => s.trim()).filter(Boolean)
          : [],
      });

      setFormData({
        term: '',
        definition: '',
        domain: 'Customer',
        owner: '',
        status: 'draft',
        synonyms: '',
        tags: '',
        examples: '',
        businessRules: '',
      });
      setErrors({});
      onClose();
    } catch (err) {
      setErrors({ form: err.response?.data?.message || err.message || 'Failed to create term' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Business Glossary Term"
      subtitle="Define enterprise data terminology and establish standardized business semantics"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Term'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errors.form && (
          <div className="p-3 text-xs rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300">
            {errors.form}
          </div>
        )}

        <Input
          label="Term Name"
          placeholder="e.g. Net Retention Rate"
          value={formData.term}
          onChange={(e) => handleChange('term', e.target.value)}
          error={errors.term}
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Domain
            </label>
            <select
              value={formData.domain}
              onChange={(e) => handleChange('domain', e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] text-xs text-slate-900 dark:text-white py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              {DOMAINS.filter((d) => d !== 'All Domains').map((d) => (
                <option key={d} value={d} className="bg-white dark:bg-[#111C2E] text-slate-900 dark:text-white">
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Initial Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => handleChange('status', e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] text-xs text-slate-900 dark:text-white py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-white dark:bg-[#111C2E] text-slate-900 dark:text-white">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Business Owner
            </label>
            <input
              type="text"
              value={formData.owner}
              onChange={(e) => handleChange('owner', e.target.value)}
              placeholder="e.g. Priya Shah"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Synonyms (comma-separated)
            </label>
            <input
              type="text"
              value={formData.synonyms}
              onChange={(e) => handleChange('synonyms', e.target.value)}
              placeholder="e.g. Dollar Retention, NDR"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => handleChange('tags', e.target.value)}
              placeholder="e.g. revenue, retention, kpi"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Examples (one per line)
          </label>
          <textarea
            rows={2}
            value={formData.examples}
            onChange={(e) => handleChange('examples', e.target.value)}
            placeholder="e.g. A cohorts starting revenue $100k renewing at $110k gives 110% NRR"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Business Rules (one per line)
          </label>
          <textarea
            rows={2}
            value={formData.businessRules}
            onChange={(e) => handleChange('businessRules', e.target.value)}
            placeholder="e.g. Exclude churned trial accounts from active calculations"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
      </form>
    </Modal>
  );
}
