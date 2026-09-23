import React from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function PopularDatasets() {
  const { datasets, openDrawer } = useApp();

  const popular = datasets.slice(0, 5);

  return (
    <div
      className="p-5 rounded-lg flex flex-col justify-between h-full"
      style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)'
      }}
    >
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Popular Datasets
          </h3>
          <NavLink
            to="/catalog"
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded"
          >
            <span>Explore catalog</span>
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          </NavLink>
        </div>

        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-100 dark:border-[#1D3047] text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              <th className="pb-2 font-medium">Dataset</th>
              <th className="pb-2 font-medium text-center">Quality</th>
              <th className="pb-2 font-medium text-right">Views</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#1D3047]">
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
                className="hover:bg-slate-50 dark:hover:bg-[#111E30] transition-colors cursor-pointer group focus:outline-none focus-visible:bg-slate-50 dark:focus-visible:bg-[#111E30]"
              >
                <td className="py-2.5 pr-2">
                  <span className="font-medium text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors block truncate">
                    {dataset.name}
                  </span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 block truncate">
                    {dataset.domain}
                  </span>
                </td>
                <td className="py-2.5 px-2 text-center font-semibold text-slate-800 dark:text-slate-200">
                  {dataset.quality}%
                </td>
                <td className="py-2.5 pl-2 text-right text-slate-500 dark:text-slate-400">
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
