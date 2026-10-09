import React, { useState } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import { RefreshCw, Key } from 'lucide-react';
import { ROLES, ROLE_LABELS } from '../../constants/rbac';

export default function AddUserModal({ isOpen, onClose, onAdd }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: 'EmpPassword123!',
    role: ROLES.EMPLOYEE,
    department: 'Data Platform',
    status: 'ACTIVE',
  });

  const [errors, setErrors] = useState({});

  // Employee creation only allows non-admin operational roles
  const assignableRoles = [
    ROLES.EMPLOYEE,
    ROLES.DATA_STEWARD,
    ROLES.DATA_ENGINEER,
    ROLES.DATA_ANALYST,
    ROLES.VIEWER
  ];

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let pass = 'Emp_';
    for (let i = 0; i < 8; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    pass += '!';
    setFormData((prev) => ({ ...prev, password: pass }));
  };

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
    if (!formData.email.trim()) newErrors.email = 'Corporate work email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Invalid email address format';
    if (!formData.password || formData.password.length < 8) newErrors.password = 'Initial password must be at least 8 characters';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onAdd(formData);
    onClose();
    setFormData({
      name: '',
      email: '',
      password: 'EmpPassword123!',
      role: ROLES.EMPLOYEE,
      department: 'Data Platform',
      status: 'ACTIVE',
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Employee"
      subtitle="Provision an employee account with full RicozData workspace access"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit}>
            Create Employee Account
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
          label="Corporate Work Email"
          placeholder="e.g. maya.patel@ricozdata.com"
          type="email"
          value={formData.email}
          onChange={(e) => handleChange('email', e.target.value)}
          error={errors.email}
          required
        />

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Initial Password
            </label>
            <button
              type="button"
              onClick={generateRandomPassword}
              className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Generate Secure</span>
            </button>
          </div>
          <Input
            placeholder="Min 8 characters with letters & numbers"
            type="text"
            value={formData.password}
            onChange={(e) => handleChange('password', e.target.value)}
            error={errors.password}
            required
          />
          <p className="text-[11px] text-slate-400 mt-1">
            The employee can use this credential to log in directly, or update it upon activation.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Assigned Role
            </label>
            <select
              value={formData.role}
              onChange={(e) => handleChange('role', e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] text-xs text-slate-900 dark:text-white py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              {assignableRoles.map((r) => (
                <option key={r} value={r} className="bg-white dark:bg-[#111C2E] text-slate-900 dark:text-white">
                  {r === ROLES.EMPLOYEE ? 'Employee (Full Access)' : (ROLE_LABELS[r] || r)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Department / Team
            </label>
            <input
              type="text"
              value={formData.department}
              onChange={(e) => handleChange('department', e.target.value)}
              placeholder="e.g. Data Platform"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Initial Account Status
          </label>
          <select
            value={formData.status}
            onChange={(e) => handleChange('status', e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E] text-xs text-slate-900 dark:text-white py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="ACTIVE" className="bg-white dark:bg-[#111C2E] text-slate-900 dark:text-white">Active (Immediate Login Enabled)</option>
            <option value="INACTIVE" className="bg-white dark:bg-[#111C2E] text-slate-900 dark:text-white">Inactive (Login Suspended)</option>
          </select>
        </div>
      </form>
    </Modal>
  );
}
