/** Centralized business-domain registry for the Ricoz Industries demo. */
export const INITIAL_DOMAINS = [
  ['customer', 'Customer', 'Customer identity, service, and master-data assets.', 'user-002', 'Users', 'emerald'],
  ['finance', 'Finance', 'Ledger, revenue, billing, and financial-control assets.', 'user-006', 'DollarSign', 'amber'],
  ['sales', 'Sales', 'Orders, sales performance, and commercial analytics assets.', 'user-008', 'BarChart3', 'blue'],
  ['product', 'Product', 'Product catalog, SKU, pricing, and inventory assets.', 'user-004', 'Package', 'indigo'],
  ['marketing', 'Marketing', 'Campaign, lead, attribution, and audience assets.', 'user-007', 'TrendingUp', 'rose'],
  ['human-resources', 'Human Resources', 'Workforce, organization, and people-operations assets.', 'user-005', 'UserCheck', 'purple'],
  ['operations', 'Operations', 'Warehouse, fulfillment, and operational reliability assets.', 'user-003', 'Cpu', 'cyan']
].map(([id, name, description, leadId, icon, color]) => ({ id, name, description, leadId, icon, color }));

export const DOMAIN_NAMES = INITIAL_DOMAINS.map(({ name }) => name);
export const DOMAIN_REGISTRY = INITIAL_DOMAINS;
