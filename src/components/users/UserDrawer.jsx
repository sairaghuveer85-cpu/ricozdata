import React, { useState } from 'react';
import Drawer from '../common/Drawer';
import Button from '../common/Button';
import Badge from '../common/Badge';
import RoleBadge from './RoleBadge';
import {
  Mail,
  Building,
  Clock,
  Trash2,
  Key,
  History,
  Activity,
  ShieldAlert,
  RotateCcw,
  CheckCircle,
  XCircle,
  Copy,
  Calendar
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getPermissionsForRole, PERMISSIONS } from '../../constants/rbac';

export default function UserDrawer({ user, isOpen, onClose }) {
  const {
    deleteUser,
    updateUser,
    resetUserPassword,
    currentUser,
    canManage,
    hasPermission,
    activities = []
  } = useApp();

  const [resetTokenInfo, setResetTokenInfo] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  if (!user) return null;

  const isSelf = currentUser?.id === user.id || currentUser?.email === user.email;
  const isTargetMainAdmin = user.isMainAdmin || user.role === 'MAIN_ADMIN';
  const canDelete = hasPermission(PERMISSIONS.USER_DELETE) && canManage(user.role) && !isSelf && !isTargetMainAdmin;
  const canModify = hasPermission(PERMISSIONS.USER_UPDATE) && !isTargetMainAdmin;

  const handleDelete = () => {
    if (window.confirm(`Revoke access and delete account for ${user.name}? This operation is permanent.`)) {
      deleteUser(user.id);
      onClose();
    }
  };

  const handleToggleStatus = async () => {
    if (isTargetMainAdmin) return;
    const newStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setIsUpdatingStatus(true);
    try {
      await updateUser(user.id, { status: newStatus });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleResetPassword = async () => {
    const defaultNewPass = `Emp_${Math.random().toString(36).substring(2, 8)}!`;
    const newPass = window.prompt(
      `Enter new temporary password for ${user.name} (or keep auto-generated):`,
      defaultNewPass
    );
    if (!newPass) return;

    const res = await resetUserPassword(user.id, newPass);
    if (res?.activationToken) {
      setResetTokenInfo({
        token: res.activationToken,
        password: newPass
      });
    }
  };

  const perms = getPermissionsForRole(user.role);
  const userActivities = activities.filter(a => a.user === user.name || a.userId === user.id || a.actorId === user.id);
  const createdDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Active Member';

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={user.name}
      subtitle={user.email}
      footer={
        <div className="flex flex-col-reverse sm:flex-row gap-2 w-full sm:justify-between items-center">
          {canDelete ? (
            <Button
              variant="danger"
              size="sm"
              icon={Trash2}
              onClick={handleDelete}
              className="w-full sm:w-auto"
            >
              Delete Account
            </Button>
          ) : (
            <div className="text-[11px] text-slate-400 dark:text-slate-500 py-1">
              {isTargetMainAdmin
                ? 'Designated Main Admin account is protected'
                : isSelf
                ? 'Cannot delete your own account'
                : 'Insufficient permission to delete'}
            </div>
          )}
          <Button size="sm" onClick={onClose} className="w-full sm:w-auto">
            Done
          </Button>
        </div>
      }
    >
      <div className="space-y-6 text-xs text-slate-600 dark:text-slate-300">
        {/* User Card */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800">
          <div className={`w-14 h-14 rounded-full ${user.avatarBg || 'bg-blue-600'} text-white font-extrabold text-xl flex items-center justify-center shadow-md shrink-0`}>
            {user.avatar || 'E'}
          </div>
          <div className="min-w-0">
            <h4 className="text-base font-bold text-slate-900 dark:text-white leading-tight truncate">
              {user.name}
            </h4>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <RoleBadge role={user.role} />
              <Badge status={user.status} size="xs" dot />
              {isTargetMainAdmin && (
                <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                  Designated Main Admin
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Status & Password Management Actions */}
        {canModify && (
          <div className="p-3.5 rounded-xl bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
            <h5 className="font-bold text-[11px] text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Account Management
            </h5>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={user.status === 'ACTIVE' ? 'secondary' : 'primary'}
                size="xs"
                icon={user.status === 'ACTIVE' ? XCircle : CheckCircle}
                onClick={handleToggleStatus}
                disabled={isUpdatingStatus}
              >
                {user.status === 'ACTIVE' ? 'Deactivate Account' : 'Activate Account'}
              </Button>
              <Button
                variant="secondary"
                size="xs"
                icon={RotateCcw}
                onClick={handleResetPassword}
              >
                Reset Password / Token
              </Button>
            </div>

            {resetTokenInfo && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 space-y-1.5 text-emerald-300">
                <div className="font-semibold text-xs text-emerald-400">Temporary Password Configured:</div>
                <div className="font-mono text-xs bg-slate-950/60 p-2 rounded select-all text-white">
                  {resetTokenInfo.password}
                </div>
                {resetTokenInfo.token && (
                  <div className="text-[10px] text-emerald-300/80">
                    Activation token: <span className="font-mono text-white select-all">{resetTokenInfo.token}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Metadata Details */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 text-slate-400">
              <Mail className="w-3.5 h-3.5" />
              <span>Work Email</span>
            </div>
            <span className="font-mono text-slate-800 dark:text-slate-200 font-medium">{user.email}</span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 text-slate-400">
              <Building className="w-3.5 h-3.5" />
              <span>Department</span>
            </div>
            <span className="text-slate-800 dark:text-slate-200 font-medium">{user.department || 'Data Platform'}</span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 text-slate-400">
              <Calendar className="w-3.5 h-3.5" />
              <span>Created Date</span>
            </div>
            <span className="text-slate-800 dark:text-slate-200 font-medium">{createdDate}</span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 text-slate-400">
              <Clock className="w-3.5 h-3.5" />
              <span>Last Active</span>
            </div>
            <span className="text-slate-800 dark:text-slate-200 font-medium">{user.lastActive || 'Never'}</span>
          </div>
        </div>

        {/* Permissions */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-blue-600" />
              <span>Application Permissions ({perms.length})</span>
            </h4>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-1 bg-slate-50 dark:bg-[#0A1322] rounded-lg border border-slate-200 dark:border-slate-800">
            {perms.map(p => (
              <span
                key={p}
                className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[10px] border border-slate-200/80 dark:border-slate-700/60"
              >
                {p.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>

        {/* Security Summary */}
        <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">Account Governance:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {isTargetMainAdmin ? 'Main Admin (Sole Provisioner)' : 'Controlled Employee Login'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">Account Status:</span>
            <span className={`font-semibold ${user.status === 'ACTIVE' ? 'text-emerald-500' : 'text-amber-500'}`}>
              {user.status || 'ACTIVE'}
            </span>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
