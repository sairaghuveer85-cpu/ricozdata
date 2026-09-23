import React from 'react';
import Drawer from '../common/Drawer';
import Button from '../common/Button';
import Badge from '../common/Badge';
import { Shield, Copy, Edit3, Power, CheckCircle, Clock, Database, User } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useNavigate } from 'react-router-dom';

export default function PolicyDrawer({ policy, isOpen, onClose }) {
  const { togglePolicyStatus, addPolicy, addToast, datasets } = useApp();
  const navigate = useNavigate();

  if (!policy) return null;

  const handleToggle = () => {
    togglePolicyStatus(policy.id);
  };

  const handleDuplicate = () => {
    addPolicy({
      name: `${policy.name} (Copy)`,
      description: policy.description,
      appliesTo: policy.appliesTo,
      owner: policy.owner,
      status: 'Inactive',
      scope: policy.scope,
      rules: policy.rules,
      affectedDatasets: policy.affectedDatasets,
      compliance: policy.compliance,
      lastReview: 'Just now'
    });
    onClose();
  };

  const handleEdit = () => {
    addToast({
      type: 'info',
      title: 'Policy Editor',
      message: `Opened edit mode for policy "${policy.name}".`
    });
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={policy.name}
      subtitle={`Owner: ${policy.owner} • Last Review: ${policy.lastReview || policy.updated}`}
      footer={
        <div className="flex items-center justify-between w-full gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={Copy}
            onClick={handleDuplicate}
          >
            Duplicate
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={Edit3}
              onClick={handleEdit}
            >
              Edit
            </Button>
            <Button
              variant={policy.status === 'Active' ? 'danger' : 'primary'}
              size="sm"
              icon={Power}
              onClick={handleToggle}
            >
              {policy.status === 'Active' ? 'Disable' : 'Enable'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5 text-xs text-slate-600 dark:text-slate-300">
        {/* Status and Owner Header */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800">
          <div>
            <div className="text-[11px] text-slate-400 mb-0.5">Policy Status</div>
            <Badge status={policy.status} size="sm" dot />
          </div>
          <div>
            <div className="text-[11px] text-slate-400 mb-0.5">Policy Owner</div>
            <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-blue-500" />
              {policy.owner}
            </span>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-slate-400 mb-0.5">Last Audit Review</div>
            <span className="font-medium text-slate-700 dark:text-slate-300">{policy.lastReview || 'Sep 14, 2026'}</span>
          </div>
        </div>

        {/* Policy Description */}
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-1.5">
            Policy Statement & Purpose
          </h4>
          <p className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 leading-relaxed text-slate-800 dark:text-slate-200 text-sm">
            {policy.description}
          </p>
        </div>

        {/* Scope */}
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-1.5">
            Target Enforcement Scope
          </h4>
          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 font-semibold text-slate-900 dark:text-white bg-white dark:bg-[#0B1628]">
            {policy.scope || `Applies To: ${policy.appliesTo}`}
          </div>
        </div>

        {/* Enforced Rules */}
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-1.5">
            Associated Rules & Enforcement Mechanisms
          </h4>
          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 bg-white dark:bg-[#0B1628] leading-relaxed">
            {policy.rules || 'Requires role clearance, logged justification, and time-bounded token expiration.'}
          </div>
        </div>

        {/* Affected Datasets */}
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-2">
            Affected Datasets
          </h4>
          <div className="space-y-1.5">
            {(policy.affectedDatasets || (policy.datasetIds ? policy.datasetIds.map(id => datasets.find(d => d.id === id)?.name || id) : ['Customer Database'])).map((ds) => {
              const matched = datasets.find(d => d.name === ds || d.id === ds);
              return (
                <button key={ds} type="button" onClick={() => matched && (onClose(), navigate(`/catalog/${matched.id}`))} className="w-full flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-left hover:border-blue-300 dark:hover:border-blue-700 transition-colors cursor-pointer">
                  <div className="flex items-center gap-2 min-w-0">
                    <Database className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs truncate">{matched?.name || ds}</span>
                  </div>
                  {matched && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                      {matched.sensitivity}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Compliance Guarantees */}
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-2">
            Compliance Standards Covered
          </h4>
          <div className="p-3 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300 font-medium">
            {policy.compliance || 'GDPR Article 32, SOC 2 CC6.1, ISO 27001'}
          </div>
        </div>
      </div>
    </Drawer>
  );
}
