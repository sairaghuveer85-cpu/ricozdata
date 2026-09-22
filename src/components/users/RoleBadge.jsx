import React from 'react';

export default function RoleBadge({ role }) {
  const roleStyles = {
    Admin: 'bg-purple-50 text-purple-700 border-purple-200',
    'Data Owner': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Data Engineer': 'bg-indigo-50 text-indigo-700 border-indigo-200',
    'Data Analyst': 'bg-blue-50 text-blue-700 border-blue-200',
    'Product Manager': 'bg-amber-50 text-amber-700 border-amber-200',
    Viewer: 'bg-slate-100 text-slate-700 border-slate-200'
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border ${roleStyles[role] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
      {role}
    </span>
  );
}
