import React from 'react';

export default function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumbs,
  className = ''
}) {
  return (
    <div className={`ui-page-header mb-6 ${className}`}>
      {breadcrumbs && (
        <nav aria-label="Breadcrumb" className="ui-page-header__breadcrumbs flex items-center gap-1.5 text-xs mb-2">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span aria-hidden="true">/</span>}
              {crumb.link ? (
                <a href={crumb.link} className="ui-page-header__breadcrumb-link">
                  {crumb.label}
                </a>
              ) : (
                <span aria-current={idx === breadcrumbs.length - 1 ? 'page' : undefined}>
                  {crumb.label}
                </span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="ui-page-header__title">{title}</h1>
          {subtitle && (
            <p className="ui-page-header__subtitle">{subtitle}</p>
          )}
        </div>

        {actions && (
          <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
