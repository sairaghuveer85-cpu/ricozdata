/**
 * Declarative contextual tour steps mapping real RicozData features.
 * Each step targets genuine UI elements that exist in the application.
 */

export const TOUR_STEPS = [
  {
    id: 'dashboard',
    route: '/dashboard',
    targetSelector: '[data-tour="dashboard-metrics"], .dashboard-metrics',
    title: 'Operational Health at a Glance',
    description: "Monitor your organization's data estate in real time, tracking total cataloged assets, automated quality SLA scores, and active governance alerts.",
    placement: 'bottom',
  },
  {
    id: 'datasources',
    route: '/datasources',
    targetSelector: '[data-tour="add-datasource"], [data-tour="datasource-stats"]',
    title: 'Connect Enterprise Data Sources',
    description: "Connect live relational databases, cloud warehouses, and storage buckets (PostgreSQL, Snowflake, MySQL, MongoDB, S3) with encrypted credentials.",
    placement: 'bottom',
  },
  {
    id: 'catalog',
    route: '/catalog',
    targetSelector: '[data-tour="catalog-search"]',
    title: 'Search & Asset Discovery',
    description: 'Search across all discovered tables and schemas. Filter assets by domain ownership, classification tags, and certification levels.',
    placement: 'bottom',
  },
  {
    id: 'dataset-schema',
    route: '/catalog',
    targetSelector: '[data-tour="catalog-table"], .enterprise-workbench table',
    title: 'Schema & Column Structure',
    description: 'Inspect columns, nullability constraints, and physical data types (VARCHAR, UUID, TIMESTAMP) extracted directly from your database engines.',
    placement: 'top',
  },
  {
    id: 'quality',
    route: '/quality/customer-master',
    targetSelector: '[data-tour="quality-score"]',
    title: 'Automated Quality Checks',
    description: 'Track automated evaluations for freshness, null rates, uniqueness, and format integrity to ensure analytical trustworthiness.',
    placement: 'bottom',
  },
  {
    id: 'glossary',
    route: '/glossary',
    targetSelector: '[data-tour="glossary-filters"]',
    title: 'Standard Business Definitions',
    description: 'Translate cryptic database field names and technical jargon into verified, business-friendly definitions with domain owners.',
    placement: 'bottom',
  },
  {
    id: 'lineage',
    route: '/lineage/customer-master',
    targetSelector: '[data-tour="lineage-canvas"]',
    title: 'End-to-End Data Relationships',
    description: 'Trace how data flows from upstream database sources through transformation pipelines into downstream analytical assets.',
    placement: 'top',
  },
];
