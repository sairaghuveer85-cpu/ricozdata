import React from 'react';
import Badge from '../common/Badge';
import { Check, X, Shield, ShieldCheck, Clock, FileCheck, Award } from 'lucide-react';
import { INITIAL_RULES, COMPLIANCE_FRAMEWORKS, PERMISSION_MATRIX } from '../../data/policies';

export default function RulesTable({ activeSubTab }) {
  if (activeSubTab === 'rules') {
    return (
      <div className="space-y-3">
        {/* Mobile Rules Cards (< md) */}
        <div className="md:hidden space-y-3">
          {INITIAL_RULES.map((rule) => (
            <div
              key={rule.id}
              className="bg-white dark:bg-[#0B1628] rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white leading-snug">
                    {rule.name}
                  </h4>
                  <div className="mt-1">
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {rule.targetColumn}
                    </span>
                  </div>
                </div>
                <Badge
                  status={rule.status === 'Passing' ? 'Active' : 'In Review'}
                  size="sm"
                  dot
                >
                  {rule.status}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100 dark:border-slate-800/60">
                <div>
                  <span className="text-[11px] text-slate-400 block">Constraint Type</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">{rule.type}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">Threshold</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{rule.threshold}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-[11px] text-slate-400 block">Frequency</span>
                  <span className="font-medium text-slate-600 dark:text-slate-400">{rule.frequency}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Rules Table (>= md) */}
        <div className="hidden md:block enterprise-workbench overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-[#0B1524] border-b border-slate-200/80 dark:border-[#1D3047] text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-5">Rule Name</th>
                  <th className="py-3 px-5">Target Column</th>
                  <th className="py-3 px-5">Constraint Type</th>
                  <th className="py-3 px-5">Threshold</th>
                  <th className="py-3 px-5">Frequency</th>
                  <th className="py-3 px-5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {INITIAL_RULES.map((rule) => (
                  <tr key={rule.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3.5 px-5 font-bold text-slate-900 dark:text-white">{rule.name}</td>
                    <td className="py-3.5 px-5 font-mono text-slate-600 dark:text-slate-300">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                        {rule.targetColumn}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-slate-600 dark:text-slate-400">{rule.type}</td>
                    <td className="py-3.5 px-5 font-semibold text-slate-700 dark:text-slate-200">{rule.threshold}</td>
                    <td className="py-3.5 px-5 text-slate-500 dark:text-slate-400">{rule.frequency}</td>
                    <td className="py-3.5 px-5">
                      <Badge
                        status={rule.status === 'Passing' ? 'Active' : 'In Review'}
                        size="sm"
                        dot
                      >
                        {rule.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Access Control: Permission Matrix matching Screen 8
  if (activeSubTab === 'access') {
    return (
      <div className="enterprise-panel rounded-xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Role-Based Access Control (RBAC) Permission Matrix</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Governs fine-grained operation privileges across organizational roles
            </p>
          </div>
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/60 self-start">
            5 Enterprise Roles Defined
          </span>
        </div>

        <div className="overflow-x-auto text-xs -mx-4 px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[560px] border-collapse">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-[#111C2E] border-b border-slate-200 dark:border-slate-800 text-left font-bold text-slate-600 dark:text-slate-300">
                <th className="py-3 px-3 sm:px-4">Role Name</th>
                <th className="py-3 px-2 sm:px-4 text-center">View</th>
                <th className="py-3 px-2 sm:px-4 text-center">Create</th>
                <th className="py-3 px-2 sm:px-4 text-center">Edit</th>
                <th className="py-3 px-2 sm:px-4 text-center">Delete</th>
                <th className="py-3 px-2 sm:px-4 text-center">Export</th>
                <th className="py-3 px-2 sm:px-4 text-center">Manage Policies</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {PERMISSION_MATRIX.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-3 sm:px-4 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                    {row.role}
                  </td>
                  {['view', 'create', 'edit', 'delete', 'export', 'managePolicies'].map((colKey) => {
                    const isGranted = row[colKey];
                    return (
                      <td key={colKey} className="py-3.5 px-2 sm:px-4 text-center">
                        {isGranted ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                            <Check className="w-3.5 h-3.5" />
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600">
                            <X className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Compliance: Visual Cards matching Screen 8
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
      {COMPLIANCE_FRAMEWORKS.map((fw, idx) => (
        <div
          key={idx}
          className="bg-white dark:bg-[#0B1628] rounded-xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/60 flex items-center justify-center">
                <Award className="w-5 h-5" />
              </div>
              <Badge status={fw.status === 'Certified' ? 'Certified' : 'Active'} size="sm" dot>
                {fw.status}
              </Badge>
            </div>

            <h4 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
              {fw.name}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              {fw.description}
            </p>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/60 space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-slate-500 dark:text-slate-400">Coverage</span>
                <span className="font-bold text-slate-900 dark:text-white">{fw.coverage}%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-700"
                  style={{ width: `${fw.coverage}%` }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Last review: {fw.lastReview}</span>
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Passing</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
