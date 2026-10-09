import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Database,
  Building,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Shield,
  ShieldCheck,
  GitFork,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import Button from '../components/common/Button';

export default function Register() {
  const navigate = useNavigate();
  const { register, isAuthenticated } = useApp();

  const [organizationName, setOrganizationName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If already authenticated with a valid token, direct to dashboard
  useEffect(() => {
    const rawJwt = localStorage.getItem('ricoz_jwt');
    const isAuth = localStorage.getItem('ricoz-authenticated') === 'true';
    if (isAuthenticated && rawJwt && isAuth) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e && e.preventDefault();
    setError('');

    if (!organizationName.trim()) {
      setError('Please enter your organization or workspace name.');
      return;
    }
    if (!name.trim()) {
      setError('Please enter your administrator full name.');
      return;
    }
    if (!email.trim()) {
      setError('Please enter your corporate work email.');
      return;
    }
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);

    try {
      const res = await register({
        organizationName: organizationName.trim(),
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password
      });

      if (res && res.success) {
        // Automatically redirects into the fresh workspace dashboard
        navigate('/dashboard', { replace: true });
      } else {
        setError(res?.message || 'Failed to create organization account. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'An error occurred during registration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col md:flex-row w-full transition-colors"
      style={{
        backgroundColor: 'var(--color-background)',
        color: 'var(--color-text-primary)'
      }}
    >
      {/* Left: Dark Navy Visual Area with Enterprise Brand Hero */}
      <div className="relative w-full md:w-[50%] lg:w-[52%] bg-[#08101e] p-6 sm:p-10 lg:p-14 flex flex-col justify-between text-white overflow-hidden select-none min-h-0 md:min-h-screen border-b md:border-b-0 md:border-r border-slate-800">
        {/* Subtle Architectural SVG Data Grid Background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-25" aria-hidden="true">
          <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <pattern id="registerGrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1" fill="#475569" opacity="0.4" />
            </pattern>
            <rect width="100%" height="100%" fill="url(#registerGrid)" />

            <path d="M-40 180 C 140 100, 260 360, 540 220 C 780 120, 940 300, 1120 240" fill="none" stroke="#2563eb" strokeWidth="1.2" opacity="0.6" />
            <path d="M-40 260 C 180 160, 300 420, 600 300 C 860 180, 1020 380, 1200 320" fill="none" stroke="#3b82f6" strokeWidth="1" strokeDasharray="5 5" opacity="0.4" />
            <circle cx="180" cy="190" r="3.5" fill="#3b82f6" />
            <circle cx="360" cy="310" r="4" fill="#60a5fa" />
            <circle cx="540" cy="220" r="4.5" fill="#3b82f6" />
          </svg>
        </div>

        {/* Top: Brand Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-md bg-blue-600 flex items-center justify-center text-white shadow-2xs shrink-0" aria-hidden="true">
            <Database className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div>
            <span className="text-lg sm:text-xl font-bold text-white tracking-tight leading-none block">RicozData</span>
            <span className="text-[10px] font-medium text-slate-400 tracking-wider uppercase">Enterprise Multi-Tenant Governance</span>
          </div>
        </div>

        {/* Center: Main Headline & Core Capabilities */}
        <div className="relative z-10 my-auto py-4 sm:py-6 md:py-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-900/50 border border-blue-700/50 text-xs font-semibold text-blue-300 mb-4">
              <Building className="w-3.5 h-3.5" />
              <span>Workspace Provisioning</span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight leading-[1.2]">
              Initialize Your Isolated<br />
              <span className="text-blue-400">Enterprise Workspace.</span>
            </h1>

            <p className="mt-3 text-xs sm:text-sm text-slate-400 max-w-md leading-relaxed">
              Every organization receives dedicated tenant isolation, a fresh catalog inventory, customized data health metrics, and comprehensive employee account governance.
            </p>

            {/* Tenant Capabilities Highlights */}
            <div className="mt-6 space-y-2.5 max-w-md">
              {[
                { label: 'Workspace Administrator', desc: 'Full operational access and exclusive employee provisioning authority', icon: ShieldCheck },
                { label: 'Fresh Catalog & Health', desc: 'Isolated metadata metrics without cross-organization data pollution', icon: Database },
                { label: 'Role-Based Control', desc: 'Multi-tiered access control for stewardship and pipeline teams', icon: GitFork }
              ].map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-md bg-blue-950/80 border border-blue-900/50 flex items-center justify-center text-blue-400 shrink-0" aria-hidden="true">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-white block leading-tight">{item.label}</span>
                      <span className="text-[11px] text-slate-400 block leading-tight mt-0.5">{item.desc}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom Tagline */}
        <div className="hidden sm:flex relative z-10 pt-4 border-t border-slate-800/80 items-center justify-between text-xs text-slate-500 font-medium">
          <span>Tenant Isolation &bull; End-to-End Encryption</span>
          <span className="text-[11px] text-slate-500">SOC 2 Type II Certified</span>
        </div>
      </div>

      {/* Right: Registration Form Panel */}
      <div
        className="flex-1 flex items-center justify-center p-5 sm:p-10 lg:p-14 transition-colors"
        style={{
          backgroundColor: 'var(--color-background)',
          color: 'var(--color-text-primary)'
        }}
      >
        <div className="w-full max-w-md space-y-5 sm:space-y-6">
          {/* Navigation Switcher: Clearly visible Login and Create Account buttons */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-[#0D1828] border border-slate-200 dark:border-[#1D3047]">
            <button
              type="button"
              id="nav-login-tab"
              onClick={() => navigate('/login')}
              className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              Login
            </button>
            <button
              type="button"
              id="nav-create-account-tab"
              onClick={() => navigate('/register')}
              className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-xs transition-all cursor-default"
            >
              Create Account
            </button>
          </div>

          {/* Header */}
          <div>
            <h2
              className="text-2xl sm:text-3xl font-bold tracking-tight"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Create Workspace
            </h2>
            <p
              className="mt-1 text-xs sm:text-sm"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Register your organization and initialize your administrator account
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div
              id="register-error-msg"
              className="p-3 rounded-lg flex items-start gap-2.5 text-xs bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 animate-fadeIn"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Organization Name Field */}
            <div>
              <label
                htmlFor="register-org-name"
                className="block text-xs font-semibold mb-1.5"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Organization / Company Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Building className="w-4 h-4" />
                </div>
                <input
                  id="register-org-name"
                  type="text"
                  required
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  placeholder="e.g., Acme Global Health, Nexus Data"
                  className="w-full pl-9 pr-3 py-2 rounded-lg text-xs sm:text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-primary)'
                  }}
                />
              </div>
            </div>

            {/* Administrator Full Name */}
            <div>
              <label
                htmlFor="register-admin-name"
                className="block text-xs font-semibold mb-1.5"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Administrator Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="register-admin-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Sarah Connor"
                  className="w-full pl-9 pr-3 py-2 rounded-lg text-xs sm:text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-primary)'
                  }}
                />
              </div>
            </div>

            {/* Corporate Email Field */}
            <div>
              <label
                htmlFor="register-email"
                className="block text-xs font-semibold mb-1.5"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Work Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="register-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g., sarah@acme.com"
                  className="w-full pl-9 pr-3 py-2 rounded-lg text-xs sm:text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-primary)'
                  }}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="register-password"
                className="block text-xs font-semibold mb-1.5"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Master Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full pl-9 pr-10 py-2 rounded-lg text-xs sm:text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-primary)'
                  }}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Administrator Authority Note */}
            <div className="p-3 rounded-lg bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50 flex items-start gap-2.5 text-xs text-blue-800 dark:text-blue-300">
              <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="leading-snug text-[11px]">
                <strong className="block font-semibold mb-0.5">Workspace Administrator Privilege:</strong>
                As the organization founder, you will be initialized as the Workspace Administrator with authority over data sources, catalog assets, and employee management.
              </div>
            </div>

            <Button
              type="submit"
              id="register-submit-btn"
              loading={loading}
              className="w-full h-11 sm:h-10 text-xs sm:text-sm font-semibold justify-center shadow-xs"
            >
              Create Workspace & Account
            </Button>
          </form>

          {/* Footer Back to Login */}
          <div className="text-center pt-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Already have an enterprise account?{' '}
              <Link
                to="/login"
                id="login-link"
                className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
