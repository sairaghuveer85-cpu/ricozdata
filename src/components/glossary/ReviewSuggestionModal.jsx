import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  ShieldAlert, 
  Sparkles, 
  Database, 
  Columns, 
  Info, 
  Link as LinkIcon,
  Tag as TagIcon
} from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import { DOMAINS } from '../../utils/constants';

export default function ReviewSuggestionModal({
  isOpen,
  onClose,
  suggestion,
  onApprove,
  onReject,
}) {
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

  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (suggestion) {
      setShowRejectForm(false);
      setRejectionReason('');
      setErrors({});
      setFormData({
        term: suggestion.suggestedTerm || '',
        definition: suggestion.suggestedDefinition || '',
        domain: suggestion.suggestedDomain || 'Customer',
        owner: '',
        status: 'approved',
        synonyms: (suggestion.suggestedSynonyms || []).join(', '),
        tags: (suggestion.suggestedTags || []).join(', '),
        examples: (suggestion.suggestedExamples || []).join('\n'),
        businessRules: (suggestion.suggestedBusinessRules || []).join('\n'),
      });
    }
  }, [suggestion]);

  if (!suggestion) return null;

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleApprove = async () => {
    const newErrors = {};
    const trimmedTerm = formData.term.trim();
    if (!trimmedTerm) {
      newErrors.term = 'Term name is required';
    }
    const trimmedDef = formData.definition.trim();
    if (!trimmedDef) {
      newErrors.definition = 'Definition is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    try {
      const overrides = {
        term: trimmedTerm,
        definition: trimmedDef,
        domain: formData.domain,
        owner: formData.owner?.trim() || undefined,
        status: formData.status || 'approved',
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
      };

      await onApprove(suggestion._id, overrides);
      onClose();
    } catch (err) {
      setErrors({ form: err.response?.data?.message || err.message || 'Approval failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    setSubmitting(true);
    try {
      await onReject(suggestion._id, rejectionReason.trim());
      onClose();
    } catch (err) {
      setErrors({ form: err.response?.data?.message || err.message || 'Rejection failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const confidenceScore = suggestion.confidenceScore || 0;
  const isHighConfidence = confidenceScore >= 90;
  const isMediumConfidence = confidenceScore >= 70 && confidenceScore < 90;

  const confidenceBadgeClass = isHighConfidence
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
    : isMediumConfidence
    ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800'
    : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';

  const isExistingTermMatch = suggestion.matchType === 'existing_term_link';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Review Suggestion: ${suggestion.suggestedTerm}`}
      subtitle="Verify, edit semantics, and approve into authoritative Business Glossary or reject."
      maxWidth="max-w-4xl"
      footer={
        <div className="w-full flex items-center justify-between">
          <div>
            {!showRejectForm ? (
              <Button
                variant="danger"
                size="sm"
                icon={XCircle}
                onClick={() => setShowRejectForm(true)}
                disabled={submitting}
              >
                Reject Suggestion
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowRejectForm(false)}
                disabled={submitting}
              >
                Cancel Rejection
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            {showRejectForm ? (
              <Button
                variant="danger"
                size="sm"
                onClick={handleReject}
                disabled={submitting}
              >
                {submitting ? 'Rejecting...' : 'Confirm Reject'}
              </Button>
            ) : (
              <Button
                size="sm"
                icon={CheckCircle2}
                onClick={handleApprove}
                disabled={submitting}
              >
                {submitting
                  ? 'Approving...'
                  : isExistingTermMatch
                  ? 'Approve & Link Source'
                  : 'Approve & Create Term'}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Error notification */}
        {errors.form && (
          <div className="p-3 text-xs rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300">
            {errors.form}
          </div>
        )}

        {/* Existing Term Match Notice */}
        {isExistingTermMatch && (
          <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 text-xs text-purple-900 dark:text-purple-200 flex items-start gap-2.5">
            <LinkIcon className="w-4 h-4 text-purple-600 dark:text-purple-400 mt-0.5 shrink-0" />
            <div>
              <span className="font-semibold text-purple-800 dark:text-purple-300">
                Authoritative Term Already Exists:{' '}
              </span>
              <span>
                Matching term <strong>"{suggestion.matchedExistingTermId?.term || suggestion.suggestedTerm}"</strong> found in Business Glossary. Approving will link the detected columns to this authoritative term without creating a duplicate record.
              </span>
            </div>
          </div>
        )}

        {/* Reject reason input prompt */}
        {showRejectForm && (
          <div className="p-4 rounded-xl bg-red-50/70 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 space-y-2">
            <label className="block text-xs font-semibold text-red-900 dark:text-red-200">
              Reason for Rejection (Optional)
            </label>
            <input
              type="text"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Not an enterprise business metric, or technical surrogate key"
              className="w-full text-xs rounded-lg border border-red-300 dark:border-red-800 bg-white dark:bg-[#111C2E] p-2 text-slate-900 dark:text-white"
            />
            <p className="text-[11px] text-red-700/80 dark:text-red-400">
              The suggestion will be marked as rejected and archived in the audit log.
            </p>
          </div>
        )}

        {/* PII Review Warning Alert Banner */}
        {suggestion.classificationAnomaly && (
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/70 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold text-amber-800 dark:text-amber-300">
                ⚠ PII classification review:{' '}
              </span>
              <span>
                Semantic analysis indicates personal data, but the catalog classification does not currently identify this field as PII.
              </span>
            </div>
          </div>
        )}

        {/* Confidence & Explainability Header Card with Triple Scores */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
          <div className="flex flex-wrap items-center justify-between gap-2.5 mb-2.5">
            <div className="flex flex-wrap items-center gap-2">
              {/* Category */}
              <span className="text-[11px] px-2.5 py-0.5 rounded font-bold uppercase tracking-wider bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                {(suggestion.conceptCategory || 'BUSINESS_ATTRIBUTE').replace(/_/g, ' ')}
              </span>

              {/* Parent Entity if applicable */}
              {suggestion.parentEntityTerm && (
                <span className="text-[11px] px-2 py-0.5 rounded font-medium bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Entity: <strong>{suggestion.parentEntityTerm}</strong>
                </span>
              )}

              {/* Triple Confidence Badges */}
              <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                Semantic confidence: {suggestion.semanticConfidence || suggestion.confidenceScore || 0}%
              </span>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold border bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800">
                Glossary relevance: {suggestion.glossaryRelevanceScore || (suggestion.conceptCategory === 'TECHNICAL_METADATA' ? 25 : 80)}%
              </span>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full font-medium border bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                Definition confidence: {suggestion.definitionConfidence || 75}%
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            <strong className="text-slate-800 dark:text-slate-100 font-medium">Reasoning: </strong>
            {suggestion.reasoning}
          </p>

          {/* Source Columns Evidence */}
          {suggestion.sourceColumnRefs && suggestion.sourceColumnRefs.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                <Columns className="w-3.5 h-3.5" />
                <span>Detected Source Columns ({suggestion.sourceColumnRefs.length})</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {suggestion.sourceColumnRefs.map((col, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono"
                  >
                    <Database className="w-3 h-3 text-blue-500" />
                    <span>
                      {col.datasetName}.<strong className="font-semibold">{col.columnName}</strong>
                    </span>
                    {col.dataType && (
                      <span className="text-[10px] text-slate-400 font-normal uppercase">
                        ({col.dataType})
                      </span>
                    )}
                    {col.isPII && (
                      <span className="inline-flex items-center text-[9px] px-1 py-0.2 rounded bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-sans font-semibold">
                        PII
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Human Editorial Section */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <TagIcon className="w-3.5 h-3.5" />
            <span>Human Review & Semantic Refinement</span>
          </h4>

          <Input
            label="Authoritative Term Name"
            placeholder="e.g. Customer Email"
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
                Approved Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] text-xs text-slate-900 dark:text-white py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="draft">Draft (Requires Governance Cycle)</option>
                <option value="approved">Approved (Authoritative Immediately)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Designated Business Owner
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
              Authoritative Business Definition
            </label>
            <textarea
              rows={3}
              value={formData.definition}
              onChange={(e) => handleChange('definition', e.target.value)}
              placeholder="Provide a clear, authoritative business definition..."
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
                Synonyms (comma separated)
              </label>
              <input
                type="text"
                value={formData.synonyms}
                onChange={(e) => handleChange('synonyms', e.target.value)}
                placeholder="e.g. Email Address, Contact Email"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Tags (comma separated)
              </label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => handleChange('tags', e.target.value)}
                placeholder="e.g. PII, Contact, Customer"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Examples (one per line)
              </label>
              <textarea
                rows={2}
                value={formData.examples}
                onChange={(e) => handleChange('examples', e.target.value)}
                placeholder="e.g. john.doe@enterprise.com"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Business Rules & Constraints (one per line)
              </label>
              <textarea
                rows={2}
                value={formData.businessRules}
                onChange={(e) => handleChange('businessRules', e.target.value)}
                placeholder="e.g. Must conform to RFC 5322 format"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
