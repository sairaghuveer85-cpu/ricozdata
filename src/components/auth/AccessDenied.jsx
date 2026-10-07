import React from 'react';
import { ShieldAlert, Lock } from 'lucide-react';

/**
 * AccessDenied - Styled fallback component shown when a user
 * lacks permission to access a route or perform an action.
 *
 * @param {object} props
 * @param {string} props.permission - The required permission string
 * @param {string} props.role - The user's current role
 * @param {string} props.message - Custom message
 */
export default function AccessDenied({ permission, role, message }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 py-16">
      <div className="enterprise-panel rounded-2xl p-8 sm:p-12 max-w-xl text-center">
        {/* Icon */}
        <div className="w-20 h-20 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center mx-auto mb-6">
          <ShieldAlert className="w-10 h-10 text-red-600 dark:text-red-400" aria-hidden="true" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
          Access Denied
        </h1>

        {/* Icon */}
        <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        </div>

        {/* Message */}
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-2 leading-relaxed">
          {message || `You do not have permission to perform this action.`}
        </p>

        {/* Role info */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-mono text-slate-700 dark:text-slate-300 mt-4">
          <span>Required permission:</span>
          <code className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-red-600 dark:text-red-400 font-bold">
            {permission}
          </code>
        </div>

        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-mono text-slate-700 dark:text-slate-300 mt-2">
          <span>Your role:</span>
          <code className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white font-bold">
            {role}
          </code>
        </div>

        {/* Help text */}
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-6">
          If you believe you should have access, contact a platform administrator.
        </p>
      </div>
    </div>
  );
}

/**
 * Inline access denied component for compact UI contexts
 */
export function InlineAccessDenied({ permission }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs text-slate-500 dark:text-slate-400">
      <Lock className="w-3.5 h-3.5" aria-hidden="true" />
      <span>Requires permission: </span>
      <code className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono">
        {permission}
      </code>
    </div>
  );
}

InlineAccessDenied.displayName = 'InlineAccessDenied';