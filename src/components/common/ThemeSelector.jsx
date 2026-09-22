import React from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

const THEME_OPTIONS = [
  { id: 'light', label: 'Light', symbol: '☀', icon: Sun },
  { id: 'system', label: 'System', symbol: '◐', icon: Monitor },
  { id: 'dark', label: 'Dark', symbol: '☾', icon: Moon }
];

export default function ThemeSelector({ className = '', compact = false }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Theme switcher"
      className={`inline-flex items-center p-1 rounded-xl shadow-2xs ${className}`}
      style={{
        backgroundColor: 'var(--bg-tertiary)',
        border: '1px solid var(--border)'
      }}
    >
      {THEME_OPTIONS.map((opt) => {
        const isSelected = theme === opt.id;
        const Icon = opt.icon;

        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => setTheme(opt.id)}
            title={`${opt.symbol} ${opt.label} Mode`}
            className={`
              relative flex items-center justify-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer select-none
              ${isSelected
                ? 'text-blue-600 dark:text-blue-400 font-bold'
                : 'hover:text-blue-500'
              }
              ${compact ? 'px-2 py-1' : 'px-3 py-1.5'}
            `}
            style={{
              color: isSelected ? 'var(--brand)' : 'var(--text-secondary)'
            }}
          >
            {isSelected && (
              <motion.div
                layoutId="theme-selector-pill"
                transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                className="absolute inset-0 rounded-lg shadow-xs"
                style={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)'
                }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              <span className="text-xs font-bold leading-none">{opt.symbol}</span>
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {!compact && <span>{opt.label}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
