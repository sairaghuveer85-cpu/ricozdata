import React from 'react';
import Drawer from '../common/Drawer';
import Button from '../common/Button';
import Badge from '../common/Badge';
import RoleBadge from './RoleBadge';
import { Mail, Building, Clock, Shield, Trash2, Key, History, Activity, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function UserDrawer({ user, isOpen, onClose }) {
  const { deleteUser, addToast } = useApp();

  if (!user) return null;

  const handleDelete = () => {
    if (window.confirm(`Revoke access and delete account for ${user.name}?`)) {
      deleteUser(user.id);
      onClose();
    }
  };

  const samplePermissions = {
    Admin: ['all_permissions', 'manage_users', 'manage_policies', 'export_data', 'edit_schemas'],
    'Data Owner': ['certify_datasets', 'manage_glossary', 'edit_metadata', 'view_all'],
    'Data Engineer': ['manage_lineage', 'configure_tests', 'edit_schemas', 'view_all'],
    'Data Analyst': ['query_data', 'view_lineage', 'view_quality', 'suggest_terms'],
    'Product Manager': ['view_catalog', 'view_glossary', 'export_reports']
  };

  const perms = samplePermissions[user.role] || ['view_catalog', 'view_glossary'];

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={user.name}
      subtitle={user.email}
      footer={
        <div className="flex items-center justify-between w-full">
          <Button
            variant="danger"
            size="sm"
            icon={Trash2}
            onClick={handleDelete}
          >
            Revoke Access
          </Button>
          <Button size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      }
    >
      <div className="space-y-6 text-xs text-slate-600 dark:text-slate-300">
        {/* User Card */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800">
          <div className={`w-14 h-14 rounded-full ${user.avatarBg || 'bg-blue-600'} text-white font-extrabold text-xl flex items-center justify-center shadow-md shrink-0`}>
            {user.avatar || 'U'}
          </div>
          <div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
              {user.name}
            </h4>
            <div className="flex items-center gap-2 mt-1">
              <RoleBadge role={user.role} />
              <Badge status={user.status} size="xs" dot />
            </div>
          </div>
        </div>

        {/* Metadata Details */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 text-slate-400">
              <Mail className="w-3.5 h-3.5" />
              <span>Email</span>
            </div>
            <span className="font-mono text-slate-800 dark:text-slate-200 font-medium">{user.email}</span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 text-slate-400">
              <Building className="w-3.5 h-3.5" />
              <span>Department</span>
            </div>
            <span className="text-slate-800 dark:text-slate-200 font-medium">{user.department || 'Analytics Platform'}</span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 text-slate-400">
              <Clock className="w-3.5 h-3.5" />
              <span>Last Active</span>
            </div>
            <span className="text-slate-800 dark:text-slate-200 font-medium">{user.lastActive || 'Today at 10:14 AM'}</span>
          </div>
        </div>

        {/* Permissions */}
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-blue-600" />
            <span>Active Permissions ({perms.length})</span>
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {perms.map(p => (
              <span
                key={p}
                className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[10px]"
              >
                {p.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-blue-600" />
            <span>Recent Activity</span>
          </h4>
          <div className="space-y-2">
            <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1628]">
              <p className="text-xs font-medium text-slate-800 dark:text-slate-200">Queried Customer Database (Gold Mart)</p>
              <span className="text-[10px] text-slate-400">45 minutes ago</span>
            </div>
            <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1628]">
              <p className="text-xs font-medium text-slate-800 dark:text-slate-200">Approved schema update on Marketing Campaigns</p>
              <span className="text-[10px] text-slate-400">Yesterday</span>
            </div>
          </div>
        </div>

        {/* Access History */}
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-blue-600" />
            <span>Access Audit History</span>
          </h4>
          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Last SOC 2 Recertification:</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Approved (Sep 2026)
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">MFA Enforced:</span>
              <span className="font-semibold text-slate-900 dark:text-white">Hardware Key / WebAuthn</span>
            </div>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
