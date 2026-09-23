import React, { useEffect } from 'react';
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
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 backdrop-blur-xs transition-opacity"
            style={{ backgroundColor: 'var(--overlay)' }}
            onClick={onClose}
          />

          {/* Drawer Slide-in Panel */}
          <div className="fixed inset-y-0 right-0 flex max-w-full pl-0 sm:pl-10 pointer-events-auto">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className={`w-full sm:w-screen ${width} max-w-full shadow-2xl flex flex-col h-full`}
              style={{
                backgroundColor: 'var(--surface)',
                borderLeft: '1px solid var(--border)',
                color: 'var(--text-primary)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                className="px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between shrink-0"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <div className="min-w-0 pr-2">
                  <h3 className="text-sm sm:text-base font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                    {title}
                  </h3>
                  {subtitle && (
                    <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                      {subtitle}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close drawer"
                  className="rounded-lg p-1.5 transition-colors cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
                {children}
              </div>

              {/* Footer */}
              {footer && (
                <div
                  className="p-3 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 shrink-0"
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
