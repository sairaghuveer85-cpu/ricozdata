import React, { useState } from 'react';
import UserRow from './UserRow';
import UserDrawer from './UserDrawer';
import Badge from '../common/Badge';
import { Trash2, ChevronRight, Clock, Mail } from 'lucide-react';
import { INITIAL_ROLES, INITIAL_GROUPS } from '../../data/users';

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
        {INITIAL_ROLES.map((role) => (
          <div key={role.id} className="enterprise-panel rounded-lg p-4 sm:p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{role.name}</h4>
                <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium px-2 py-0.5 rounded-md tabular-nums">
                  {role.usersCount} users
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                {role.description}
              </p>
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                Privileges
              </div>
              <div className="flex flex-wrap gap-1.5">
                {role.permissions.map((p, idx) => (
                  <span key={idx} className="text-[10px] bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-sm border border-slate-200/80 dark:border-[#1D3047]">
                    {p.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activeTab === 'groups') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {INITIAL_GROUPS.map((group) => (
          <div key={group.id} className="enterprise-panel rounded-lg p-4 sm:p-5">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{group.name}</h4>
              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-900/60 tabular-nums">
                {group.membersCount} members
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
                <div className={`w-9 h-9 rounded-full ${user.avatarBg || 'bg-blue-600'} text-white font-bold text-xs flex items-center justify-center shrink-0`}>
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
                <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-[11px]">
                  {user.role}
                </span>
                <Badge status={user.status} size="xs" dot />
              </div>
              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                <Clock className="w-3 h-3" />
                <span>{user.lastActive || 'Active today'}</span>
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
