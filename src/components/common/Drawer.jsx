import React, { useEffect, useId, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export default function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 'max-w-md'
}) {
  const titleId = useId();
  const subtitleId = useId();
  const drawerRef = useRef(null);
  const previousActiveElementRef = useRef(null);
  const onCloseRef = useRef(onClose);

  // Synchronize latest onClose callback to ref without re-triggering drawer lifecycle
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (isOpen) {
      previousActiveElementRef.current = document.activeElement;
      document.body.style.overflow = 'hidden';

      const timer = setTimeout(() => {
        if (drawerRef.current) {
          if (drawerRef.current.contains(document.activeElement)) {
            return;
          }
          const bodyContainer = drawerRef.current.querySelector('[data-drawer-body]') || drawerRef.current;
          const focusable =
            bodyContainer.querySelector(
              'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            ) ||
            drawerRef.current.querySelector(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
          if (focusable) {
            focusable.focus();
          } else {
            drawerRef.current.focus();
          }
        }
      }, 50);

      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onCloseRef.current?.();
        }
      };

      window.addEventListener('keydown', handleKeyDown);

      return () => {
        clearTimeout(timer);
        document.body.style.overflow = 'unset';
        window.removeEventListener('keydown', handleKeyDown);
        if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
          previousActiveElementRef.current.focus();
        }
      };
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="ui-drawer fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="ui-drawer-backdrop fixed inset-0 backdrop-blur-xs transition-opacity"
            style={{ backgroundColor: 'var(--overlay)' }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Drawer Slide-in Panel */}
          <div className="fixed inset-y-0 right-0 flex max-w-full pl-0 sm:pl-10 pointer-events-auto">
            <motion.div
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={title ? titleId : undefined}
              aria-describedby={subtitle ? subtitleId : undefined}
              tabIndex={-1}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className={`ui-drawer-panel flex h-full w-full max-w-full flex-col shadow-2xl focus:outline-none sm:w-screen ${width}`}
              style={{
                backgroundColor: 'var(--surface)',
                borderLeft: '1px solid var(--border)',
                color: 'var(--text-primary)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                className="ui-overlay-header flex shrink-0 items-center justify-between px-4 py-3.5 sm:px-6 sm:py-4"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <div className="min-w-0 pr-2">
                  <h3 id={titleId} className="text-sm sm:text-base font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                    {title}
                  </h3>
                  {subtitle && (
                    <p id={subtitleId} className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                      {subtitle}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close drawer"
                  className="min-h-9 min-w-9 shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              {/* Body */}
              <div data-drawer-body className="ui-overlay-body min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:space-y-6 sm:p-6">
                {children}
              </div>

              {/* Footer */}
              {footer && (
                <div
                  className="ui-overlay-footer flex shrink-0 flex-col items-stretch justify-end gap-2 p-3 sm:flex-row sm:items-center sm:p-4"
                  style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    borderTop: '1px solid var(--border)'
                  }}
                >
                  {footer}
                </div>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
