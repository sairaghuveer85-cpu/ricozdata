import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Dropdown({
  trigger,
  items = [],
  align = 'right',
  className = '',
  width = 'w-48'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
        {trigger}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.12 }}
            className={`
              absolute z-50 mt-1.5 ${width} rounded-xl shadow-xl py-1.5 focus:outline-none
              ${align === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left'}
            `}
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)'
            }}
          >
            {items.map((item, index) => {
              if (item.divider) {
                return (
                  <div
                    key={index}
                    className="my-1"
                    style={{ borderTop: '1px solid var(--border)' }}
                  />
                );
              }
              const Icon = item.icon;
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => {
                    item.onClick && item.onClick();
                    setIsOpen(false);
                  }}
                  disabled={item.disabled}
                  className={`
                    w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 transition-colors cursor-pointer
                    ${item.danger 
                      ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40' 
                      : item.active
                      ? 'text-blue-600 dark:text-blue-400 font-semibold'
                      : ''
                    }
                    ${item.disabled ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                  style={{
                    backgroundColor: item.active ? 'var(--surface-active)' : undefined,
                    color: item.danger ? undefined : (item.active ? 'var(--brand)' : 'var(--text-primary)')
                  }}
                  onMouseEnter={(e) => {
                    if (!item.danger && !item.active && !item.disabled) {
                      e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!item.danger && !item.active && !item.disabled) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  {Icon && <Icon className={`w-3.5 h-3.5 ${item.danger ? 'text-rose-500' : 'text-slate-400 dark:text-slate-500'}`} />}
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
