import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  ShieldCheck,
  Check,
  X,
  Lock,
  Unlock,
  AlertCircle,
  Database,
  Plus,
  Trash2,
  Info,
  UserCheck
} from 'lucide-react';
import Badge from '../common/Badge';
import Button from '../common/Button';
import Modal from '../common/Modal';
import PermissionGate from '../auth/PermissionGate';
import { PERMISSIONS, ROLES, ROLE_LABELS, ROLE_PERMISSIONS } from '../../constants/rbac';
import { accessControlApi } from '../../services/accessControlApi';
import { useApp } from '../../context/AppContext';

export default function AccessControlTab() {
  const { datasets, policies, users, addToast } = useApp();

  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  // Inspector state
  const [selectedResourceType, setSelectedResourceType] = useState('DATASET');
  const [selectedResourceId, setSelectedResourceId] = useState('');
  const [inspectionResult, setInspectionResult] = useState(null);
  const [inspecting, setInspecting] = useState(false);

  // Create Grant Modal
  const [isGrantModalOpen, setIsGrantModalOpen] = useState(false);
  const [grantData, setGrantData] = useState({
    resourceType: 'DATASET',
    resourceId: '',
    grantType: 'GRANT',
    principalType: 'USER',
    userId: '',
    role: ROLES.DATA_ANALYST,
    permissions: ['DATASET_READ'],
    reason: '',
  });

  const handleCloseGrantModal = useCallback(() => {
    setIsGrantModalOpen(false);
  }, []);

  const fetchOverview = async () => {
    try {
      const res = await accessControlApi.getOverview();
      if (res?.success) {
        setOverview(res.data);
      }
    } catch (err) {
      console.warn('Failed to load access overview:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const handleInspect = async (resType, resId) => {
    if (!resId) return;
    setInspecting(true);
    try {
      const res = await accessControlApi.inspectResource(resType, resId);
      if (res?.success) {
        setInspectionResult(res.data);
      }
    } catch (err) {
      addToast({ type: 'danger', title: 'Inspection Failed', message: err.message });
    } finally {
      setInspecting(false);
    }
  };

  const handleCreateGrant = async (e) => {
    e.preventDefault();
    if (!grantData.resourceId) {
      addToast({ type: 'warning', title: 'Validation', message: 'Resource must be selected' });
      return;
    }

    try {
      const res = await accessControlApi.createGrant(grantData);
      if (res?.success) {
        addToast({ type: 'success', title: 'Access Rule Created', message: 'Resource access grant/restriction saved.' });
        setIsGrantModalOpen(false);
        await handleInspect(selectedResourceType, selectedResourceId || grantData.resourceId);
        await fetchOverview();
      }
    } catch (err) {
      addToast({ type: 'danger', title: 'Failed to create access rule', message: err.message });
    }
  };

  const handleDeleteGrant = async (grantId) => {
    try {
      const res = await accessControlApi.deleteGrant(grantId);
      if (res?.success) {
        addToast({ type: 'info', title: 'Rule Revoked', message: 'Resource access rule revoked.' });
        if (selectedResourceId) {
          await handleInspect(selectedResourceType, selectedResourceId);
        }
        await fetchOverview();
      }
    } catch (err) {
      addToast({ type: 'danger', title: 'Revocation Failed', message: err.message });
    }
  };

  const rbacRoles = [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN,
    ROLES.DATA_STEWARD,
    ROLES.DATA_ENGINEER,
    ROLES.DATA_ANALYST,
    ROLES.VIEWER,
  ];

  return (
    <div className="space-y-6">
      {/* External Security Boundary Banner */}
      <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/20 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="font-bold text-sm text-blue-950 dark:text-blue-100">
            Enterprise Security Boundary Notice
          </h4>
          <p className="leading-relaxed text-slate-700 dark:text-slate-300">
            RicozData access control enforces permissions on <strong>RicozData application resources</strong> (Catalog metadata, Business Glossary, Governance Policies, Lineage, and Query Studio). It does not alter credentials or privileges inside connected external databases (PostgreSQL, MySQL, Snowflake, SQL Server, MongoDB) unless a specialized database administration integration is deployed.
          </p>
        </div>
      </div>

      {/* RBAC Permission Matrix Section */}
      <div className="enterprise-panel rounded-xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Role-Based Access Control (RBAC) Permission Matrix
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Governs fine-grained operation privileges across 6 standardized organizational roles
            </p>
          </div>
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/60 self-start">
            6 Enterprise Roles Configured
          </span>
        </div>

        <div className="overflow-x-auto text-xs -mx-4 px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-[#111C2E] border-b border-slate-200 dark:border-slate-800 text-left font-bold text-slate-600 dark:text-slate-300">
                <th className="py-3 px-4">Role Name</th>
                <th className="py-3 px-3 text-center">Catalog</th>
                <th className="py-3 px-3 text-center">Quality</th>
                <th className="py-3 px-3 text-center">Glossary</th>
                <th className="py-3 px-3 text-center">Policies</th>
                <th className="py-3 px-3 text-center">Rules</th>
                <th className="py-3 px-3 text-center">Compliance</th>
                <th className="py-3 px-3 text-center">Users</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {rbacRoles.map((roleKey) => {
                const perms = ROLE_PERMISSIONS[roleKey] || [];
                return (
                  <tr key={roleKey} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {ROLE_LABELS[roleKey] || roleKey}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {perms.includes(PERMISSIONS.DATASET_CREATE) ? 'Manage' : perms.includes(PERMISSIONS.DATASET_READ) ? 'Read' : 'None'}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {perms.includes(PERMISSIONS.QUALITY_MANAGE) ? 'Manage' : perms.includes(PERMISSIONS.QUALITY_READ) ? 'Read' : 'None'}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {perms.includes(PERMISSIONS.GLOSSARY_CREATE) ? 'Manage' : perms.includes(PERMISSIONS.GLOSSARY_READ) ? 'Read' : 'None'}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {perms.includes(PERMISSIONS.POLICY_CREATE) ? 'Manage' : perms.includes(PERMISSIONS.POLICY_READ) ? 'Read' : 'None'}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {perms.includes(PERMISSIONS.RULE_CREATE) ? 'Manage' : perms.includes(PERMISSIONS.RULE_EVALUATE) ? 'Evaluate' : perms.includes(PERMISSIONS.RULE_READ) ? 'Read' : 'None'}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {perms.includes(PERMISSIONS.COMPLIANCE_MANAGE) ? 'Manage' : perms.includes(PERMISSIONS.COMPLIANCE_READ) ? 'Read' : 'None'}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {perms.includes(PERMISSIONS.USER_CREATE) ? 'Manage' : perms.includes(PERMISSIONS.USER_READ) ? 'Read' : 'None'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resource Access Inspector Section */}
      <div className="enterprise-panel rounded-xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Resource Access Inspector & Overrides
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Inspect explicit grants, restrictions, and precedence hierarchy for governed resources
            </p>
          </div>
          <PermissionGate permission={PERMISSIONS.ACCESS_MANAGE}>
            <Button size="sm" icon={Plus} onClick={() => setIsGrantModalOpen(true)}>
              Grant / Restrict Access
            </Button>
          </PermissionGate>
        </div>

        {/* Resource Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Resource Type</label>
            <select
              value={selectedResourceType}
              onChange={(e) => {
                setSelectedResourceType(e.target.value);
                setSelectedResourceId('');
                setInspectionResult(null);
              }}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1628] p-2 text-slate-900 dark:text-white"
            >
              <option value="DATASET">Catalog Dataset</option>
              <option value="POLICY">Governance Policy</option>
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Target Resource</label>
            <select
              value={selectedResourceId}
              onChange={(e) => {
                setSelectedResourceId(e.target.value);
                handleInspect(selectedResourceType, e.target.value);
              }}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1628] p-2 text-slate-900 dark:text-white"
            >
              <option value="">Select Resource to Inspect...</option>
              {selectedResourceType === 'DATASET'
                ? datasets.map((d) => (
                    <option key={d.id || d._id} value={d.id || d._id}>
                      {d.name} ({d.tableName || 'Table'})
                    </option>
                  ))
                : policies.map((p) => (
                    <option key={p.id || p._id} value={p.id || p._id}>
                      {p.name}
                    </option>
                  ))}
            </select>
          </div>
        </div>

        {/* Inspection Result Display */}
        {inspectionResult && (
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-[11px] text-slate-400 block">Inspected Resource</span>
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  {inspectionResult.resourceName}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-slate-400 block">Designated Owner</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {inspectionResult.owner || 'Unassigned'}
                </span>
              </div>
            </div>

            {/* Overrides Table */}
            <div>
              <h5 className="font-bold text-slate-900 dark:text-white uppercase text-[11px] mb-1.5">
                Configured Resource Grants & Restrictions
              </h5>
              {inspectionResult.rules.length === 0 ? (
                <p className="text-xs text-slate-500 italic p-3 bg-slate-50/50 dark:bg-slate-900/40 rounded-lg border border-slate-200/60 dark:border-slate-800/60">
                  No resource-level overrides configured. Standard Role-Based Access Control (RBAC) applies to all users.
                </p>
              ) : (
                <div className="space-y-2">
                  {inspectionResult.rules.map((rule) => (
                    <div
                      key={rule._id}
                      className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1628] flex items-center justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              rule.grantType === 'RESTRICTION'
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                            }`}
                          >
                            {rule.grantType}
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {rule.principalType === 'USER' ? rule.userId?.name : `Role: ${rule.role}`}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Permissions: {rule.permissions.join(', ')} • Reason: {rule.reason || 'N/A'}
                        </p>
                      </div>
                      <PermissionGate permission={PERMISSIONS.ACCESS_MANAGE}>
                        <button
                          type="button"
                          onClick={() => handleDeleteGrant(rule._id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Revoke Rule"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </PermissionGate>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Precedence Notice */}
            <div className="p-3 rounded-lg bg-slate-50/70 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400">
              <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Authorization Precedence Order:
              </span>
              {inspectionResult.precedenceModel.join(' → ')}
            </div>
          </div>
        )}
      </div>

      {/* Create Grant/Restriction Modal */}
      <Modal
        isOpen={isGrantModalOpen}
        onClose={handleCloseGrantModal}
        title="Configure Resource Access Rule"
        subtitle="Create an explicit grant or restriction overriding standard RBAC"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={handleCloseGrantModal}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreateGrant}>
              Apply Access Rule
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateGrant} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Resource Type</label>
              <select
                value={grantData.resourceType}
                onChange={(e) => setGrantData({ ...grantData, resourceType: e.target.value, resourceId: '' })}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] p-2 text-slate-900 dark:text-white"
              >
                <option value="DATASET">Dataset</option>
                <option value="POLICY">Policy</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Target Resource</label>
              <select
                value={grantData.resourceId}
                onChange={(e) => setGrantData({ ...grantData, resourceId: e.target.value })}
                required
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] p-2 text-slate-900 dark:text-white"
              >
                <option value="">Select Resource...</option>
                {grantData.resourceType === 'DATASET'
                  ? datasets.map((d) => (
                      <option key={d.id || d._id} value={d.id || d._id}>
                        {d.name}
                      </option>
                    ))
                  : policies.map((p) => (
                      <option key={p.id || p._id} value={p.id || p._id}>
                        {p.name}
                      </option>
                    ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Rule Type</label>
              <select
                value={grantData.grantType}
                onChange={(e) => setGrantData({ ...grantData, grantType: e.target.value })}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] p-2 text-slate-900 dark:text-white"
              >
                <option value="GRANT">Explicit GRANT (Allow)</option>
                <option value="RESTRICTION">Explicit RESTRICTION (Deny)</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Principal Type</label>
              <select
                value={grantData.principalType}
                onChange={(e) => setGrantData({ ...grantData, principalType: e.target.value })}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] p-2 text-slate-900 dark:text-white"
              >
                <option value="USER">Specific User</option>
                <option value="ROLE">Role</option>
              </select>
            </div>
          </div>

          {grantData.principalType === 'USER' ? (
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">User</label>
              <select
                value={grantData.userId}
                onChange={(e) => setGrantData({ ...grantData, userId: e.target.value })}
                required
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] p-2 text-slate-900 dark:text-white"
              >
                <option value="">Select User...</option>
                {users.map((u) => (
                  <option key={u.id || u._id} value={u.id || u._id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Role</label>
              <select
                value={grantData.role}
                onChange={(e) => setGrantData({ ...grantData, role: e.target.value })}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] p-2 text-slate-900 dark:text-white"
              >
                {rbacRoles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r] || r}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Reason / Justification</label>
            <textarea
              rows={2}
              value={grantData.reason}
              onChange={(e) => setGrantData((prev) => ({ ...prev, reason: e.target.value }))}
              placeholder="e.g. Authorized compliance audit clearance"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] p-2 text-slate-900 dark:text-white"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
