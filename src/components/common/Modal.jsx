import React, { useEffect, useId, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-lg',
  footer
}) {
  const titleId = useId();
  const subtitleId = useId();
  const modalRef = useRef(null);
  const previousActiveElementRef = useRef(null);
  const onCloseRef = useRef(onClose);

  // Synchronize latest onClose callback to ref without re-triggering modal lifecycle
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (isOpen) {
      previousActiveElementRef.current = document.activeElement;
      document.body.style.overflow = 'hidden';

      // Focus modal container on open, prioritizing first interactive element inside modal body
      const timer = setTimeout(() => {
        if (modalRef.current) {
          // If active element is already inside modal, do not steal focus
          if (modalRef.current.contains(document.activeElement)) {
            return;
          }
          const bodyContainer = modalRef.current.querySelector('[data-modal-body]') || modalRef.current;
          const focusable =
            bodyContainer.querySelector(
              'input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
            ) ||
            modalRef.current.querySelector(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
          if (focusable) {
            focusable.focus();
          } else {
            modalRef.current.focus();
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
        <div className="ui-modal fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="ui-modal-backdrop fixed inset-0 backdrop-blur-xs"
            style={{ backgroundColor: 'var(--overlay)' }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Modal Dialog */}
          <div className="flex min-h-full items-center justify-center p-3 sm:p-4 text-center">
            <motion.div
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={title ? titleId : undefined}
              aria-describedby={subtitle ? subtitleId : undefined}
              tabIndex={-1}
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              className={`ui-modal-panel relative z-10 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-0.5rem)] transform flex-col overflow-hidden rounded-enterprise-modal text-left shadow-2xl transition-all focus:outline-none sm:my-8 sm:w-full ${maxWidth}`}
              style={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
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
                    <p id={subtitleId} className="mt-0.5 text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                      {subtitle}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close modal"
                  className="min-h-9 min-w-9 shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              {/* Body */}
              <div data-modal-body className="ui-overlay-body min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
                {children}
              </div>

              {/* Optional Footer */}
              {footer && (
                <div
                  className="ui-overlay-footer flex shrink-0 flex-col-reverse items-stretch justify-end gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-2.5 sm:px-6 sm:py-3.5"
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
