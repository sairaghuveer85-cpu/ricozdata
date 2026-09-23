import React from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function PopularDatasets() {
  const { datasets, openDrawer } = useApp();

  const popular = datasets.slice(0, 5);

  return (
    <div className="flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 
              className="text-sm font-semibold"
              style={{ color: 'var(--color-text-primary)' }}
            >
              High-Demand Datasets
            </h3>
            <span 
              className="text-[11px]"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Most queried production assets
            </span>
          </div>
          <NavLink
            to="/catalog"
            className="text-xs hover:underline flex items-center gap-0.5 focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded font-medium"
            style={{ color: 'var(--color-brand)' }}
          >
            <span>Explore catalog</span>
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          </NavLink>
        </div>

        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr 
              className="border-b text-[10px] font-bold uppercase tracking-wider"
              style={{ 
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-muted)'
              }}
            >
              <th className="pb-2 font-medium">Dataset</th>
              <th className="pb-2 font-medium text-center">Quality</th>
              <th className="pb-2 font-medium text-right">Views</th>
            </tr>
          </thead>
          <tbody 
            className="divide-y"
            style={{ borderColor: 'var(--color-border)' }}
          >
            {popular.map((dataset) => (
              <tr
                key={dataset.id}
                tabIndex={0}
                role="button"
                aria-label={`Open details for ${dataset.name}`}
                onClick={() => openDrawer('dataset', dataset)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openDrawer('dataset', dataset);
                  }
                }}
                className="transition-colors cursor-pointer group focus:outline-none"
                style={{ borderBottomColor: 'var(--color-border)' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-secondary)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <td className="py-2.5 pr-2">
                  <span 
                    className="font-semibold transition-colors block truncate"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {dataset.name}
                  </span>
                  <span 
                    className="text-[11px] block truncate"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    {dataset.domain} • {dataset.owner}
                  </span>
                </td>
                <td 
                  className="py-2.5 px-2 text-center font-bold tabular-nums"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {dataset.quality}%
                </td>
                <td 
                  className="py-2.5 pl-2 text-right tabular-nums"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {dataset.usage?.replace(' views', '') || '1.2k'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
