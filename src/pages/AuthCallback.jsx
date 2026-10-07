import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Database, Loader2, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshAuthSession, addToast } = useApp();
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const status = searchParams.get('status');
    const message = searchParams.get('message') || searchParams.get('error');

    if (status === 'error' || message) {
      const decodedError = decodeURIComponent(message || 'Google authentication failed');
      setErrorMessage(decodedError);
      if (addToast) {
        addToast({
          type: 'error',
          title: 'Authentication Error',
          message: decodedError
        });
      }
      setTimeout(() => {
        navigate(`/login?error=${encodeURIComponent(decodedError)}`, { replace: true });
      }, 1500);
      return;
    }

    if (status === 'success') {
      // 09.7: Authenticate via server-controlled HTTP-only cookie + refresh endpoint
      // ZERO sensitive identity parameters read from URL or stored in localStorage
      let isMounted = true;
      (async () => {
        const result = await refreshAuthSession();
        if (!isMounted) return;

        if (result.success && result.user) {
          if (addToast) {
            addToast({
              type: 'success',
              title: 'Google Sign-In Successful',
              message: `Welcome back, ${result.user.name || 'User'}!`
            });
          }
          const returnUrl = searchParams.get('returnUrl');
          const target = returnUrl && returnUrl.startsWith('/') ? returnUrl : '/dashboard';
          setTimeout(() => {
            navigate(target, { replace: true });
          }, 300);
        } else {
          const failMsg = 'Session initialization failed. Please try signing in again.';
          setErrorMessage(failMsg);
          if (addToast) {
            addToast({
              type: 'error',
              title: 'Authentication Error',
              message: failMsg
            });
          }
          setTimeout(() => {
            navigate('/login', { replace: true });
          }, 1500);
        }
      })();

      return () => {
        isMounted = false;
      };
    } else {
      // Direct access fallback
      navigate('/login', { replace: true });
    }
  }, [searchParams, navigate, refreshAuthSession, addToast]);

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6 select-none transition-colors"
      style={{
        backgroundColor: 'var(--color-background, #08101e)',
        color: 'var(--color-text-primary, #ffffff)'
      }}
    >
      <div className="w-full max-w-sm flex flex-col items-center text-center p-8 rounded-xl bg-slate-900/60 border border-slate-800 shadow-xl backdrop-blur-xs">
        {/* Brand Logo */}
        <div className="w-12 h-12 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md mb-4">
          <Database className="w-6 h-6 text-white" />
        </div>

        <h2 className="text-xl font-bold tracking-tight text-white mb-2">
          RicozData Platform
        </h2>

        {errorMessage ? (
          <div className="flex flex-col items-center mt-3 text-rose-400 space-y-2">
            <AlertCircle className="w-6 h-6 text-rose-500 animate-bounce" />
            <p className="text-xs font-semibold">{errorMessage}</p>
            <span className="text-[11px] text-slate-400">Redirecting back to login...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center mt-3 text-slate-400 space-y-3">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <p className="text-xs font-medium text-slate-300">
              Completing Google Authentication...
            </p>
            <span className="text-[11px] text-slate-500">
              Verifying security credentials and initializing session
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
