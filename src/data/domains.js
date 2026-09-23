/**
 * Centralized Enterprise Domains Model
 * Single source of truth for all business domains in RicozData.
 */

export const INITIAL_DOMAINS = [
  {
    id: 'customer',
    name: 'Customer',
    description: 'Customer master data, identity resolution, CRM records, support interactions, and churn indicators.',
    leadId: 'user-002', // Priya S.
    icon: 'Users',
    color: 'emerald'
  },
  {
    id: 'finance',
    name: 'Finance',
    description: 'General ledger reconciliations, billing transactions, accounts payable/receivable, and quarterly forecasts.',
    leadId: 'user-006', // Kavya S.
    icon: 'DollarSign',
    color: 'amber'
  },
  {
    id: 'product',
    name: 'Product',
    description: 'Product master catalog, SKU taxonomy, inventory levels, digital assets, and feature telemetry.',
    leadId: 'user-004', // Neha R.
    icon: 'Package',
    color: 'blue'
  },
  {
    id: 'hr',
    name: 'HR',
    description: 'Employee profiles, organizational hierarchies, compensation structures, and corporate compliance training.',
    leadId: 'user-005', // Vikram M.
    icon: 'UserCheck',
    color: 'purple'
  },
  {
    id: 'marketing',
    name: 'Marketing',
    description: 'Ad campaign performance, multi-touch attribution, engagement metrics, and audience segments.',
    leadId: 'user-007', // Rohan P.
    icon: 'TrendingUp',
    color: 'rose'
  },
  {
    id: 'operations',
    name: 'Operations',
    description: 'Supply chain logistics, fulfillment pipelines, infrastructure monitors, and SLA compliance metrics.',
    leadId: 'user-003', // Arjun K.
    icon: 'Cpu',
    color: 'cyan'
  }
];

export const DOMAIN_NAMES = INITIAL_DOMAINS.map(d => d.name);
export const DOMAIN_REGISTRY = INITIAL_DOMAINS;

