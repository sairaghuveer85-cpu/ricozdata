import React from 'react';

export default function DatasetTabs({
  activeTab,
  onTabChange
}) {
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'schema', label: 'Schema' },
    { id: 'quality', label: 'Data Quality' },
    { id: 'lineage', label: 'Lineage' },
    { id: 'policies', label: 'Policies' },
    { id: 'activity', label: 'Activity' },
  ];

  return (
    <div className="mb-6" style={{ borderBottom: '1px solid var(--border)' }}>
      <nav className="flex space-x-4 sm:space-x-6 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className="py-3 px-1 border-b-2 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer shrink-0"
              style={{
                borderColor: isActive ? 'var(--brand)' : 'transparent',
                color: isActive ? 'var(--brand)' : 'var(--text-muted)'
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
