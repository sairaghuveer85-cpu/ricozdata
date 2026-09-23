import React from 'react';
import { Plus, Minus, Maximize2 } from 'lucide-react';
import { useReactFlow } from '@xyflow/react';

export default function LineageToolbar() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  return (
    <div
      role="toolbar"
      aria-label="Lineage canvas controls"
      className="absolute bottom-3 left-3 sm:bottom-5 sm:left-5 z-10 flex items-center bg-white/95 dark:bg-[#0D1828]/95 backdrop-blur-xs rounded-md shadow-md border border-slate-200 dark:border-[#1D3047] p-1 divide-x divide-slate-100 dark:divide-[#1D3047]"
    >
      <button
        type="button"
        onClick={() => zoomIn({ duration: 200 })}
        className="p-2 sm:p-1.5 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-[#111E30] rounded-sm transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        title="Zoom In"
        aria-label="Zoom in"
      >
        <Plus className="w-4 h-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => zoomOut({ duration: 200 })}
        className="p-2 sm:p-1.5 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-[#111E30] rounded-sm transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        title="Zoom Out"
        aria-label="Zoom out"
      >
        <Minus className="w-4 h-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => fitView({ duration: 300, padding: 0.2 })}
        className="p-2 sm:p-1.5 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-[#111E30] rounded-sm transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        title="Fit View"
        aria-label="Fit view to canvas"
      >
        <Maximize2 className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
}
