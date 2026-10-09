import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Database,
  ShieldCheck,
  GitFork,
  Shield,
  Eye,
  EyeOff,
  CheckCircle2
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import Button from '../components/common/Button';

export default function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // If already authenticated with a valid token, directly enter dashboard
  useEffect(() => {
    const rawJwt = localStorage.getItem('ricoz_jwt');
    const isAuth = localStorage.getItem('ricoz-authenticated') === 'true';
    if (isAuthenticated && rawJwt && isAuth) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSignIn = async (e) => {
    e && e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }
    if (!password.trim()) {
      setError('Please enter your password');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await login(email, password);
      if (res && res.success) {
        setIsSuccess(true);
        navigate('/dashboard', { replace: true });
      } else {
        setError(res?.error || 'Invalid credentials. Please verify your email and password.');
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please try again.');
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
      <div className="relative w-full md:w-[52%] lg:w-[55%] bg-[#08101e] p-6 sm:p-10 lg:p-16 flex flex-col justify-between text-white overflow-hidden select-none min-h-0 md:min-h-screen border-b md:border-b-0 md:border-r border-slate-800">
        {/* Subtle Architectural SVG Data Grid Background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-25" aria-hidden="true">
          <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1" fill="#475569" opacity="0.4" />
            </pattern>
            <rect width="100%" height="100%" fill="url(#gridPattern)" />

            <path d="M-40 180 C 140 100, 260 360, 540 220 C 780 120, 940 300, 1120 240" fill="none" stroke="#2563eb" strokeWidth="1.2" opacity="0.6" />
            <path d="M-40 260 C 180 160, 300 420, 600 300 C 860 180, 1020 380, 1200 320" fill="none" stroke="#3b82f6" strokeWidth="1" strokeDasharray="5 5" opacity="0.4" />

            <circle cx="180" cy="190" r="3.5" fill="#3b82f6" />
            <circle cx="360" cy="310" r="4" fill="#60a5fa" />
            <circle cx="540" cy="220" r="4.5" fill="#3b82f6" />
            <circle cx="720" cy="360" r="3.5" fill="#38bdf8" />

            <line x1="180" y1="190" x2="360" y2="310" stroke="#3b82f6" strokeWidth="0.8" opacity="0.4" />
            <line x1="360" y1="310" x2="540" y2="220" stroke="#3b82f6" strokeWidth="0.8" opacity="0.4" />
            <line x1="540" y1="220" x2="720" y2="360" stroke="#3b82f6" strokeWidth="0.8" opacity="0.4" />
          </svg>
        </div>

        {/* Top: Brand Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-md bg-blue-600 flex items-center justify-center text-white shadow-2xs shrink-0" aria-hidden="true">
            <Database className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div>
            <span className="text-lg sm:text-xl font-bold text-white tracking-tight leading-none block">RicozData</span>
            <span className="text-[10px] font-medium text-slate-400 tracking-wider uppercase">Enterprise Data Platform</span>
          </div>
        </div>

        {/* Center: Main Headline & Core Capabilities */}
        <div className="relative z-10 my-auto py-4 sm:py-6 md:py-8">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-5xl font-bold text-white tracking-tight leading-[1.2]">
              Trust Your Data.<br />
              <span className="text-slate-300">Build a Better Tomorrow.</span>
            </h1>

            <p className="mt-2 sm:mt-4 text-xs sm:text-sm lg:text-base text-slate-400 max-w-md leading-relaxed">
              A unified data governance platform to discover, monitor, and control your organization&apos;s data assets with confidence.
            </p>

            {/* Mobile compact tagline */}
            <div className="sm:hidden mt-3 inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-900/80 border border-slate-800 text-[11px] text-blue-400 font-medium">
              <span>Catalog • Quality • Lineage • Governance</span>
            </div>

            {/* Feature Highlights on sm+ */}
            <div className="hidden sm:block mt-6 lg:mt-8 space-y-2.5 max-w-md">
              {[
                { label: 'Data Catalog', desc: 'Unified discovery with multi-warehouse metadata', icon: Database },
                { label: 'Data Quality', desc: 'Automated anomaly detection & SLA compliance', icon: ShieldCheck },
                { label: 'Data Lineage', desc: 'Interactive visual pipeline dependency tracing', icon: GitFork },
                { label: 'Governance', desc: 'Role-based access controls and policy enforcement', icon: Shield }
              ].map((feat, idx) => {
                const Icon = feat.icon;
                return (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-2.5 rounded-md bg-slate-900/60 border border-slate-800 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-md bg-blue-950/80 border border-blue-900/50 flex items-center justify-center text-blue-400 shrink-0" aria-hidden="true">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-white block leading-tight">{feat.label}</span>
                      <span className="text-[11px] text-slate-400 block leading-tight mt-0.5">{feat.desc}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom Tagline */}
        <div className="hidden sm:flex relative z-10 pt-4 border-t border-slate-800/80 items-center justify-between text-xs text-slate-500 font-medium">
          <span>Data • Governance • Trust • Growth</span>
          <span className="hidden sm:inline text-[11px] text-slate-500">SOC 2 Type II Certified</span>
        </div>
      </div>

      {/* Right: Authentication Form Panel */}
      <div 
        className="flex-1 flex items-center justify-center p-5 sm:p-10 lg:p-16 transition-colors"
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
              id="login-nav-btn"
              onClick={() => navigate('/login')}
              className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-xs transition-all cursor-default"
            >
              Login
            </button>
            <button
              type="button"
              id="create-account-nav-btn"
              onClick={() => navigate('/register')}
              className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-all cursor-pointer"
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
              Welcome back
            </h2>
            <p 
              className="mt-1 text-xs sm:text-sm"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Sign in to your account
            </p>
          </div>

          {/* Quick Demo Helper for convenience */}
          <div 
            className="flex items-center justify-between p-2.5 rounded-md text-xs"
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)'
            }}
          >
            <div style={{ color: 'var(--color-text-secondary)' }}>
              <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>Demo Login:</span> test@example.com
            </div>
            <button
              type="button"
              id="autofill-demo-btn"
              onClick={() => {
                setEmail('test@example.com');
                setPassword('password');
                setError('');
              }}
              className="text-[11px] font-semibold hover:underline cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded"
              style={{ color: 'var(--color-brand)' }}
            >
              Fill Demo
            </button>
          </div>

          {error && (
            <div
              id="login-error-message"
              role="alert"
              className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 font-medium animate-in fade-in duration-150"
            >
              {error}
            </div>
          )}

          {isSuccess && (
            <div
              role="status"
              className="p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <span>Authentication successful. Loading workspace...</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="test@example.com"
                className="w-full h-11 sm:h-10 rounded-md border border-slate-200 dark:border-[#1D3047] bg-white dark:bg-[#0D1828] text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                required
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full h-11 sm:h-10 rounded-md border border-slate-200 dark:border-[#1D3047] bg-white dark:bg-[#0D1828] text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  required
                />
                <button
                  type="button"
                  id="toggle-password-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-0.5">
              <label className="flex items-center gap-2 text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="remember-me"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-3.5 h-3.5 rounded-sm text-blue-600 border-slate-300 dark:border-slate-700 focus:ring-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500"
                />
                <span>Remember me</span>
              </label>
              <a
                href="#forgot"
                onClick={(e) => {
                  e.preventDefault();
                  alert('A secure password reset link has been dispatched to your corporate email.');
                }}
                className="font-medium text-blue-600 dark:text-blue-400 hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded"
              >
                Forgot password?
              </a>
            </div>

            <Button
              type="submit"
              id="sign-in-btn"
              loading={loading}
              className="w-full h-11 sm:h-10 shadow-2xs text-xs sm:text-sm font-semibold"
            >
              Sign In
            </Button>
          </form>

          {/* Footer Create Account */}
          <div className="pt-3 border-t border-slate-200/80 dark:border-[#1D3047]/80 text-center space-y-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              New organization or workspace?{' '}
              <Link
                to="/register"
                id="create-account-link"
                className="font-semibold text-blue-600 dark:text-blue-400 hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded"
              >
                Create Account
              </Link>
            </p>
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
              <Shield className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span>Multi-Tenant Enterprise Isolation &bull; End-to-End Encrypted</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
