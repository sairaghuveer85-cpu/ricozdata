import React, { useState } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import { ROLES, ROLE_LABELS } from '../../constants/rbac';
import { useApp } from '../../context/AppContext';

export default function AddUserModal({ isOpen, onClose, onAdd }) {
  const { currentUser } = useApp();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: 'Password123!',
    role: ROLES.DATA_ANALYST,
    department: 'Analytics',
    status: 'ACTIVE',
  });

  const [errors, setErrors] = useState({});

  // Determine allowed roles to assign
  const isSuperAdmin = currentUser?.role === ROLES.SUPER_ADMIN;
  const assignableRoles = Object.values(ROLES).filter((r) => {
    if (r === ROLES.SUPER_ADMIN && !isSuperAdmin) return false;
    return true;
  });

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Full name is required';
    if (!formData.email.trim()) newErrors.email = 'Corporate email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Invalid email address';
    if (!formData.password || formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onAdd(formData);
    onClose();
    setFormData({
      name: '',
      email: '',
      password: 'Password123!',
      role: ROLES.DATA_ANALYST,
      department: 'Analytics',
      status: 'ACTIVE',
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New User"
      subtitle="Invite a colleague or team member to access RicozData workspace"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit}>
            Create User Account
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Full Name"
          placeholder="e.g. Maya Patel"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          error={errors.name}
          required
        />

        <Input
          label="Corporate Email"
          placeholder="e.g. maya.patel@ricoz-industries.demo"
          type="email"
          value={formData.email}
          onChange={(e) => handleChange('email', e.target.value)}
          error={errors.email}
          required
        />

        <Input
          label="Initial Password"
          placeholder="Password123!"
          type="password"
          value={formData.password}
          onChange={(e) => handleChange('password', e.target.value)}
          error={errors.password}
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Role
            </label>
            <select
              value={formData.role}
              onChange={(e) => handleChange('role', e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] text-xs text-slate-900 dark:text-white py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              {assignableRoles.map((r) => (
                <option key={r} value={r} className="bg-white dark:bg-[#111C2E] text-slate-900 dark:text-white">
                  {ROLE_LABELS[r] || r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Department
            </label>
            <input
              type="text"
              value={formData.department}
              onChange={(e) => handleChange('department', e.target.value)}
              placeholder="e.g. Data Science"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Account Status
          </label>
          <select
            value={formData.status}
            onChange={(e) => handleChange('status', e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] text-xs text-slate-900 dark:text-white py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="ACTIVE" className="bg-white dark:bg-[#111C2E] text-slate-900 dark:text-white">Active</option>
            <option value="INACTIVE" className="bg-white dark:bg-[#111C2E] text-slate-900 dark:text-white">Inactive</option>
            <option value="SUSPENDED" className="bg-white dark:bg-[#111C2E] text-slate-900 dark:text-white">Suspended</option>
          </select>
        </div>
      </form>
    </Modal>
  );
}
