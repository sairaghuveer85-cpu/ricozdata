import React, { useState, useEffect, useCallback } from 'react';
import {
  Award,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Shield,
  FileCheck,
  RefreshCw,
  Plus,
  Eye,
  Loader2,
  BarChart3,
  Calendar,
  Layers,
  FileText
} from 'lucide-react';
import Badge from '../common/Badge';
import Button from '../common/Button';
import Modal from '../common/Modal';
import Drawer from '../common/Drawer';
import EmptyState from '../common/EmptyState';
import PermissionGate from '../auth/PermissionGate';
import { PERMISSIONS } from '../../constants/rbac';
import { complianceApi } from '../../services/complianceApi';
import { useApp } from '../../context/AppContext';

export default function ComplianceTab() {
  const { addToast } = useApp();

  const [frameworks, setFrameworks] = useState([]);
  const [controls, setControls] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selectedFrameworkId, setSelectedFrameworkId] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Assess control modal
  const [assessingControl, setAssessingControl] = useState(null);
  const [assessmentData, setAssessmentData] = useState({
    status: 'COMPLIANT',
    notes: '',
  });

  // Selected control details drawer
  const [selectedControl, setSelectedControl] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [fwRes, ctRes, sumRes] = await Promise.allSettled([
        complianceApi.getFrameworks(),
        complianceApi.getControls({
          frameworkId: selectedFrameworkId !== 'all' ? selectedFrameworkId : undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          search,
        }),
        complianceApi.getSummary(),
      ]);

      if (fwRes.status === 'fulfilled' && fwRes.value?.success) {
        setFrameworks(fwRes.value.data || []);
      }
      if (ctRes.status === 'fulfilled' && ctRes.value?.success) {
        setControls(ctRes.value.data || []);
      }
      if (sumRes.status === 'fulfilled' && sumRes.value?.success) {
        setSummary(sumRes.value.data || null);
      }
    } catch (err) {
      console.warn('Failed to load compliance data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedFrameworkId, statusFilter, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCloseAssessModal = useCallback(() => {
    setAssessingControl(null);
  }, []);

  const handleOpenAssess = (control) => {
    setAssessingControl(control);
    setAssessmentData({
      status: control.status === 'NOT_ASSESSED' ? 'COMPLIANT' : control.status,
      notes: '',
    });
  };

  const handleSaveAssessment = async (e) => {
    e.preventDefault();
    if (!assessingControl) return;

    if (!assessmentData.notes || assessmentData.notes.trim().length < 5) {
      addToast({ type: 'warning', title: 'Validation', message: 'Assessment notes are required (min 5 characters)' });
      return;
    }

    try {
      const res = await complianceApi.assessControl(assessingControl.id || assessingControl._id, assessmentData);
      if (res?.success) {
        addToast({
          type: 'success',
          title: 'Assessment Recorded',
          message: `Control ${assessingControl.controlId} is now ${assessmentData.status}.`,
        });
        setAssessingControl(null);
        await fetchData();
      }
    } catch (err) {
      addToast({ type: 'danger', title: 'Assessment Failed', message: err.message });
    }
  };

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'COMPLIANT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Compliant</span>
          </span>
        );
      case 'PARTIALLY_COMPLIANT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Partially Compliant</span>
          </span>
        );
      case 'NON_COMPLIANT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60">
            <XCircle className="w-3.5 h-3.5" />
            <span>Non-Compliant</span>
          </span>
        );
      case 'NOT_APPLICABLE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
            <span>N/A</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Not Assessed</span>
          </span>
        );
    }
  };

  const metrics = summary?.metrics;

  return (
    <div className="space-y-6">
      {/* Deterministic Compliance Summary Card */}
      {metrics && (
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1628] shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Regulatory Compliance & Assessment Audit Summary
                </h4>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Deterministic calculation derived strictly from stored control assessments and live catalog metadata
              </p>
            </div>

            <div className="flex items-baseline gap-2 self-start sm:self-auto bg-slate-50 dark:bg-[#111C2E] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">Overall Readiness:</span>
              <span className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">
                {metrics.overallComplianceRate}%
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-50/70 dark:bg-slate-900/50">
              <span className="text-[11px] text-slate-400 block font-medium">Total Controls</span>
              <span className="text-base font-bold text-slate-900 dark:text-white">{metrics.totalControls}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/40">
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 block font-medium">Compliant</span>
              <span className="text-base font-bold text-emerald-700 dark:text-emerald-300">{metrics.compliantControls}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/40">
              <span className="text-[11px] text-amber-600 dark:text-amber-400 block font-medium">Partially Compliant</span>
              <span className="text-base font-bold text-amber-700 dark:text-amber-300">{metrics.partiallyCompliantControls}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/50 dark:border-rose-900/40">
              <span className="text-[11px] text-rose-600 dark:text-rose-400 block font-medium">Non-Compliant</span>
              <span className="text-base font-bold text-rose-700 dark:text-rose-300">{metrics.nonCompliantControls}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50/70 dark:bg-slate-900/50">
              <span className="text-[11px] text-slate-400 block font-medium">Unassessed</span>
              <span className="text-base font-bold text-slate-700 dark:text-slate-300">{metrics.unassessedControls}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50/70 dark:bg-slate-900/50">
              <span className="text-[11px] text-slate-400 block font-medium">Open Findings</span>
              <span className="text-base font-bold text-rose-600 dark:text-rose-400">{metrics.openFindingsCount}</span>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between">
            <span>Formula: {summary?.calculationFormula}</span>
            <span className="text-slate-500 font-sans">Internal readiness review; not formal legal certification</span>
          </div>
        </div>
      )}

      {/* Frameworks Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {frameworks.map((fw) => (
          <div
            key={fw.id || fw._id}
            onClick={() => setSelectedFrameworkId(fw.id || fw._id)}
            className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
              selectedFrameworkId === (fw.id || fw._id)
                ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/30 dark:bg-blue-950/20'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1628] hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                  {fw.identifier}
                </span>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  v{fw.version}
                </span>
              </div>
              <h5 className="font-bold text-sm text-slate-900 dark:text-white">{fw.name}</h5>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{fw.description}</p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                {fw.stats?.totalControls || 0} Controls Mapped
              </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {fw.stats?.complianceRate ?? 0}% Rate
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Controls Directory */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Compliance Controls & Evidentiary Tracking
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Mapped requirements with formal assessment justifications and catalog evidence
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1628] text-xs text-slate-700 dark:text-slate-300"
            >
              <option value="all">All Control Statuses</option>
              <option value="COMPLIANT">Compliant</option>
              <option value="PARTIALLY_COMPLIANT">Partially Compliant</option>
              <option value="NON_COMPLIANT">Non-Compliant</option>
              <option value="NOT_ASSESSED">Not Assessed</option>
            </select>
            {selectedFrameworkId !== 'all' && (
              <Button size="xs" variant="secondary" onClick={() => setSelectedFrameworkId('all')}>
                Show All Frameworks
              </Button>
            )}
          </div>
        </div>

        {/* Controls Table */}
        {loading ? (
          <div className="p-8 text-center bg-white dark:bg-[#0B1628] rounded-xl border border-slate-200 dark:border-slate-800">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500 mb-2" />
            <p className="text-xs text-slate-500">Loading compliance controls...</p>
          </div>
        ) : controls.length === 0 ? (
          <EmptyState
            icon={Award}
            title="No controls found"
            description="Adjust active filters or select a different framework."
          />
        ) : (
          <div className="enterprise-workbench overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-[#0B1524] border-b border-slate-200/80 dark:border-[#1D3047] text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Control ID</th>
                    <th className="py-3 px-4">Control Name & Scope</th>
                    <th className="py-3 px-4">Framework</th>
                    <th className="py-3 px-4">Linked Policies & Rules</th>
                    <th className="py-3 px-4">Assessment Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {controls.map((control) => (
                    <tr
                      key={control.id || control._id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        {control.controlId}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => setSelectedControl(control)}
                          className="font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 text-left cursor-pointer"
                        >
                          {control.name}
                        </button>
                        <p className="text-[11px] text-slate-500 truncate max-w-sm">{control.description}</p>
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                        {control.frameworkId?.identifier || 'General'}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        <div className="flex flex-col gap-0.5">
                          <span>
                            {control.policyIds?.length || 0} {control.policyIds?.length === 1 ? 'Policy' : 'Policies'}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {control.ruleIds?.length || 0} Automated {control.ruleIds?.length === 1 ? 'Rule' : 'Rules'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">{renderStatusBadge(control.status)}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <PermissionGate permission={PERMISSIONS.COMPLIANCE_MANAGE}>
                            <button
                              type="button"
                              onClick={() => handleOpenAssess(control)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-colors font-semibold cursor-pointer text-xs"
                            >
                              <FileCheck className="w-3.5 h-3.5" />
                              <span>Assess</span>
                            </button>
                          </PermissionGate>
                          <button
                            type="button"
                            onClick={() => setSelectedControl(control)}
                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Assess Control Modal */}
      <Modal
        isOpen={Boolean(assessingControl)}
        onClose={handleCloseAssessModal}
        title={`Assess Control: ${assessingControl?.controlId}`}
        subtitle={assessingControl?.name}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={handleCloseAssessModal}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveAssessment}>
              Commit Assessment
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveAssessment} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Assessment Status
            </label>
            <select
              value={assessmentData.status}
              onChange={(e) => setAssessmentData((prev) => ({ ...prev, status: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] p-2 text-slate-900 dark:text-white"
            >
              <option value="COMPLIANT">COMPLIANT — Requirements fully met by evidence</option>
              <option value="PARTIALLY_COMPLIANT">PARTIALLY COMPLIANT — Minor gaps or in-progress remediation</option>
              <option value="NON_COMPLIANT">NON-COMPLIANT — Core requirements deficient</option>
              <option value="NOT_APPLICABLE">NOT APPLICABLE — Out of organizational scope</option>
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Assessment Justification & Findings Summary
            </label>
            <textarea
              rows={3}
              value={assessmentData.notes}
              onChange={(e) => setAssessmentData((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="State the rationale, verified evidence snapshots, and any remediation actions..."
              required
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] p-2 text-slate-900 dark:text-white"
            />
          </div>

          <div className="p-3 rounded-lg bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/60 text-slate-700 dark:text-slate-300 text-[11px] leading-relaxed">
            Committing this assessment records an immutable evaluation audit entry in the activity log with your user identifier and timestamp.
          </div>
        </form>
      </Modal>

      {/* Control Details Drawer */}
      <Drawer
        isOpen={Boolean(selectedControl)}
        onClose={() => setSelectedControl(null)}
        title={selectedControl?.name || 'Control Details'}
        subtitle={`ID: ${selectedControl?.controlId} • Framework: ${selectedControl?.frameworkId?.identifier || 'General'}`}
      >
        {selectedControl && (
          <div className="space-y-4 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-[11px] text-slate-400 block mb-0.5">Current Status</span>
                {renderStatusBadge(selectedControl.status)}
              </div>
              <div className="text-right">
                <span className="text-[11px] text-slate-400 block mb-0.5">Last Assessed</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {selectedControl.lastAssessedAt ? new Date(selectedControl.lastAssessedAt).toLocaleDateString() : 'Never'}
                </span>
              </div>
            </div>

            <div>
              <h5 className="font-bold text-slate-900 dark:text-white uppercase text-[11px] mb-1">Description & Requirements</h5>
              <p className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1628] leading-relaxed">
                {selectedControl.description}
              </p>
            </div>

            <div>
              <h5 className="font-bold text-slate-900 dark:text-white uppercase text-[11px] mb-1">Linked Governance Policies</h5>
              <div className="space-y-1">
                {(selectedControl.policyIds || []).length === 0 ? (
                  <p className="text-slate-400 italic">No policies linked</p>
                ) : (
                  selectedControl.policyIds.map((p) => (
                    <div key={p._id || p} className="p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-medium">
                      {p.name || p}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <h5 className="font-bold text-slate-900 dark:text-white uppercase text-[11px] mb-1">Linked Automated Rules</h5>
              <div className="space-y-1">
                {(selectedControl.ruleIds || []).length === 0 ? (
                  <p className="text-slate-400 italic">No automated rules linked</p>
                ) : (
                  selectedControl.ruleIds.map((r) => (
                    <div key={r._id || r} className="p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-medium flex items-center justify-between">
                      <span>{r.name || r}</span>
                      {r.lastResult && <span className="font-mono text-[10px]">{r.lastResult}</span>}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
