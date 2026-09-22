import React from 'react';

export default function PolicyTabs({ activeTab, onTabChange }) {
  const tabs = [
    { id: 'policies', label: 'Policies' },
    { id: 'rules', label: 'Rules' },
    { id: 'access', label: 'Access Control' },
    { id: 'compliance', label: 'Compliance' }
  ];

  return (
    <div className="border-b border-slate-200 mb-6">
      <nav className="flex space-x-6">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`
                py-3 px-1 border-b-2 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer
                ${isActive
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
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
