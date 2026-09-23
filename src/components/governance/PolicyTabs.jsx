import React from 'react';

export default function PolicyTabs({ activeTab, onTabChange }) {
  const tabs = [
    { id: 'policies', label: 'Policies' },
    { id: 'rules', label: 'Rules' },
    { id: 'access', label: 'Access Control' },
    { id: 'compliance', label: 'Compliance' }
  ];

  return (
    <div className="border-b border-slate-200 dark:border-slate-800 mb-6">
      <nav className="flex space-x-4 sm:space-x-6 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`
                py-3 px-1 border-b-2 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer shrink-0
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
