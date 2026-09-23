export const INITIAL_USERS = [
  {
    id: 'user-001',
    name: 'Raghuveer C.',
    email: 'raghuveer@ricozdata.com',
    roleId: 'role-analyst',
    role: 'Data Analyst',
    status: 'Active',
    avatar: 'R',
    avatarBg: 'bg-blue-600',
    department: 'Analytics',
    title: 'Lead Data Analyst',
    lastActive: 'Just now'
  },
  {
    id: 'user-002',
    name: 'Priya S.',
    email: 'priya@ricozdata.com',
    roleId: 'role-owner',
    role: 'Data Owner',
    status: 'Active',
    avatar: 'P',
    avatarBg: 'bg-emerald-600',
    department: 'Marketing Data',
    title: 'Principal Data Steward',
    lastActive: '10 minutes ago'
  },
  {
    id: 'user-003',
    name: 'Arjun K.',
    email: 'arjun@ricozdata.com',
    roleId: 'role-engineer',
    role: 'Data Engineer',
    status: 'Active',
    avatar: 'A',
    avatarBg: 'bg-indigo-600',
    department: 'Data Platform',
    title: 'Senior Data Platform Engineer',
    lastActive: '25 minutes ago'
  },
  {
    id: 'user-004',
    name: 'Neha R.',
    email: 'neha@ricozdata.com',
    roleId: 'role-owner',
    role: 'Product Manager',
    status: 'Active',
    avatar: 'N',
    avatarBg: 'bg-amber-600',
    department: 'Product',
    title: 'Principal Product Manager',
    lastActive: '1 hour ago'
  },
  {
    id: 'user-005',
    name: 'Vikram M.',
    email: 'vikram@ricozdata.com',
    roleId: 'role-admin',
    role: 'Admin',
    status: 'Active',
    avatar: 'V',
    avatarBg: 'bg-purple-600',
    department: 'Security & Governance',
    title: 'Chief Information Security Officer',
    lastActive: '2 hours ago'
  },
  {
    id: 'user-006',
    name: 'Kavya S.',
    email: 'kavya@ricozdata.com',
    roleId: 'role-analyst',
    role: 'Data Analyst',
    status: 'Active',
    avatar: 'K',
    avatarBg: 'bg-teal-600',
    department: 'Finance Analytics',
    title: 'Senior Financial Data Analyst',
    lastActive: '4 hours ago'
  },
  {
    id: 'user-007',
    name: 'Rohan P.',
    email: 'rohan@ricozdata.com',
    roleId: 'role-owner',
    role: 'Marketing Lead',
    status: 'Active',
    avatar: 'R',
    avatarBg: 'bg-rose-600',
    department: 'Growth Marketing',
    title: 'Growth Marketing Lead',
    lastActive: 'Yesterday'
  },
  {
    id: 'system-guard',
    name: 'System Guard',
    email: 'security-bot@ricozdata.com',
    roleId: 'role-admin',
    role: 'Automated Bot',
    status: 'Active',
    avatar: 'SG',
    avatarBg: 'bg-slate-700',
    department: 'Security Automation',
    title: 'Governance & Security Bot',
    lastActive: 'Continuous'
  },
  {
    id: 'pipeline-worker',
    name: 'Pipeline Worker',
    email: 'orchestrator@ricozdata.com',
    roleId: 'role-engineer',
    role: 'Automated Bot',
    status: 'Active',
    avatar: 'PW',
    avatarBg: 'bg-cyan-700',
    department: 'Data Platform',
    title: 'Airflow Ingestion Service',
    lastActive: 'Continuous'
  }
];

export const INITIAL_ROLES = [
  {
    id: 'role-admin',
    name: 'Admin',
    description: 'Full administrative access to manage workspace, users, and security settings.',
    usersCount: 3,
    permissions: ['all_permissions', 'manage_users', 'manage_policies', 'export_data', 'edit_schemas']
  },
  {
    id: 'role-owner',
    name: 'Data Owner',
    description: 'Can certify datasets, manage metadata, assign access, and approve schema changes.',
    usersCount: 8,
    permissions: ['certify_datasets', 'manage_glossary', 'edit_metadata', 'view_all']
  },
  {
    id: 'role-engineer',
    name: 'Data Engineer',
    description: 'Can build pipelines, register data sources, manage lineage, and configure quality tests.',
    usersCount: 12,
    permissions: ['manage_lineage', 'configure_tests', 'edit_schemas', 'view_all']
  },
  {
    id: 'role-analyst',
    name: 'Data Analyst',
    description: 'Can explore catalog, query certified datasets, view lineage, and run quality reports.',
    usersCount: 24,
    permissions: ['query_data', 'view_lineage', 'view_quality', 'suggest_terms']
  },
  {
    id: 'role-viewer',
    name: 'Viewer',
    description: 'Read-only access to discover datasets and read glossary documentation.',
    usersCount: 45,
    permissions: ['view_catalog', 'view_glossary']
  }
];

export const INITIAL_GROUPS = [
  {
    id: 'group-1',
    name: 'Data Governance Board',
    description: 'Oversees organizational policy compliance, audit reporting, and data quality standards.',
    membersCount: 12,
    leadId: 'user-005',
    lead: 'Vikram M.'
  },
  {
    id: 'group-2',
    name: 'Core Analytics & BI',
    description: 'Cross-functional analytics team delivering executive insights and predictive modeling.',
    membersCount: 18,
    leadId: 'user-001',
    lead: 'Raghuveer C.'
  },
  {
    id: 'group-3',
    name: 'Data Platform Engineering',
    description: 'Infrastructure and pipeline architects responsible for data lakes and warehouses.',
    membersCount: 15,
    leadId: 'user-003',
    lead: 'Arjun K.'
  },
  {
    id: 'group-4',
    name: 'Marketing Operations',
    description: 'Manages acquisition, customer retention datasets, and campaign performance dashboards.',
    membersCount: 9,
    leadId: 'user-002',
    lead: 'Priya S.'
  }
];
