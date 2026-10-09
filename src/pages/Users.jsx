import React, { useState, useMemo } from 'react';
import { Plus, Search, ShieldCheck, Users as UsersIcon, CheckCircle2, XCircle } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/common/Button';
import UserTable from '../components/users/UserTable';
import AddUserModal from '../components/users/AddUserModal';
import PermissionGate from '../components/auth/PermissionGate';
import { useApp } from '../context/AppContext';
import { PERMISSIONS, ROLES, mapLegacyRole } from '../constants/rbac';

export default function Users() {
  const { users = [], addUser, deleteUser } = useApp();
  const [activeTab, setActiveTab] = useState('users');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const handleDeleteUser = (id) => {
    deleteUser(id);
  };

  // Metrics
  const metrics = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => (u.status || 'ACTIVE').toUpperCase() === 'ACTIVE').length;
    const mainAdmin = users.find((u) => u.isMainAdmin || mapLegacyRole(u.role) === ROLES.MAIN_ADMIN);
    return {
      total,
      active,
      mainAdminName: mainAdmin ? mainAdmin.name : 'Configured',
    };
  }, [users]);

  // Filtered employees
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Status filter
      if (statusFilter !== 'ALL') {
        const uStatus = (u.status || 'ACTIVE').toUpperCase();
        if (uStatus !== statusFilter) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (u.name || '').toLowerCase().includes(q);
        const emailMatch = (u.email || '').toLowerCase().includes(q);
        const deptMatch = (u.department || '').toLowerCase().includes(q);
        const roleMatch = (u.role || '').toLowerCase().includes(q);
        return nameMatch || emailMatch || deptMatch || roleMatch;
      }

      return true;
    });
  }, [users, searchQuery, statusFilter]);

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <PageHeader
        title="Employee Management"
        subtitle="Provision and govern employee accounts with full application functionality across the shared workspace."
        actions={
          <PermissionGate permission={PERMISSIONS.USER_CREATE}>
            <Button
              size="md"
              icon={Plus}
              onClick={() => setIsModalOpen(true)}
              className="w-full sm:w-auto"
            >
              Add Employee
            </Button>
          </PermissionGate>
        }
      />

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="enterprise-panel rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Accounts
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
              {metrics.total}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <UsersIcon className="w-5 h-5" />
          </div>
        </div>

        <div className="enterprise-panel rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Active Logins
            </div>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
              {metrics.active}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="enterprise-panel rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Main Admin
            </div>
            <div className="text-sm font-bold text-amber-600 dark:text-amber-400 mt-1 truncate max-w-[160px]">
              {metrics.mainAdminName}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Tabs matching RicozData UI */}
      <div className="border-b border-slate-200 dark:border-[#1D3047] -mx-3.5 px-3.5 sm:mx-0 sm:px-0">
        <nav role="tablist" aria-label="User directory views" className="flex space-x-6 overflow-x-auto no-scrollbar py-0.5">
          {[
            { id: 'users', label: 'Employees' },
            { id: 'roles', label: 'Roles & Permissions' },
            { id: 'groups', label: 'Departments' },
          ].map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`
                py-3 px-1 border-b-2 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xs
                ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Search and Filter Toolbar (only on Employees tab) */}
      {activeTab === 'users' && (
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, email, department, or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            {['ALL', 'ACTIVE', 'INACTIVE'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  statusFilter === st
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {st === 'ALL' ? 'All' : st === 'ACTIVE' ? 'Active' : 'Inactive'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Table / Grid */}
      <UserTable
        users={filteredUsers}
        activeTab={activeTab}
        onDeleteUser={handleDeleteUser}
      />

      {/* Add Employee Modal */}
      <AddUserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={addUser}
      />
    </div>
  );
}
