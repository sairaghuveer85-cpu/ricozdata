import React, { useState } from 'react';
import Drawer from '../common/Drawer';
import Button from '../common/Button';
import Badge from '../common/Badge';
import {
  Shield,
  Copy,
  Edit3,
  Power,
  CheckCircle,
  Clock,
  Database,
  User,
  Play,
  Layers,
  BookOpen,
  ArrowRight,
  Loader2,
  FileCheck
} from 'lucide-react';
import PermissionGate from '../auth/PermissionGate';
import { PERMISSIONS } from '../../constants/rbac';
import { useApp } from '../../context/AppContext';
import { policyApi } from '../../services/policyApi';
import { useNavigate } from 'react-router-dom';

export default function PolicyDrawer({ policy, isOpen, onClose }) {
  const { togglePolicyStatus, transitionPolicyStatus, addPolicy, addToast, datasets } = useApp();
  const navigate = useNavigate();

  const [transitioning, setTransitioning] = useState(false);
  const [evaluatingRules, setEvaluatingRules] = useState(false);

  if (!policy) return null;

  const currentStatus = policy.status ? policy.status.toLowerCase().replace(/[\s-]/g, '_') : 'draft';

  const handleTransition = async (targetStatus) => {
    setTransitioning(true);
    try {
      if (transitionPolicyStatus) {
        await transitionPolicyStatus(policy.id || policy._id, targetStatus, `Transitioned via Policy Drawer`);
      }
    } catch (err) {
      console.warn('Transition error:', err);
    } finally {
      setTransitioning(false);
    }
  };

  const handleEvaluateRules = async () => {
    setEvaluatingRules(true);
    try {
      const res = await policyApi.evaluatePolicyRules(policy.id || policy._id);
      if (res?.success) {
        addToast({
          type: 'success',
          title: 'Policy Rules Evaluated',
          message: `Evaluated ${res.totalRulesEvaluated || 0} rule(s) successfully.`,
        });
      }
    } catch (err) {
      addToast({
        type: 'danger',
        title: 'Evaluation Error',
        message: err.message || 'Could not evaluate policy rules',
      });
    } finally {
      setEvaluatingRules(false);
    }
  };

  const renderTransitionControls = () => {
    if (currentStatus === 'draft') {
      return (
        <button
          type="button"
          disabled={transitioning}
          onClick={() => handleTransition('under_review')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors cursor-pointer"
        >
          {transitioning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
          <span>Submit for Review</span>
        </button>
      );
    }
    if (currentStatus === 'under_review') {
      return (
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={transitioning}
            onClick={() => handleTransition('draft')}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Return to Draft
          </button>
          <PermissionGate permission={PERMISSIONS.POLICY_UPDATE}>
            <button
              type="button"
              disabled={transitioning}
              onClick={() => handleTransition('active')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors cursor-pointer"
            >
              {transitioning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
              <span>Activate Policy</span>
            </button>
          </PermissionGate>
        </div>
      );
    }
    if (currentStatus === 'active') {
      return (
        <button
          type="button"
          disabled={transitioning}
          onClick={() => handleTransition('deprecated')}
          className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-colors cursor-pointer"
        >
          {transitioning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Power className="w-3.5 h-3.5" />}
          <span>Deprecate Policy</span>
        </button>
      );
    }
    if (currentStatus === 'deprecated') {
      return (
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={transitioning}
            onClick={() => handleTransition('active')}
            className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors cursor-pointer"
          >
            Reactivate
          </button>
          <button
            type="button"
            disabled={transitioning}
            onClick={() => handleTransition('archived')}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Archive
          </button>
        </div>
      );
    }
    return null;
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={policy.name}
      subtitle={`Owner: ${policy.owner || 'Unassigned'} • Version: v${policy.version || 1} • Status: ${policy.status?.toUpperCase()}`}
      footer={
        <div className="flex items-center justify-between w-full gap-2">
          <div className="flex items-center gap-2">
            {renderTransitionControls()}
          </div>
          <button
            type="button"
            onClick={handleEvaluateRules}
            disabled={evaluatingRules}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-colors font-semibold text-xs cursor-pointer border border-blue-200 dark:border-blue-900/60"
          >
            {evaluatingRules ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            <span>Evaluate Rules</span>
          </button>
        </div>
      }
    >
      <div className="space-y-5 text-xs text-slate-600 dark:text-slate-300">
        {/* Status, Version, and Owner Header */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800">
          <div>
            <div className="text-[11px] text-slate-400 mb-0.5">Policy Lifecycle</div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                currentStatus === 'active'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                  : currentStatus === 'under_review'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400'
                  : currentStatus === 'draft'
                  ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
              }`}
            >
              {currentStatus}
            </span>
          </div>
          <div>
            <div className="text-[11px] text-slate-400 mb-0.5">Policy Owner</div>
            <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-blue-500" />
              {policy.owner || 'Data Steward'}
            </span>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-slate-400 mb-0.5">Version & Audit</div>
            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
              v{policy.version || 1} • {policy.reviewFrequency || 'Quarterly'}
            </span>
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

        {/* Scope & Applies To */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-1">
              Category
            </h4>
            <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1628] font-semibold text-slate-800 dark:text-slate-200">
              {policy.category}
            </div>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-1">
              Severity / Priority
            </h4>
            <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1628] font-semibold text-slate-800 dark:text-slate-200">
              {policy.severity || policy.priority || 'Medium'}
            </div>
          </div>
        </div>

        {/* Scope */}
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-1.5">
            Application Scope
          </h4>
          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 bg-white dark:bg-[#0B1628]">
            {policy.scope || 'Applies to RicozData metadata, query studio, and catalog resources.'}
          </div>
        </div>

        {/* Affected Datasets */}
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-2 flex items-center justify-between">
            <span>Linked Datasets & Scope</span>
            <span className="text-slate-400 font-normal">{(policy.datasetIds || []).length} linked</span>
          </h4>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {(policy.datasetIds || []).length === 0 ? (
              <p className="text-slate-400 italic p-2 bg-slate-50 dark:bg-slate-900 rounded">
                Applies across all enterprise catalog datasets.
              </p>
            ) : (
              policy.datasetIds.map((ds) => {
                const dsId = ds._id || ds.id || ds;
                const dsName = ds.name || datasets.find((d) => d.id === dsId || d._id === dsId)?.name || dsId;
                return (
                  <button
                    key={dsId}
                    type="button"
                    onClick={() => {
                      onClose();
                      navigate(`/catalog/${dsId}`);
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-left hover:border-blue-300 dark:hover:border-blue-700 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Database className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs truncate">
                        {dsName}
                      </span>
                    </div>
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">Inspect Dataset</span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Compliance Standards */}
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-2">
            Compliance Standards Covered
          </h4>
          <div className="p-3 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300 font-medium">
            {policy.compliance || (policy.complianceFrameworks ? policy.complianceFrameworks.join(', ') : 'GDPR, SOC 2, ISO 27001')}
          </div>
        </div>
      </div>
    </Drawer>
  );
}
