export const APP_NAME = 'RicozData';

export const DOMAINS = ['All Domains', 'Customer', 'Finance', 'Sales', 'Product', 'Marketing', 'Human Resources', 'Operations'];

export const DATA_SOURCES = ['Salesforce', 'Snowflake', 'SAP S/4HANA', 'Microsoft SQL Server', 'HubSpot', 'Workday'];

export const CERTIFICATION_STATUSES = ['Certified', 'In Review', 'Not Certified'];

export const SENSITIVITY_LEVELS = ['Public', 'Internal', 'Confidential', 'Restricted'];

export const QUALITY_TIERS = [
  { label: 'All', min: 0, max: 100 },
  { label: '90%+', min: 90, max: 100 },
  { label: '80–89%', min: 80, max: 89 },
  { label: '70–79%', min: 70, max: 79 },
  { label: 'Below 70%', min: 0, max: 69 }
];

export const USER_ROLES = ['Admin', 'Data Owner', 'Data Engineer', 'Data Analyst', 'Product Manager', 'Viewer'];

export const ACTIVITY_TYPES = ['quality', 'update', 'alert', 'governance', 'lineage', 'create', 'access'];

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
