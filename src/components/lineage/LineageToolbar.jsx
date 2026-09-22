import React from 'react';
import { Plus, Minus, Maximize2 } from 'lucide-react';
import { useReactFlow } from '@xyflow/react';

export default function LineageToolbar() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  return (
    <div className="absolute bottom-5 left-5 z-10 flex items-center bg-white/95 dark:bg-[#0B1628]/95 backdrop-blur-xs rounded-lg shadow-md border border-slate-200 dark:border-slate-800 p-1 divide-x divide-slate-100 dark:divide-slate-800">
      <button
        type="button"
        onClick={() => zoomIn({ duration: 200 })}
        className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
        title="Zoom In"
      >
        <Plus className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => zoomOut({ duration: 200 })}
        className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
        title="Zoom Out"
      >
        <Minus className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => fitView({ duration: 300, padding: 0.2 })}
        className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
        title="Fit View"
      >
        <Maximize2 className="w-4 h-4" />
      </button>
    </div>
  );
}
