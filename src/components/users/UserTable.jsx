import React, { useState } from 'react';
import UserRow from './UserRow';
import UserDrawer from './UserDrawer';
import Badge from '../common/Badge';
import RoleBadge from './RoleBadge';
import { ChevronRight, Clock, Mail } from 'lucide-react';
import { ROLES, ROLE_LABELS, ROLE_PERMISSIONS, mapLegacyRole } from '../../constants/rbac';

const STANDARDIZED_ROLES = [
  {
    id: ROLES.MAIN_ADMIN,
    name: ROLE_LABELS[ROLES.MAIN_ADMIN] || 'Main Admin',
    roleKey: ROLES.MAIN_ADMIN,
    description: 'Designated Platform Main Admin with exclusive employee provisioning authority and full governance features.',
    permissions: ROLE_PERMISSIONS[ROLES.MAIN_ADMIN] || [],
  },
  {
    id: ROLES.EMPLOYEE,
    name: ROLE_LABELS[ROLES.EMPLOYEE] || 'Employee',
    roleKey: ROLES.EMPLOYEE,
    description: 'Full operational access across Data Sources, Catalog, SQL Studio, Lineage, Quality, and Governance.',
    permissions: ROLE_PERMISSIONS[ROLES.EMPLOYEE] || [],
  },
  {
    id: ROLES.SUPER_ADMIN,
    name: ROLE_LABELS[ROLES.SUPER_ADMIN],
    roleKey: ROLES.SUPER_ADMIN,
    description: 'Unrestricted full access across all platform modules, system configuration, and tenant security controls.',
    permissions: ROLE_PERMISSIONS[ROLES.SUPER_ADMIN] || [],
  },
  {
    id: ROLES.DATA_STEWARD,
    name: ROLE_LABELS[ROLES.DATA_STEWARD],
    roleKey: ROLES.DATA_STEWARD,
    description: 'Domain stewardship responsible for metadata certification, business glossary terms, and data quality rules.',
    permissions: ROLE_PERMISSIONS[ROLES.DATA_STEWARD] || [],
  },
  {
    id: ROLES.DATA_ENGINEER,
    name: ROLE_LABELS[ROLES.DATA_ENGINEER],
    roleKey: ROLES.DATA_ENGINEER,
    description: 'Data platform engineering with schema editing, pipeline lineage management, and quality telemetry access.',
    permissions: ROLE_PERMISSIONS[ROLES.DATA_ENGINEER] || [],
  },
  {
    id: ROLES.DATA_ANALYST,
    name: ROLE_LABELS[ROLES.DATA_ANALYST],
    roleKey: ROLES.DATA_ANALYST,
    description: 'Data discovery, catalog search, dataset registration, and read access to governance assets.',
    permissions: ROLE_PERMISSIONS[ROLES.DATA_ANALYST] || [],
  },
  {
    id: ROLES.VIEWER,
    name: ROLE_LABELS[ROLES.VIEWER],
    roleKey: ROLES.VIEWER,
    description: 'Read-only access across datasets, quality scores, lineage graphs, and enterprise glossary.',
    permissions: ROLE_PERMISSIONS[ROLES.VIEWER] || [],
  },
];

export default function UserTable({ users = [], activeTab = 'users', onDeleteUser }) {
  const [selectedUser, setSelectedUser] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setIsDrawerOpen(true);
  };

  if (activeTab === 'roles') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {STANDARDIZED_ROLES.map((role) => {
          const matchingUsers = users.filter((u) => mapLegacyRole(u.role) === role.roleKey);
          const count = matchingUsers.length;
          return (
            <div key={role.id} className="enterprise-panel rounded-lg p-4 sm:p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <RoleBadge role={role.roleKey} />
                  </h4>
                  <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium px-2 py-0.5 rounded-md tabular-nums">
                    {count} users
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                  {role.description}
                </p>
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                  Permissions ({role.permissions.length})
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                  {role.permissions.map((p, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-sm border border-slate-200/80 dark:border-[#1D3047] font-mono"
                    >
                      {p.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const dynamicGroups = React.useMemo(() => {
    const deptMap = {};
    if (Array.isArray(users)) {
      users.forEach(u => {
        const dept = u.department || 'Data Platform';
        if (!deptMap[dept]) {
          deptMap[dept] = {
            id: `group-${dept.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
            name: `${dept} Working Group`,
            description: `Governed domain operations and asset stewardship for ${dept}.`,
            membersCount: 0,
            lead: u.name
          };
        }
        deptMap[dept].membersCount += 1;
        if (u.role?.toLowerCase().includes('manager') || u.role?.toLowerCase().includes('lead') || u.role?.toLowerCase().includes('admin')) {
          deptMap[dept].lead = u.name;
        }
      });
    }
    return Object.values(deptMap);
  }, [users]);

  if (activeTab === 'groups') {
    if (dynamicGroups.length === 0) {
      return (
        <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">
          No organizational groups identified from registered users.
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {dynamicGroups.map((group) => (
          <div key={group.id} className="enterprise-panel rounded-lg p-4 sm:p-5">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{group.name}</h4>
              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-900/60 tabular-nums">
                {group.membersCount} {group.membersCount === 1 ? 'member' : 'members'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
              {group.description}
            </p>
            <div className="text-xs text-slate-600 dark:text-slate-300">
              Lead: <span className="font-semibold text-slate-900 dark:text-white">{group.lead}</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!users || users.length === 0) {
    return (
      <div className="enterprise-panel rounded-xl p-12 text-center space-y-3">
        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto">
          <Mail className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-bold text-slate-900 dark:text-white">No Employees Found</h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
          No employee accounts match the selected filters. Use the &quot;Add Employee&quot; button above to provision new accounts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Mobile User Cards (< md) */}
      <div className="md:hidden space-y-3">
        {users.map((user) => (
          <div
            key={user.id}
            onClick={() => handleSelectUser(user)}
            className="bg-white dark:bg-[#0D1828] rounded-xl p-4 border border-slate-200/80 dark:border-[#1D3047] active:scale-[0.99] transition-all cursor-pointer space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-9 h-9 rounded-full ${
                    user.avatarBg || 'bg-blue-600'
                  } text-white font-bold text-xs flex items-center justify-center shrink-0`}
                >
                  {user.avatar || 'U'}
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                    {user.name}
                  </h4>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                    <Mail className="w-3 h-3 shrink-0" />
                    <span className="truncate">{user.email}</span>
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-800/60 text-xs">
              <div className="flex items-center gap-2">
                <RoleBadge role={user.role} />
                <Badge status={user.status} size="xs" dot />
              </div>
              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                <Clock className="w-3 h-3" />
                <span>{user.lastActive || 'Never'}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop User Table (>= md) */}
      <div className="hidden md:block enterprise-workbench overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-[#0B1524] border-b border-slate-200/80 dark:border-[#1D3047] text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-2.5 px-4 w-1/4">User</th>
                <th className="py-2.5 px-4 w-1/4">Email Address</th>
                <th className="py-2.5 px-4">Role</th>
                <th className="py-2.5 px-4">Last Active</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {users.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  onSelect={handleSelectUser}
                  onDelete={onDeleteUser}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Detail Drawer */}
      <UserDrawer
        user={selectedUser}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </div>
  );
}
