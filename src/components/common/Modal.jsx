import React, { useEffect } from 'react';
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
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 backdrop-blur-xs"
            style={{ backgroundColor: 'var(--overlay)' }}
            onClick={onClose}
          />

          {/* Modal Dialog */}
          <div className="flex min-h-full items-center justify-center p-3 sm:p-4 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className={`relative transform overflow-hidden rounded-xl text-left shadow-2xl transition-all sm:my-8 w-[calc(100%-0.5rem)] sm:w-full ${maxWidth} max-h-[calc(100dvh-2rem)] flex flex-col z-10`}
              style={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 shrink-0"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <div className="min-w-0 pr-2">
                  <h3 className="text-sm sm:text-base font-bold truncate" style={{ color: 'var(--text-primary)' }}>{title}</h3>
                  {subtitle && (
                    <p className="mt-0.5 text-xs truncate" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close modal"
                  className="rounded-lg p-1.5 transition-colors cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5">
                {children}
              </div>

              {/* Optional Footer */}
              {footer && (
                <div
                  className="px-4 sm:px-6 py-3 sm:py-3.5 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-2.5 shrink-0"
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
