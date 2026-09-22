export const INITIAL_USERS = [
  {
    id: 'user-1',
    name: 'Raghuveer C.',
    email: 'raghuveer@ricozdata.com',
    role: 'Data Analyst',
    status: 'Active',
    avatar: 'R',
    avatarBg: 'bg-blue-600',
    department: 'Analytics',
    lastActive: 'Just now'
  },
  {
    id: 'user-2',
    name: 'Priya S.',
    email: 'priya@ricozdata.com',
    role: 'Data Owner',
    status: 'Active',
    avatar: 'P',
    avatarBg: 'bg-emerald-600',
    department: 'Marketing Data',
    lastActive: '10 minutes ago'
  },
  {
    id: 'user-3',
    name: 'Arjun K.',
    email: 'arjun@ricozdata.com',
    role: 'Data Engineer',
    status: 'Active',
    avatar: 'A',
    avatarBg: 'bg-indigo-600',
    department: 'Data Platform',
    lastActive: '25 minutes ago'
  },
  {
    id: 'user-4',
    name: 'Neha R.',
    email: 'neha@ricozdata.com',
    role: 'Product Manager',
    status: 'Active',
    avatar: 'N',
    avatarBg: 'bg-amber-600',
    department: 'Product',
    lastActive: '1 hour ago'
  },
  {
    id: 'user-5',
    name: 'Vikram M.',
    email: 'vikram@ricozdata.com',
    role: 'Admin',
    status: 'Active',
    avatar: 'V',
    avatarBg: 'bg-purple-600',
    department: 'Security & Governance',
    lastActive: '2 hours ago'
  },
  {
    id: 'user-6',
    name: 'Kavya S.',
    email: 'kavya@ricozdata.com',
    role: 'Data Analyst',
    status: 'Active',
    avatar: 'K',
    avatarBg: 'bg-teal-600',
    department: 'Finance Analytics',
    lastActive: '4 hours ago'
  },
  {
    id: 'user-7',
    name: 'Rohan P.',
    email: 'rohan@ricozdata.com',
    role: 'Marketing Lead',
    status: 'Active',
    avatar: 'R',
    avatarBg: 'bg-rose-600',
    department: 'Growth Marketing',
    lastActive: 'Yesterday'
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
    lead: 'Vikram M.'
  },
  {
    id: 'group-2',
    name: 'Core Analytics & BI',
    description: 'Cross-functional analytics team delivering executive insights and predictive modeling.',
    membersCount: 18,
    lead: 'Raghuveer C.'
  },
  {
    id: 'group-3',
    name: 'Data Platform Engineering',
    description: 'Infrastructure and pipeline architects responsible for data lakes and warehouses.',
    membersCount: 15,
    lead: 'Arjun K.'
  },
  {
    id: 'group-4',
    name: 'Marketing Operations',
    description: 'Manages acquisition, customer retention datasets, and campaign performance dashboards.',
    membersCount: 9,
    lead: 'Priya S.'
  }
];
