export const APP_NAME = 'RicozData';

export const DOMAINS = ['All Domains', 'Marketing', 'Finance', 'Product', 'HR', 'Sales'];

export const DATA_SOURCES = ['Snowflake', 'BigQuery', 'PostgreSQL', 'MySQL', 'Others'];

export const CERTIFICATION_STATUSES = ['Certified', 'In Review', 'Not Certified'];

export const SENSITIVITY_LEVELS = ['Public', 'Internal', 'Confidential', 'PII', 'Restricted'];

export const USER_ROLES = ['Admin', 'Data Owner', 'Data Engineer', 'Data Analyst', 'Product Manager', 'Viewer'];

export const SEVERITY_COLORS = {
  High: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' },
  Medium: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
  Low: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
};

export const STATUS_COLORS = {
  Active: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
  Certified: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
  'In Review': { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
  'Not Certified': { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' },
  Open: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' },
  'In Progress': { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
  Resolved: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
  Inactive: { bg: 'bg-slate-100', text: 'text-slate-500', border: 'border-slate-200' },
};
