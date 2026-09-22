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
          <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className={`w-screen ${width} shadow-2xl flex flex-col`}
              style={{
                backgroundColor: 'var(--surface)',
                borderLeft: '1px solid var(--border)',
                color: 'var(--text-primary)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                className="px-6 py-4 flex items-center justify-between"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <div>
                  <h3 className="text-sm sm:text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                    {title}
                  </h3>
                  {subtitle && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {subtitle}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-1.5 transition-colors cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {children}
              </div>

              {/* Footer */}
              {footer && (
                <div
                  className="p-4 flex items-center justify-end gap-2.5"
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
