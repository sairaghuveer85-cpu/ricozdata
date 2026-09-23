import React from 'react';
import Badge from '../common/Badge';
import { MoreHorizontal, Trash2, Eye, Edit3 } from 'lucide-react';
import Dropdown from '../common/Dropdown';

export default function UserRow({ user, onSelect, onDelete }) {
  return (
    <tr
      tabIndex={0}
      role="button"
      aria-label={`User ${user.name}, role ${user.role}`}
      onClick={() => onSelect && onSelect(user)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect && onSelect(user);
        }
      }}
      className="hover:bg-slate-50/70 dark:hover:bg-[#111E30]/40 transition-colors cursor-pointer group focus:outline-none focus-visible:bg-slate-50 dark:focus-visible:bg-[#111E30]"
    >
      {/* Name with Avatar circle */}
      <td className="py-2.5 px-4">
        <div className="flex items-center gap-2.5">
          <div className={`w-7 h-7 rounded-full ${user.avatarBg || 'bg-blue-600'} text-white font-semibold text-xs flex items-center justify-center shrink-0`} aria-hidden="true">
            {user.avatar || 'U'}
          </div>
          <div className="min-w-0">
            <span className="font-semibold text-slate-900 dark:text-white text-xs sm:text-sm block truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {user.name}
            </span>
            {user.department && (
              <span className="text-[11px] text-slate-400 dark:text-slate-500 block truncate">
                {user.department}
              </span>
            )}
          </div>
        </div>
      </td>

      {/* Email */}
      <td className="py-2.5 px-4 text-xs text-slate-600 dark:text-slate-400 font-mono">
        {user.email}
      </td>

      {/* Role */}
      <td className="py-2.5 px-4">
        <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
          {user.role}
        </span>
      </td>

      {/* Last Active */}
      <td className="py-2.5 px-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
        {user.lastActive || 'Today at 10:14 AM'}
      </td>

      {/* Status */}
      <td className="py-2.5 px-4">
        <Badge status={user.status} size="sm" dot />
      </td>

      {/* Actions: View, Edit, More (visible on focus-within as well as hover) */}
      <td className="py-2.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-within:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => onSelect && onSelect(user)}
            aria-label={`View details for ${user.name}`}
            className="p-1 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            title="View User Details"
          >
            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onSelect && onSelect(user)}
            aria-label={`Edit user ${user.name}`}
            className="p-1 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            title="Edit User"
          >
            <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <Dropdown
            align="right"
            width="w-36"
            trigger={
              <button
                type="button"
                aria-label={`More actions for ${user.name}`}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <MoreHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            }
            items={[
              {
                label: 'Delete User',
                icon: Trash2,
                danger: true,
                onClick: () => onDelete && onDelete(user.id)
              }
            ]}
          />
        </div>
      </td>
    </tr>
  );
}
