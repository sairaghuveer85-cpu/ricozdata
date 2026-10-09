import React from 'react';
import { ROLES, mapLegacyRole, getRoleLabel } from '../../constants/rbac';

export default function RoleBadge({ role }) {
  const normalizedRole = mapLegacyRole(role);
  const displayLabel = getRoleLabel(normalizedRole);

  const roleStyles = {
    [ROLES.SUPER_ADMIN]: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900',
    [ROLES.MAIN_ADMIN]: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-700 font-bold',
    [ROLES.ADMIN]: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900',
    [ROLES.EMPLOYEE]: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900 font-medium',
    [ROLES.DATA_STEWARD]: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
    [ROLES.DATA_ENGINEER]: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900',
    [ROLES.DATA_ANALYST]: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900',
    [ROLES.VIEWER]: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${
        roleStyles[normalizedRole] || 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
      }`}
    >
      {displayLabel}
    </span>
  );
}
