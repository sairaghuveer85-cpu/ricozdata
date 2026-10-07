import React, { useState, useEffect, useCallback } from 'react';
import {
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  Clock,
  Shield,
  Plus,
  RefreshCw,
  Search,
  Filter,
  Eye,
  Check,
  Loader2,
  FileText,
  AlertCircle
} from 'lucide-react';
import Badge from '../common/Badge';
import Button from '../common/Button';
import Modal from '../common/Modal';
import Drawer from '../common/Drawer';
import EmptyState from '../common/EmptyState';
import PermissionGate from '../auth/PermissionGate';
import { PERMISSIONS } from '../../constants/rbac';
import { governanceRulesApi } from '../../services/governanceRulesApi';
import { useApp } from '../../context/AppContext';

export default function GovernanceRulesTab() {
  const { policies, datasets, addToast } = useApp();

  const [activeSubView, setActiveSubView] = useState('rules'); // 'rules' | 'findings'
  const [rules, setRules] = useState([]);
  const [findings, setFindings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [evaluatingRuleId, setEvaluatingRuleId] = useState(null);

  // Create rule modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newRuleData, setNewRuleData] = useState({
    name: '',
    description: '',
    policyId: '',
    category: 'PII_PROTECTION',
    ruleType: 'PII_CLASSIFICATION',
    severity: 'high',
    targetType: 'DATASET',
    datasetId: '',
  });

  const handleCloseCreateModal = useCallback(() => {
    setIsCreateModalOpen(false);
  }, []);

  // Selected rule or finding drawer
  const [selectedRule, setSelectedRule] = useState(null);
  const [selectedFinding, setSelectedFinding] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [rulesRes, findingsRes] = await Promise.allSettled([
        governanceRulesApi.getRules({ search, category: categoryFilter, severity: severityFilter }),
        governanceRulesApi.getFindings({ status: 'all' }),
      ]);

      if (rulesRes.status === 'fulfilled' && rulesRes.value?.success) {
        setRules(rulesRes.value.data || []);
      }
      if (findingsRes.status === 'fulfilled' && findingsRes.value?.success) {
        setFindings(findingsRes.value.data || []);
      }
    } catch (err) {
      console.warn('Failed to load governance rules or findings:', err);
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, severityFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleEvaluateRule = async (ruleId) => {
    setEvaluatingRuleId(ruleId);
    try {
      const res = await governanceRulesApi.evaluateRule(ruleId);
      if (res?.success) {
        addToast({
          type: res.data.result === 'PASS' ? 'success' : res.data.result === 'FAIL' ? 'warning' : 'info',
          title: `Rule Evaluated: ${res.data.result}`,
          message: res.data.summary,
        });
        await fetchData();
      }
    } catch (err) {
      addToast({
        type: 'danger',
        title: 'Evaluation Error',
        message: err.message || 'Could not evaluate rule',
      });
    } finally {
      setEvaluatingRuleId(null);
    }
  };

  const handleCreateRule = async (e) => {
    e.preventDefault();
    if (!newRuleData.name || !newRuleData.policyId) {
      addToast({ type: 'warning', title: 'Validation', message: 'Name and governing policy are required' });
      return;
    }

    try {
      const res = await governanceRulesApi.createRule(newRuleData);
      if (res?.success) {
        addToast({ type: 'success', title: 'Rule Created', message: `Rule "${res.data.name}" added to policy.` });
        setIsCreateModalOpen(false);
        setNewRuleData({
          name: '',
          description: '',
          policyId: '',
          category: 'PII_PROTECTION',
          ruleType: 'PII_CLASSIFICATION',
          severity: 'high',
          targetType: 'DATASET',
          datasetId: '',
        });
        await fetchData();
      }
    } catch (err) {
      addToast({ type: 'danger', title: 'Creation Failed', message: err.message });
    }
  };

  const handleUpdateFindingStatus = async (findingId, newStatus) => {
    try {
      const res = await governanceRulesApi.updateFindingStatus(findingId, { status: newStatus });
      if (res?.success) {
        setFindings((prev) =>
          prev.map((f) => (f.id === findingId || f._id === findingId ? { ...f, status: newStatus } : f))
        );
        addToast({ type: 'info', title: 'Status Updated', message: `Finding is now ${newStatus}` });
      }
    } catch (err) {
      addToast({ type: 'danger', title: 'Update Error', message: err.message });
    }
  };

  const renderResultBadge = (result) => {
    if (result === 'PASS') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>PASS</span>
        </span>
      );
    }
    if (result === 'FAIL') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60">
          <XCircle className="w-3.5 h-3.5" />
          <span>FAIL</span>
        </span>
      );
    }
    if (result === 'ERROR') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>ERROR</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
        <HelpCircle className="w-3.5 h-3.5" />
        <span>NOT EVALUATED</span>
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Sub-navigation & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-1">
          <button
            type="button"
            onClick={() => setActiveSubView('rules')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              activeSubView === 'rules'
                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Governance Rules ({rules.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubView('findings')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeSubView === 'findings'
                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>Governance Findings</span>
            {findings.filter((f) => f.status === 'OPEN').length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                {findings.filter((f) => f.status === 'OPEN').length}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={fetchData} disabled={loading}>
            Refresh
          </Button>
          <PermissionGate permission={PERMISSIONS.RULE_CREATE}>
            <Button size="sm" icon={Plus} onClick={() => setIsCreateModalOpen(true)}>
              New Rule
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* Rules SubView */}
      {activeSubView === 'rules' && (
        <div className="space-y-3">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search rules by name, target, or category..."
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1628] text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1628] text-xs text-slate-700 dark:text-slate-300"
            >
              <option value="all">All Categories</option>
              <option value="PII_PROTECTION">PII Protection</option>
              <option value="DATASET_OWNERSHIP">Dataset Ownership</option>
              <option value="GLOSSARY_ALIGNMENT">Glossary Alignment</option>
              <option value="QUALITY_THRESHOLD">Quality Threshold</option>
              <option value="SENSITIVITY_CLASSIFICATION">Sensitivity</option>
            </select>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1628] text-xs text-slate-700 dark:text-slate-300"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Rules Table */}
          {loading ? (
            <div className="p-8 text-center bg-white dark:bg-[#0B1628] rounded-xl border border-slate-200 dark:border-slate-800">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500 mb-2" />
              <p className="text-xs text-slate-500">Loading governance rules...</p>
            </div>
          ) : rules.length === 0 ? (
            <EmptyState
              icon={Shield}
              title="No governance rules found"
              description="Configure declarative rules under policies to monitor compliance automatically."
            />
          ) : (
            <div className="enterprise-workbench overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-[#0B1524] border-b border-slate-200/80 dark:border-[#1D3047] text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Rule Name</th>
                      <th className="py-3 px-4">Governing Policy</th>
                      <th className="py-3 px-4">Rule Type</th>
                      <th className="py-3 px-4">Severity</th>
                      <th className="py-3 px-4">Evaluation Status</th>
                      <th className="py-3 px-4">Last Evaluated</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {rules.map((rule) => {
                      const isEvaluating = evaluatingRuleId === rule.id || evaluatingRuleId === rule._id;
                      return (
                        <tr
                          key={rule.id || rule._id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <td className="py-3 px-4">
                            <button
                              type="button"
                              onClick={() => setSelectedRule(rule)}
                              className="font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 text-left cursor-pointer"
                            >
                              {rule.name}
                            </button>
                            <p className="text-[11px] text-slate-500 truncate max-w-xs">{rule.description}</p>
                          </td>
                          <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                            {rule.policyId?.name || 'Unlinked'}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                            {rule.ruleType}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                rule.severity === 'critical'
                                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                                  : rule.severity === 'high'
                                  ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-400'
                                  : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400'
                              }`}
                            >
                              {rule.severity}
                            </span>
                          </td>
                          <td className="py-3 px-4">{renderResultBadge(rule.lastResult)}</td>
                          <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                            {rule.lastRunAt ? new Date(rule.lastRunAt).toLocaleDateString() : 'Never'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <PermissionGate permission={PERMISSIONS.RULE_EVALUATE}>
                                <button
                                  type="button"
                                  onClick={() => handleEvaluateRule(rule.id || rule._id)}
                                  disabled={isEvaluating}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-colors font-semibold cursor-pointer text-xs"
                                >
                                  {isEvaluating ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Play className="w-3 h-3" />
                                  )}
                                  <span>Evaluate</span>
                                </button>
                              </PermissionGate>
                              <button
                                type="button"
                                onClick={() => setSelectedRule(rule)}
                                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                                title="View details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Findings SubView */}
      {activeSubView === 'findings' && (
        <div className="space-y-3">
          {findings.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-[#0B1628] rounded-xl border border-slate-200 dark:border-slate-800">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Zero Open Governance Findings</h4>
              <p className="text-xs text-slate-500 mt-1">All evaluated resources conform to current active governance policies.</p>
            </div>
          ) : (
            <div className="enterprise-workbench overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-[#0B1524] border-b border-slate-200/80 dark:border-[#1D3047] text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Finding / Violation</th>
                      <th className="py-3 px-4">Affected Resource</th>
                      <th className="py-3 px-4">Governing Policy</th>
                      <th className="py-3 px-4">Severity</th>
                      <th className="py-3 px-4">Detected</th>
                      <th className="py-3 px-4">Resolution Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {findings.map((f) => (
                      <tr key={f.id || f._id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => setSelectedFinding(f)}
                            className="font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 text-left cursor-pointer"
                          >
                            {f.title}
                          </button>
                          <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{f.explanation}</p>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                          {f.resourceName}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{f.policyId?.name || 'Policy'}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              f.severity === 'critical' || f.severity === 'high'
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                            }`}
                          >
                            {f.severity}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                          {new Date(f.detectedAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={f.status}
                            onChange={(e) => handleUpdateFindingStatus(f.id || f._id, e.target.value)}
                            className="py-1 px-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111C2E] text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
                          >
                            <option value="OPEN">OPEN</option>
                            <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
                            <option value="IN_PROGRESS">IN PROGRESS</option>
                            <option value="RESOLVED">RESOLVED</option>
                            <option value="IGNORED">IGNORED</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Rule Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        title="Create Governance Rule"
        subtitle="Translate policy requirements into automated checks"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={handleCloseCreateModal}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreateRule}>
              Save Rule
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateRule} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Rule Name</label>
            <input
              type="text"
              value={newRuleData.name}
              onChange={(e) => setNewRuleData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Sensitive Customer Column Classification"
              required
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] p-2 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Governing Policy</label>
            <select
              value={newRuleData.policyId}
              onChange={(e) => setNewRuleData({ ...newRuleData, policyId: e.target.value })}
              required
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] p-2 text-slate-900 dark:text-white"
            >
              <option value="">Select Governing Policy...</option>
              {policies.map((p) => (
                <option key={p.id || p._id} value={p.id || p._id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Rule Type</label>
              <select
                value={newRuleData.ruleType}
                onChange={(e) => setNewRuleData({ ...newRuleData, ruleType: e.target.value })}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] p-2 text-slate-900 dark:text-white"
              >
                <option value="PII_CLASSIFICATION">PII Classification</option>
                <option value="DATASET_OWNER_REQUIRED">Dataset Ownership</option>
                <option value="GLOSSARY_DEFINITION_REQUIRED">Glossary Definition</option>
                <option value="QUALITY_SCORE_THRESHOLD">Quality Score Threshold</option>
                <option value="SENSITIVITY_CLASSIFICATION">Sensitivity Classification</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Severity</label>
              <select
                value={newRuleData.severity}
                onChange={(e) => setNewRuleData({ ...newRuleData, severity: e.target.value })}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] p-2 text-slate-900 dark:text-white"
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Target Scope</label>
            <select
              value={newRuleData.datasetId}
              onChange={(e) => setNewRuleData({ ...newRuleData, datasetId: e.target.value })}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] p-2 text-slate-900 dark:text-white"
            >
              <option value="">Apply across all Policy Datasets</option>
              {datasets.map((d) => (
                <option key={d.id || d._id} value={d.id || d._id}>
                  {d.name} ({d.tableName || 'Table'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
            <textarea
              rows={2}
              value={newRuleData.description}
              onChange={(e) => setNewRuleData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="State what this rule verifies..."
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] p-2 text-slate-900 dark:text-white"
            />
          </div>
        </form>
      </Modal>

      {/* Selected Rule Details Drawer */}
      <Drawer
        isOpen={Boolean(selectedRule)}
        onClose={() => setSelectedRule(null)}
        title={selectedRule?.name || 'Rule Details'}
        subtitle={`Type: ${selectedRule?.ruleType} • Severity: ${selectedRule?.severity}`}
      >
        {selectedRule && (
          <div className="space-y-4 text-xs text-slate-600 dark:text-slate-300">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] text-slate-400 block mb-1">Evaluation Outcome</span>
              <div className="flex items-center gap-2">
                {renderResultBadge(selectedRule.lastResult)}
                <span className="text-slate-700 dark:text-slate-300">
                  {selectedRule.lastRunSummary || 'No recent execution recorded'}
                </span>
              </div>
            </div>

            <div>
              <h5 className="font-bold text-slate-900 dark:text-white mb-1 uppercase text-[11px]">Explanation</h5>
              <p className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1628] leading-relaxed">
                {selectedRule.lastRunExplanation || selectedRule.description || 'No execution explanation available.'}
              </p>
            </div>

            <div>
              <h5 className="font-bold text-slate-900 dark:text-white mb-1 uppercase text-[11px]">Governing Policy</h5>
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                {selectedRule.policyId?.name || 'Unassigned'}
              </p>
            </div>
          </div>
        )}
      </Drawer>

      {/* Selected Finding Drawer */}
      <Drawer
        isOpen={Boolean(selectedFinding)}
        onClose={() => setSelectedFinding(null)}
        title={selectedFinding?.title || 'Finding Details'}
        subtitle={`Resource: ${selectedFinding?.resourceName} • Status: ${selectedFinding?.status}`}
      >
        {selectedFinding && (
          <div className="space-y-4 text-xs text-slate-600 dark:text-slate-300">
            <div>
              <span className="text-[11px] text-slate-400 block mb-1">Violation Explanation</span>
              <p className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-300 leading-relaxed">
                {selectedFinding.explanation}
              </p>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 block mb-1">Captured Evidence Snapshot</span>
              <pre className="p-3 rounded-lg bg-slate-900 text-slate-200 overflow-x-auto text-[11px] font-mono">
                {JSON.stringify(selectedFinding.evidence, null, 2)}
              </pre>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 block mb-1">Detection Timestamp</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {new Date(selectedFinding.detectedAt).toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
