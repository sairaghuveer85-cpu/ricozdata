import React, { useState } from 'react';
import Badge from '../common/Badge';
import { Check, X, Shield, ShieldCheck, Clock, FileCheck, Award, Play, AlertCircle, Loader2 } from 'lucide-react';
import { ROLES, ROLE_LABELS, ROLE_PERMISSIONS, PERMISSIONS } from '../../constants/rbac';
import { useApp } from '../../context/AppContext';

export default function RulesTable({ activeSubTab, datasetId, rules: propRules }) {
  const { rules: contextRules, qualityRules, runQualityRule, policies } = useApp();
  const [runningId, setRunningId] = useState(null);

  const allRules = propRules || (qualityRules && qualityRules.length > 0 ? qualityRules : contextRules);
  const rulesToRender = datasetId
    ? allRules.filter(r => r.datasetId === datasetId || r.datasetId?._id === datasetId || String(r.datasetId) === String(datasetId))
    : allRules;

  const handleRun = async (ruleId) => {
    setRunningId(ruleId);
    try {
      if (runQualityRule) await runQualityRule(ruleId);
    } catch (err) {
      console.warn('Rule run error:', err);
    } finally {
      setRunningId(null);
    }
  };

  if (activeSubTab === 'rules') {
    if (!rulesToRender || rulesToRender.length === 0) {
      return (
        <div className="bg-white dark:bg-[#0B1628] rounded-xl p-8 border border-slate-200 dark:border-slate-800 text-center">
          <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white">No Quality Rules Configured</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            No active validation rules are linked to this dataset yet. Trigger a quality evaluation to inspect and verify dataset schema constraints.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {/* Mobile Rules Cards (< md) */}
        <div className="md:hidden space-y-3">
          {rulesToRender.map((rule) => {
            const ruleId = rule._id || rule.id;
            const targetCol = rule.field || rule.targetColumn || 'All columns';
            const constraintType = rule.ruleType || rule.type || 'VALIDATION';
            const ruleStatus = rule.lastResult ? (rule.lastResult === 'pass' ? 'Active' : 'In Review') : (rule.status || 'Active');

            return (
              <div
                key={ruleId}
                className="bg-white dark:bg-[#0B1628] rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white leading-snug">
                      {rule.name}
                    </h4>
                    <div className="mt-1">
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {targetCol}
                      </span>
                    </div>
                  </div>
                  <Badge
                    status={ruleStatus}
                    size="sm"
                    dot
                  >
                    {rule.lastResult || ruleStatus}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100 dark:border-slate-800/60">
                  <div>
                    <span className="text-[11px] text-slate-400 block">Constraint Type</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{constraintType}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block">Threshold</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{rule.threshold != null ? `${rule.threshold}%` : '95%'}</span>
                  </div>
                  <div className="col-span-2 pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60">
                    <span className="text-[11px] text-slate-400">Severity: <span className="font-semibold text-slate-700 dark:text-slate-300 capitalize">{rule.severity || 'Medium'}</span></span>
                    <button
                      type="button"
                      onClick={() => handleRun(ruleId)}
                      disabled={runningId === ruleId}
                      className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-colors"
                    >
                      {runningId === ruleId ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                      <span>Execute</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop Rules Table (>= md) */}
        <div className="hidden md:block enterprise-workbench overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-[#0B1524] border-b border-slate-200/80 dark:border-[#1D3047] text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-5">Rule Name</th>
                  <th className="py-3 px-5">Target Column</th>
                  <th className="py-3 px-5">Constraint Type</th>
                  <th className="py-3 px-5">Threshold</th>
                  <th className="py-3 px-5">Severity</th>
                  <th className="py-3 px-5">Last Result</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {rulesToRender.map((rule) => {
                  const ruleId = rule._id || rule.id;
                  const targetCol = rule.field || rule.targetColumn || 'All columns';
                  const constraintType = rule.ruleType || rule.type || 'VALIDATION';
                  const ruleStatus = rule.lastResult ? (rule.lastResult === 'pass' ? 'Active' : 'In Review') : (rule.status || 'Active');

                  return (
                    <tr key={ruleId} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3.5 px-5 font-bold text-slate-900 dark:text-white">{rule.name}</td>
                      <td className="py-3.5 px-5 font-mono text-slate-600 dark:text-slate-300">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                          {targetCol}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-slate-600 dark:text-slate-400">{constraintType}</td>
                      <td className="py-3.5 px-5 font-semibold text-slate-700 dark:text-slate-200">{rule.threshold != null ? `${rule.threshold}%` : '95%'}</td>
                      <td className="py-3.5 px-5 text-slate-500 dark:text-slate-400 capitalize">{rule.severity || 'Medium'}</td>
                      <td className="py-3.5 px-5">
                        <Badge
                          status={ruleStatus}
                          size="sm"
                          dot
                        >
                          {rule.lastResult || ruleStatus}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <button
                          type="button"
                          onClick={() => handleRun(ruleId)}
                          disabled={runningId === ruleId}
                          className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-colors cursor-pointer"
                        >
                          {runningId === ruleId ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                          <span>Execute</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Access Control: Permission Matrix dynamically derived from standardized RBAC config
  if (activeSubTab === 'access') {
    const rbacRoles = [
      ROLES.SUPER_ADMIN,
      ROLES.ADMIN,
      ROLES.DATA_STEWARD,
      ROLES.DATA_ENGINEER,
      ROLES.DATA_ANALYST,
      ROLES.VIEWER
    ];

    const permissionRows = rbacRoles.map(roleKey => {
      const perms = ROLE_PERMISSIONS[roleKey] || [];
      return {
        role: ROLE_LABELS[roleKey] || roleKey,
        view: perms.includes(PERMISSIONS.DATASET_READ),
        create: perms.includes(PERMISSIONS.DATASET_CREATE),
        edit: perms.includes(PERMISSIONS.DATASET_UPDATE),
        delete: perms.includes(PERMISSIONS.DATASET_DELETE),
        export: perms.includes(PERMISSIONS.DATASET_EXPORT),
        managePolicies: perms.includes(PERMISSIONS.POLICY_CREATE)
      };
    });

    return (
      <div className="enterprise-panel rounded-xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Role-Based Access Control (RBAC) Permission Matrix</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Governs fine-grained operation privileges across organizational roles
            </p>
          </div>
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/60 self-start">
            6 Enterprise Roles Defined
          </span>
        </div>

        <div className="overflow-x-auto text-xs -mx-4 px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[560px] border-collapse">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-[#111C2E] border-b border-slate-200 dark:border-slate-800 text-left font-bold text-slate-600 dark:text-slate-300">
                <th className="py-3 px-3 sm:px-4">Role Name</th>
                <th className="py-3 px-2 sm:px-4 text-center">View</th>
                <th className="py-3 px-2 sm:px-4 text-center">Create</th>
                <th className="py-3 px-2 sm:px-4 text-center">Edit</th>
                <th className="py-3 px-2 sm:px-4 text-center">Delete</th>
                <th className="py-3 px-2 sm:px-4 text-center">Export</th>
                <th className="py-3 px-2 sm:px-4 text-center">Manage Policies</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {permissionRows.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-3 sm:px-4 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                    {row.role}
                  </td>
                  {['view', 'create', 'edit', 'delete', 'export', 'managePolicies'].map((colKey) => {
                    const isGranted = row[colKey];
                    return (
                      <td key={colKey} className="py-3.5 px-2 sm:px-4 text-center">
                        {isGranted ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                            <Check className="w-3.5 h-3.5" />
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600">
                            <X className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Compliance: Derived from active policies or honest empty state
  const frameworksMap = {};
  if (Array.isArray(policies)) {
    policies.forEach(p => {
      if (Array.isArray(p.complianceFrameworks)) {
        p.complianceFrameworks.forEach(fw => {
          if (!frameworksMap[fw]) {
            frameworksMap[fw] = { name: fw, count: 0, status: p.status || 'Active' };
          }
          frameworksMap[fw].count += 1;
        });
      }
    });
  }

  const activeFrameworks = Object.values(frameworksMap);

  if (activeFrameworks.length === 0) {
    return (
      <div className="bg-white dark:bg-[#0B1628] rounded-xl p-8 border border-slate-200 dark:border-slate-800 text-center">
        <Award className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">No Compliance Frameworks Configured</h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
          No compliance standards are mapped to policies yet. Create policies and associate frameworks (e.g. GDPR, SOC 2, ISO 27001) to monitor regulatory coverage.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
      {activeFrameworks.map((fw, idx) => (
        <div
          key={idx}
          className="bg-white dark:bg-[#0B1628] rounded-xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/60 flex items-center justify-center">
                <Award className="w-5 h-5" />
              </div>
              <Badge status={fw.status === 'Certified' ? 'Certified' : 'Active'} size="sm" dot>
                {fw.status}
              </Badge>
            </div>

            <h4 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
              {fw.name}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Standard mapped across {fw.count} active governance {fw.count === 1 ? 'policy' : 'policies'}.
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
