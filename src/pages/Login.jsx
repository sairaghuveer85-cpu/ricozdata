import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const { login } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSignIn = (e) => {
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

    setTimeout(() => {
      // Store authentication and update context
      login(email, password);
      setLoading(false);
      setIsSuccess(true);
      setTimeout(() => {
        navigate('/dashboard');
      }, 250);
    }, 400);
  };

  const handleSocialLogin = (provider) => {
    setError('');
    setLoading(true);
    setTimeout(() => {
      login(`${provider.toLowerCase()}@ricozdata.com`, 'oauth_pass');
      setLoading(false);
      navigate('/dashboard');
    }, 300);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row w-full bg-white dark:bg-[#07111F] transition-colors">
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
      <div className="flex-1 flex items-center justify-center p-5 sm:p-10 lg:p-16 bg-white dark:bg-[#07111F] transition-colors">
        <div className="w-full max-w-md space-y-5 sm:space-y-6">
          {/* Header */}
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              Welcome back
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Sign in to your account
            </p>
          </div>

          {/* Quick Demo Helper for convenience */}
          <div className="flex items-center justify-between p-2.5 rounded-md bg-slate-50 dark:bg-[#0D1828] border border-slate-200 dark:border-[#1D3047] text-xs">
            <div className="text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-slate-800 dark:text-slate-200">Demo Login:</span> test@example.com
            </div>
            <button
              type="button"
              id="autofill-demo-btn"
              onClick={() => {
                setEmail('test@example.com');
                setPassword('password');
                setError('');
              }}
              className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded"
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

          {/* Social Divider */}
          <div className="relative flex items-center justify-center pt-2">
            <div className="border-t border-slate-200 dark:border-[#1D3047] w-full" />
            <span className="bg-white dark:bg-[#07111F] px-3 text-[11px] text-slate-400 font-medium uppercase tracking-wider absolute">
              or continue with
            </span>
          </div>

          {/* Social Sign-in Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              id="google-signin-btn"
              onClick={() => handleSocialLogin('Google')}
              className="flex items-center justify-center gap-2.5 px-3 py-2 rounded-md border border-slate-200 dark:border-[#1D3047] bg-white dark:bg-[#0D1828] hover:bg-slate-50 dark:hover:bg-[#111E30] text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer shadow-2xs focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Google</span>
            </button>

            <button
              type="button"
              id="microsoft-signin-btn"
              onClick={() => handleSocialLogin('Microsoft')}
              className="flex items-center justify-center gap-2.5 px-3 py-2 rounded-md border border-slate-200 dark:border-[#1D3047] bg-white dark:bg-[#0D1828] hover:bg-slate-50 dark:hover:bg-[#111E30] text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer shadow-2xs focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                <rect x="1" y="1" width="10" height="10" fill="#F25022" />
                <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
                <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
                <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
              </svg>
              <span>Microsoft</span>
            </button>
          </div>

          {/* Footer Contact Admin */}
          <div className="text-center pt-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Don&apos;t have an enterprise account?{' '}
              <a
                href="#contact"
                onClick={(e) => {
                  e.preventDefault();
                  alert('Please contact your RicozData enterprise system administrator at admin@ricozdata.com');
                }}
                className="font-semibold text-blue-600 dark:text-blue-400 hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded"
              >
                Contact your administrator
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
