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
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);
  const menuItemsRef = useRef([]);

  // Filter out dividers for keyboard navigation indexing
  const actionItems = items.filter(item => !item.divider && !item.disabled);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && menuItemsRef.current[focusedIndex]) {
      menuItemsRef.current[focusedIndex].focus();
    }
  }, [isOpen, focusedIndex]);

  const handleTriggerKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(true);
      setFocusedIndex(0);
    } else if (e.key === 'Escape' && isOpen) {
      e.preventDefault();
      setIsOpen(false);
      setFocusedIndex(-1);
    }
  };

  const handleMenuKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setFocusedIndex(-1);
      if (triggerRef.current) {
        triggerRef.current.focus();
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((prev) => (prev + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((prev) => (prev - 1 + items.length) % items.length);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setFocusedIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setFocusedIndex(items.length - 1);
    } else if (e.key === 'Tab') {
      setIsOpen(false);
      setFocusedIndex(-1);
    }
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <div
        ref={triggerRef}
        role="button"
        tabIndex={0}
        aria-haspopup="true"
        aria-expanded={isOpen}
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) setFocusedIndex(0);
        }}
        onKeyDown={handleTriggerKeyDown}
        className="cursor-pointer select-none inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-md"
      >
        {trigger}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            role="menu"
            aria-orientation="vertical"
            onKeyDown={handleMenuKeyDown}
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.12 }}
            className={`
              absolute z-50 mt-1.5 ${width} max-w-[calc(100vw-1.5rem)] rounded-md shadow-lg py-1 focus:outline-none
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
                    role="separator"
                    className="my-1"
                    style={{ borderTop: '1px solid var(--border)' }}
                  />
                );
              }
              const Icon = item.icon;
              return (
                <button
                  key={index}
                  ref={(el) => (menuItemsRef.current[index] = el)}
                  role="menuitem"
                  type="button"
                  tabIndex={focusedIndex === index ? 0 : -1}
                  onClick={() => {
                    item.onClick && item.onClick();
                    setIsOpen(false);
                    setFocusedIndex(-1);
                    if (triggerRef.current) triggerRef.current.focus();
                  }}
                  disabled={item.disabled}
                  className={`
                    w-full text-left px-3 py-2 text-xs flex items-center gap-2.5 transition-colors cursor-pointer focus:outline-none focus:bg-slate-100 dark:focus:bg-[#111E30]
                    ${item.danger 
                      ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40' 
                      : item.active
                      ? 'text-blue-600 dark:text-blue-400 font-semibold'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#111E30]'
                    }
                    ${item.disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}
                  `}
                >
                  {Icon && <Icon className={`w-3.5 h-3.5 shrink-0 ${item.danger ? 'text-rose-500' : 'text-slate-400 dark:text-slate-500'}`} aria-hidden="true" />}
                  <span className="font-medium truncate">{item.label}</span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
