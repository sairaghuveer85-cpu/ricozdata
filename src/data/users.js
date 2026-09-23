/** Centralized Ricoz Industries people directory. */
const user = (id, name, email, role, department, avatar, avatarBg, status = 'active') => ({ id, name, email, role, department, avatar, avatarBg, status, lastActive: '2026-09-22T09:30:00Z', isAuthenticated: false });

export const INITIAL_USERS = [
  user('user-001', 'Raghuveer Chandran', 'raghuveer.chandran@ricoz-industries.demo', 'Data Analyst', 'Enterprise Analytics', 'RC', 'bg-blue-600'),
  user('user-002', 'Priya Shah', 'priya.shah@ricoz-industries.demo', 'Data Governance Manager', 'Data Governance', 'PS', 'bg-emerald-600'),
  user('user-003', 'Arjun Kumar', 'arjun.kumar@ricoz-industries.demo', 'Data Engineer', 'Data Platform', 'AK', 'bg-indigo-600'),
  user('user-004', 'Meera Iyer', 'meera.iyer@ricoz-industries.demo', 'Product Data Owner', 'Product', 'MI', 'bg-violet-600'),
  user('user-005', 'Vikram Mehta', 'vikram.mehta@ricoz-industries.demo', 'Data Steward', 'Human Resources', 'VM', 'bg-purple-600'),
  user('user-006', 'Kavya Sharma', 'kavya.sharma@ricoz-industries.demo', 'Finance Data Owner', 'Finance', 'KS', 'bg-amber-600'),
  user('user-007', 'Neha Rao', 'neha.rao@ricoz-industries.demo', 'Marketing Analyst', 'Marketing', 'NR', 'bg-rose-600'),
  user('user-008', 'Sanjay Patel', 'sanjay.patel@ricoz-industries.demo', 'Sales Operations Manager', 'Sales', 'SP', 'bg-cyan-600'),
  user('user-009', 'Aditi Menon', 'aditi.menon@ricoz-industries.demo', 'Security Administrator', 'Information Security', 'AM', 'bg-slate-600'),
  user('user-010', 'Daniel Lee', 'daniel.lee@ricoz-industries.demo', 'Platform Administrator', 'Data Platform', 'DL', 'bg-teal-600')
];

export const ROLES = INITIAL_USERS.map(({ role }) => role);
export const INITIAL_ROLES = [...new Set(INITIAL_USERS.map(({ role }) => role))].map((name) => ({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, description: `Ricoz Industries ${name} role for governed demo data.`, usersCount: INITIAL_USERS.filter((user) => user.role === name).length, permissions: ['view_catalog', 'view_lineage', 'view_quality'] }));
export const INITIAL_GROUPS = [
  { id: 'group-governance', name: 'Data Governance Council', description: 'Coordinates policy, glossary, and certification stewardship.', membersCount: 3, lead: 'Priya Shah' },
  { id: 'group-platform', name: 'Data Platform Operations', description: 'Maintains pipelines, lineage metadata, and platform controls.', membersCount: 3, lead: 'Arjun Kumar' },
  { id: 'group-commercial', name: 'Commercial Data Community', description: 'Owns sales, customer, product, and marketing data assets.', membersCount: 4, lead: 'Sanjay Patel' }
];
