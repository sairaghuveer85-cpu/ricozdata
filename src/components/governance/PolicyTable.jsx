import React, { useState } from 'react';
import Badge from '../common/Badge';
import { ChevronRight, ShieldCheck, User } from 'lucide-react';
import PolicyDrawer from './PolicyDrawer';

export default function PolicyTable({ policies = [], onToggleStatus }) {
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleRowClick = (policy) => {
    setSelectedPolicy(policy);
    setIsDrawerOpen(true);
  };

  return (
    <div className="theme-card rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <th className="py-2.5 px-4 w-1/4">Policy</th>
              <th className="py-2.5 px-4 w-1/3">Description</th>
              <th className="py-2.5 px-4">Applies To</th>
              <th className="py-2.5 px-4">Owner</th>
              <th className="py-2.5 px-4">Status</th>
              <th className="py-2.5 px-4">Updated</th>
              <th className="py-2.5 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {policies.map((policy) => (
              <tr
                key={policy.id}
                onClick={() => handleRowClick(policy)}
                className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
              >
                <td className="py-3 px-4">
                  <div className="font-semibold text-slate-900 dark:text-white text-xs sm:text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0" />
                    <span>{policy.name}</span>
                  </div>
                  {policy.compliance && (
                    <span className="block text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                      {policy.compliance}
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 text-slate-600 dark:text-slate-300 leading-relaxed">
                  {policy.description}
                </td>
                <td className="py-3 px-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium">
                    {policy.appliesTo}
                  </span>
                </td>
                <td className="py-3 px-4 whitespace-nowrap">
                  <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>{policy.owner || 'SecOps Team'}</span>
                  </div>
                </td>
                <td className="py-3 px-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => onToggleStatus && onToggleStatus(policy.id)}
                    className="cursor-pointer"
                    title="Click to toggle policy status"
                  >
                    <Badge status={policy.status} size="sm" dot />
                  </button>
                </td>
                <td className="py-3 px-4 text-slate-400 dark:text-slate-500 whitespace-nowrap">
                  {policy.updated || 'Recently'}
                </td>
                <td className="py-3 px-4 text-right whitespace-nowrap">
                  <span className="inline-flex items-center text-xs font-medium text-blue-600 dark:text-blue-400 group-hover:underline">
                    <span>Inspect</span>
                    <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail Drawer */}
      <PolicyDrawer
        policy={selectedPolicy}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </div>
  );
}
