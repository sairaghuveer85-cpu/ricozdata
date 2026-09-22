import { Filter } from 'lucide-react';

export default function CatalogFilters({
  selectedSources,
  setSelectedSources,
  selectedDomains,
  setSelectedDomains,
  selectedCertifications,
  setSelectedCertifications,
  onReset
}) {
  const sources = [
    { label: 'Snowflake', count: 120 },
    { label: 'BigQuery', count: 95 },
    { label: 'PostgreSQL', count: 76 },
    { label: 'MySQL', count: 54 },
    { label: 'Others', count: 23 }
  ];

  const domains = [
    { label: 'Sales', count: 280 },
    { label: 'Marketing', count: 190 },
    { label: 'Finance', count: 160 },
    { label: 'Product', count: 120 },
    { label: 'HR', count: 90 }
  ];

  const certifications = [
    { label: 'Certified', count: 210 },
    { label: 'In Review', count: 190 },
    { label: 'Not Certified', count: 120 }
  ];

  const toggleFilter = (list, setList, item) => {
    if (list.includes(item)) {
      setList(list.filter(i => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  const hasActiveFilters = selectedSources.length > 0 || selectedDomains.length > 0 || selectedCertifications.length > 0;

  return (
    <div
      className="rounded-lg p-5 space-y-6"
      style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        color: 'var(--text-primary)',
        boxShadow: 'var(--shadow-sm)'
      }}
    >
      <div
        className="flex items-center justify-between pb-3"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
          <Filter className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
          <span>Filters</span>
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onReset}
            className="text-[11px] font-medium cursor-pointer hover:underline"
            style={{ color: 'var(--brand)' }}
          >
            Clear all
          </button>
        )}
      </div>

      {/* Data Source Filter */}
      <div>
        <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2.5">Data Source</h4>
        <div className="space-y-2">
          {sources.map(src => {
            const isChecked = selectedSources.includes(src.label);
            return (
              <label key={src.label} className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer group">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleFilter(selectedSources, setSelectedSources, src.label)}
                    className="w-4 h-4 rounded text-blue-600 border-slate-300 dark:border-slate-700 focus:ring-blue-500/20"
                  />
                  <span className={isChecked ? 'font-semibold text-slate-900 dark:text-white' : ''}>{src.label}</span>
                </div>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">({src.count})</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Domain Filter */}
      <div>
        <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2.5">Domain</h4>
        <div className="space-y-2">
          {domains.map(dom => {
            const isChecked = selectedDomains.includes(dom.label);
            return (
              <label key={dom.label} className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer group">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleFilter(selectedDomains, setSelectedDomains, dom.label)}
                    className="w-4 h-4 rounded text-blue-600 border-slate-300 dark:border-slate-700 focus:ring-blue-500/20"
                  />
                  <span className={isChecked ? 'font-semibold text-slate-900 dark:text-white' : ''}>{dom.label}</span>
                </div>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">({dom.count})</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Certification Filter */}
      <div>
        <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2.5">Certification</h4>
        <div className="space-y-2">
          {certifications.map(cert => {
            const isChecked = selectedCertifications.includes(cert.label);
            return (
              <label key={cert.label} className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer group">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleFilter(selectedCertifications, setSelectedCertifications, cert.label)}
                    className="w-4 h-4 rounded text-blue-600 border-slate-300 dark:border-slate-700 focus:ring-blue-500/20"
                  />
                  <span className={isChecked ? 'font-semibold text-slate-900 dark:text-white' : ''}>{cert.label}</span>
                </div>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">({cert.count})</span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
