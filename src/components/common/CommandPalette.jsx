import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Search,
  LayoutDashboard,
  Database,
  ShieldCheck,
  GitFork,
  BookOpen,
  Shield,
  Users,
  Settings,
  Plus,
  Moon,
  Sun,
  Laptop,
  ArrowRight
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function CommandPalette() {
  const navigate = useNavigate();
  const {
    isCommandOpen,
    setIsCommandOpen,
    datasets,
    users,
    policies,
    glossaryTerms,
    theme,
    setTheme,
    toggleTheme
  } = useApp();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (isCommandOpen) {
      const timer = setTimeout(() => {
        setQuery('');
        setSelectedIndex(0);
        inputRef.current?.focus();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isCommandOpen]);

  // Actions list
  const defaultActions = [
    {
      id: 'act-new-dataset',
      title: 'Create Dataset',
      category: 'Actions',
      icon: Plus,
      perform: () => {
        setIsCommandOpen(false);
        navigate('/catalog');
      }
    },
    {
      id: 'act-new-policy',
      title: 'Create Policy',
      category: 'Actions',
      icon: Shield,
      perform: () => {
        setIsCommandOpen(false);
        navigate('/governance');
      }
    },
    {
      id: 'act-new-term',
      title: 'Add Glossary Term',
      category: 'Actions',
      icon: BookOpen,
      perform: () => {
        setIsCommandOpen(false);
        navigate('/glossary');
      }
    },
    {
      id: 'act-new-user',
      title: 'Add User Account',
      category: 'Actions',
      icon: Users,
      perform: () => {
        setIsCommandOpen(false);
        navigate('/users');
      }
    },
    {
      id: 'act-theme-toggle',
      title: theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode',
      category: 'Actions',
      icon: theme === 'dark' ? Sun : Moon,
      perform: () => {
        toggleTheme();
        setIsCommandOpen(false);
      }
    },
    {
      id: 'act-theme-light',
      title: 'Set Interface Theme: Light Mode',
      category: 'Actions',
      icon: Sun,
      perform: () => {
        setTheme('light');
        setIsCommandOpen(false);
      }
    },
    {
      id: 'act-theme-system',
      title: 'Set Interface Theme: System Preference',
      category: 'Actions',
      icon: Laptop,
      perform: () => {
        setTheme('system');
        setIsCommandOpen(false);
      }
    },
    {
      id: 'act-theme-dark',
      title: 'Set Interface Theme: Dark Mode',
      category: 'Actions',
      icon: Moon,
      perform: () => {
        setTheme('dark');
        setIsCommandOpen(false);
      }
    }
  ];

  const navPages = [
    { id: 'p-dashboard', title: 'Dashboard', path: '/dashboard', category: 'Navigation', icon: LayoutDashboard },
    { id: 'p-catalog', title: 'Data Catalog', path: '/catalog', category: 'Navigation', icon: Database },
    { id: 'p-quality', title: 'Data Quality', path: '/quality/customer-database', category: 'Navigation', icon: ShieldCheck },
    { id: 'p-lineage', title: 'Data Lineage', path: '/lineage/customer-database', category: 'Navigation', icon: GitFork },
    { id: 'p-glossary', title: 'Business Glossary', path: '/glossary', category: 'Navigation', icon: BookOpen },
    { id: 'p-governance', title: 'Governance & Policies', path: '/governance', category: 'Navigation', icon: Shield },
    { id: 'p-users', title: 'User Management', path: '/users', category: 'Navigation', icon: Users },
    { id: 'p-settings', title: 'Settings', path: '/settings', category: 'Navigation', icon: Settings }
  ];

  const filteredItems = useMemo(() => {
    if (!query.trim()) {
      return [
        ...defaultActions,
        ...navPages.slice(0, 4)
      ];
    }
    const q = query.toLowerCase();

    const matches = [];

    // Search datasets
    datasets.forEach(d => {
      if (d.name.toLowerCase().includes(q) || d.description.toLowerCase().includes(q)) {
        matches.push({
          id: `dataset-${d.id}`,
          title: d.name,
          category: 'Datasets',
          icon: Database,
          metadata: `${d.domain} • ${d.quality}% Quality`,
          perform: () => {
            setIsCommandOpen(false);
            navigate(`/catalog/${d.id}`);
          }
        });
      }
    });

    // Search navigation
    navPages.forEach(p => {
      if (p.title.toLowerCase().includes(q)) {
        matches.push({
          id: p.id,
          title: p.title,
          category: 'Navigation',
          icon: p.icon,
          perform: () => {
            setIsCommandOpen(false);
            navigate(p.path);
          }
        });
      }
    });

    // Search policies
    policies.forEach(pol => {
      if (pol.name.toLowerCase().includes(q) || pol.description.toLowerCase().includes(q)) {
        matches.push({
          id: `pol-${pol.id}`,
          title: pol.name,
          category: 'Policies',
          icon: Shield,
          metadata: `Applies to: ${pol.appliesTo}`,
          perform: () => {
            setIsCommandOpen(false);
            navigate('/governance');
          }
        });
      }
    });

    // Search glossary
    glossaryTerms.forEach(term => {
      if (term.term.toLowerCase().includes(q) || term.definition.toLowerCase().includes(q)) {
        matches.push({
          id: `term-${term.id}`,
          title: term.term,
          category: 'Glossary',
          icon: BookOpen,
          metadata: term.domain,
          perform: () => {
            setIsCommandOpen(false);
            navigate('/glossary');
          }
        });
      }
    });

    // Search users
    users?.forEach(u => {
      if (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.role && u.role.toLowerCase().includes(q))) {
        matches.push({
          id: `user-${u.id}`,
          title: u.name,
          category: 'Users',
          icon: Users,
          metadata: `${u.role} • ${u.email}`,
          perform: () => {
            setIsCommandOpen(false);
            navigate('/users');
          }
        });
      }
    });

    // Search actions
    defaultActions.forEach(a => {
      if (a.title.toLowerCase().includes(q)) {
        matches.push(a);
      }
    });

    return matches.slice(0, 10);
  }, [query, datasets, users, policies, glossaryTerms, theme]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].perform();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsCommandOpen(false);
    }
  };

  if (!isCommandOpen) return null;

  const activeItemId = filteredItems[selectedIndex] ? `cmd-item-${filteredItems[selectedIndex].id}` : undefined;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-3 sm:p-6 md:p-20 flex items-start justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 backdrop-blur-xs transition-opacity"
        style={{ backgroundColor: 'var(--overlay)' }}
        onClick={() => setIsCommandOpen(false)}
        aria-hidden="true"
      />

      {/* Palette Container */}
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
        initial={{ opacity: 0, scale: 0.96, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: -10 }}
        transition={{ duration: 0.15 }}
        className="relative w-full max-w-xl rounded-enterprise-modal shadow-2xl overflow-hidden z-10"
        style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          color: 'var(--text-primary)'
        }}
      >
        {/* Search Input Bar */}
        <div
          className="flex items-center px-4 py-3.5"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <Search className="w-4 h-4 mr-3 shrink-0" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-autocomplete="list"
            aria-controls="command-palette-results"
            aria-activedescendant={activeItemId}
            aria-label="Type a command or search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search datasets, users, policies, commands..."
            className="w-full bg-transparent text-sm focus:outline-none"
            style={{ color: 'var(--text-primary)' }}
          />
          <kbd
            className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-mono font-medium"
            style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
          >
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div
          id="command-palette-results"
          ref={listRef}
          role="listbox"
          aria-label="Commands and search results"
          className="max-h-80 overflow-y-auto p-2"
        >
          {filteredItems.length === 0 ? (
            <div role="status" className="p-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
              No results found for &ldquo;<span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{query}</span>&rdquo;
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = selectedIndex === idx;
              return (
                <div
                  key={item.id}
                  id={`cmd-item-${item.id}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => item.perform()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className="flex items-center justify-between px-3 py-2.5 rounded-md text-xs cursor-pointer transition-colors"
                  style={{
                    backgroundColor: isSelected ? 'var(--surface-active)' : 'transparent',
                    color: isSelected ? 'var(--brand)' : 'var(--text-primary)'
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="p-1.5 rounded-md shrink-0"
                      style={{
                        backgroundColor: isSelected ? 'var(--brand)' : 'var(--bg-tertiary)',
                        color: isSelected ? '#FFFFFF' : 'var(--text-secondary)'
                      }}
                      aria-hidden="true"
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <span className="truncate block font-medium" style={{ color: isSelected ? 'var(--brand)' : 'var(--text-primary)' }}>
                        {item.title}
                      </span>
                      {item.metadata && (
                        <span className="text-[11px] block truncate" style={{ color: 'var(--text-muted)' }}>
                          {item.metadata}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: 'var(--bg-tertiary)',
                        color: 'var(--text-secondary)'
                      }}
                    >
                      {item.category}
                    </span>
                    {isSelected && <ArrowRight className="w-3.5 h-3.5" style={{ color: 'var(--brand)' }} aria-hidden="true" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div
          className="px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between text-[11px]"
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            borderTop: '1px solid var(--border)',
            color: 'var(--text-muted)'
          }}
        >
          <div className="hidden sm:flex items-center gap-3">
            <span>Use <kbd className="font-mono font-semibold">↑</kbd> <kbd className="font-mono font-semibold">↓</kbd> to navigate</span>
            <span><kbd className="font-mono font-semibold">↵</kbd> to select</span>
          </div>
          <span className="text-[10px] sm:text-[11px]">RicozData Command Hub</span>
        </div>
      </motion.div>
    </div>
  );
}
