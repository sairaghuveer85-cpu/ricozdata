import React from 'react';

export default function DatasetTabs({
  activeTab,
  onTabChange
}) {
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'schema', label: 'Schema' },
    { id: 'preview', label: 'Preview' },
    { id: 'quality', label: 'Data Quality' },
    { id: 'lineage', label: 'Lineage' },
    { id: 'query', label: 'Query Studio' },
    { id: 'policies', label: 'Policies' },
    { id: 'activity', label: 'Activity' },
  ];

  return (
    <div className="ui-dataset-tabs mb-6" style={{ borderBottom: '1px solid var(--color-border)' }}>
      <nav className="flex space-x-4 sm:space-x-6 overflow-x-auto" aria-label="Dataset details sections" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              data-tour={`dataset-tab-${tab.id}`}
              onClick={() => onTabChange(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className="min-h-11 shrink-0 whitespace-nowrap border-b-2 px-1 py-3 text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              style={{
                borderColor: isActive ? 'var(--color-brand)' : 'transparent',
                color: isActive ? 'var(--color-brand)' : 'var(--color-text-muted)'
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
