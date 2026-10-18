import React, { useEffect } from 'react';
import { Sparkles, X, ArrowRight } from 'lucide-react';
import Button from '../common/Button';

export default function WelcomePopover({ onStart, onDismiss }) {
  // Allow dismissing with Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss]);

  return (
    <aside
      role="region"
      aria-label="Welcome Guide"
      className="fixed bottom-5 right-5 z-[860] w-[calc(100vw-2.5rem)] max-w-sm rounded-2xl border p-4 sm:p-5 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200"
      style={{
        backgroundColor: 'var(--color-surface, #FFFFFF)',
        borderColor: 'var(--color-border, #E2E8F0)',
        color: 'var(--color-text-primary, #111827)',
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-blue-600 dark:text-blue-400"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-brand, #2563EB) 12%, transparent)',
            }}
          >
            <Sparkles className="w-4 h-4" aria-hidden="true" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 block leading-tight">
              Interactive Guide
            </span>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">
              Welcome to RicozData!
            </h2>
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss welcome guide"
          className="p-1 -mr-1 -mt-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
        Let&apos;s explore how to discover your organization&apos;s data and understand what it means.
      </p>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={onDismiss}
        >
          Maybe later
        </Button>

        <Button
          type="button"
          variant="primary"
          size="xs"
          onClick={onStart}
          icon={ArrowRight}
        >
          Start exploring
        </Button>
      </div>
    </aside>
  );
}
