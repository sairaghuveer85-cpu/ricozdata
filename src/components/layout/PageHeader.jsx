import React from 'react';

export default function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumbs,
  className = ''
}) {
  return (
    <div className={`mb-6 ${className}`}>
      {breadcrumbs && (
        <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span className="text-slate-300">/</span>}
              {crumb.link ? (
                <a href={crumb.link} className="hover:text-blue-600 transition-colors">
                  {crumb.label}
                </a>
              ) : (
                <span className={idx === breadcrumbs.length - 1 ? 'text-slate-800 font-medium' : ''}>
                  {crumb.label}
                </span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-xs sm:text-sm text-slate-500">{subtitle}</p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2.5 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
