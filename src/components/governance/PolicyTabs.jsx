import React from 'react';

export default function PolicyTabs({ activeTab, onTabChange }) {
  const tabs = [
    { id: 'policies', label: 'Policies' },
    { id: 'rules', label: 'Rules' },
    { id: 'access', label: 'Access Control' },
    { id: 'compliance', label: 'Compliance' }
  ];

  return (
    <div className="mb-5 border-b border-slate-200 dark:border-slate-800 sm:mb-6">
      <nav aria-label="Governance sections" className="flex space-x-4 overflow-x-auto sm:space-x-6" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`
                min-h-11 shrink-0 whitespace-nowrap border-b-2 px-1 py-3 text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                ${isActive
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
                }
              `}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
