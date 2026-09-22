import React, { useState } from 'react';
import { Plus, Users as UsersIcon, Shield, Layers, CheckCircle2 } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/common/Button';
import UserTable from '../components/users/UserTable';
import AddUserModal from '../components/users/AddUserModal';
import { useApp } from '../context/AppContext';

export default function Users() {
  const { users, addUser, deleteUser } = useApp();
  const [activeTab, setActiveTab] = useState('users');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleDeleteUser = (id) => {
    if (window.confirm('Are you sure you want to remove this user account?')) {
      deleteUser(id);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header matching Screen 9 */}
      <PageHeader
        title="User Management"
        subtitle="Manage users and access across your organization."
        actions={
          <Button
            size="md"
            icon={Plus}
            onClick={() => setIsModalOpen(true)}
          >
            Add User
          </Button>
        }
      />

      {/* Tabs matching Screen 9: Users, Roles, Groups */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="flex space-x-6">
          {[
            { id: 'users', label: 'Users' },
            { id: 'roles', label: 'Roles' },
            { id: 'groups', label: 'Groups' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`
                py-3 px-1 border-b-2 text-xs font-semibold transition-colors cursor-pointer
                ${activeTab === tab.id
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

      {/* Table / Grid */}
      <UserTable
        users={users}
        activeTab={activeTab}
        onDeleteUser={handleDeleteUser}
      />

      {/* Add User Modal */}
      <AddUserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={addUser}
      />
    </div>
  );
}
