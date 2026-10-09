import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Database,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  UserCheck
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import Button from '../components/common/Button';
import { buildApiUrl } from '../services/apiConfig';

export default function AcceptInvitation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setCurrentUser, setIsAuthenticated, addToast } = useApp();

  const [token, setToken] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const rawToken = searchParams.get('token');
    if (rawToken) {
      setToken(rawToken.trim());
    } else {
      setError('Missing invitation token. Please check your invitation link.');
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!token) {
      setError('Invitation token is required.');
      return;
    }
    if (!name.trim()) {
      setError('Please provide your full name.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const apiUrl = buildApiUrl(`/users/invitations/${encodeURIComponent(token)}/accept`);
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          password
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || data.message || 'Failed to accept invitation');
      }

      setIsSuccess(true);
      const user = data.data?.user || {
        name: name.trim(),
        email: 'member@ricozdata.com',
        role: 'Data Analyst'
      };

      const authenticatedUser = {
        id: user._id || user.id || `user-${Date.now()}`,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: (user.name ? user.name.charAt(0) : 'U').toUpperCase(),
        avatarBg: 'bg-blue-600',
        isAuthenticated: true
      };

      try {
        localStorage.setItem('ricoz-authenticated', 'true');
        localStorage.setItem('ricoz_current_user', JSON.stringify(authenticatedUser));
      } catch (err) {
        console.warn('Failed to update localStorage', err);
      }

      setCurrentUser(authenticatedUser);
      setIsAuthenticated(true);

      if (addToast) {
        addToast({
          type: 'success',
          title: 'Account Activated',
          message: `Welcome to RicozData, ${user.name}!`
        });
      }

      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div
      className="min-h-screen flex items-center justify-center p-6 select-none transition-colors"
      style={{
        backgroundColor: 'var(--color-background, #08101e)',
        color: 'var(--color-text-primary, #ffffff)'
      }}
    >
      <div className="w-full max-w-md p-6 sm:p-8 rounded-xl bg-slate-900/80 border border-slate-800 shadow-2xl backdrop-blur-xs">
        {/* Brand Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md">
            <Database className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-xl font-bold text-white tracking-tight leading-none block">RicozData</span>
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Enterprise Workspace Invitation</span>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Activate Your Account
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            You&apos;ve been invited to join an enterprise data governance workspace.
          </p>
        </div>

        {error && (
          <div className="p-3 mb-4 rounded-md bg-rose-950/40 border border-rose-900 text-xs text-rose-300 font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {isSuccess && (
          <div className="p-3 mb-4 rounded-md bg-emerald-950/40 border border-emerald-900 text-xs text-emerald-300 font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Account activated successfully. Entering workspace...</span>
          </div>
        )}

        {token ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full h-10 rounded-md border border-slate-700 bg-slate-800/80 text-xs sm:text-sm text-white placeholder-slate-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Choose Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full h-10 rounded-md border border-slate-700 bg-slate-800/80 text-xs sm:text-sm text-white placeholder-slate-500 px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Confirm Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                className="w-full h-10 rounded-md border border-slate-700 bg-slate-800/80 text-xs sm:text-sm text-white placeholder-slate-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <Button
              type="submit"
              loading={loading}
              className="w-full h-10 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 mt-2"
            >
              <UserCheck className="w-4 h-4" />
              <span>Activate Account</span>
            </Button>


          </form>
        ) : (
          <div className="text-center py-4">
            <button
              onClick={() => navigate('/login')}
              className="text-xs font-semibold text-blue-400 hover:underline"
            >
              Return to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
