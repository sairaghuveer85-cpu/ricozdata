const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Organization = require('../models/Organization');
const User = require('../models/User');
const Dataset = require('../models/Dataset');
const DataSource = require('../models/DataSource');
const QualityIssue = require('../models/QualityIssue');
const Activity = require('../models/Activity');
const { ROLES } = require('../config/rbac');

let defaultOrgCached = null;

/**
 * Ensures a default primary enterprise organization exists and associates
 * legacy un-scoped documents with this default workspace.
 */
async function ensureDefaultOrganization() {
  if (defaultOrgCached) {
    return defaultOrgCached;
  }

  let org = await Organization.findOne({
    $or: [{ slug: 'ricoz-enterprise' }, { slug: 'ricoz-demo' }]
  });

  if (!org) {
    org = await Organization.create({
      name: 'Ricoz Enterprise',
      slug: 'ricoz-enterprise',
      status: 'ACTIVE',
      settings: {
        tier: 'enterprise',
        maxDataSources: 50,
        maxUsers: 100
      }
    });
  }

  defaultOrgCached = org;

  // Lazily associate any legacy documents that lack organizationId with this default workspace
  try {
    await Promise.all([
      User.updateMany({ organizationId: { $exists: false } }, { $set: { organizationId: org._id } }),
      User.updateMany({ organizationId: null }, { $set: { organizationId: org._id } }),
      DataSource.updateMany({ organizationId: { $exists: false } }, { $set: { organizationId: org._id } }),
      DataSource.updateMany({ organizationId: null }, { $set: { organizationId: org._id } }),
      Dataset.updateMany({ organizationId: { $exists: false } }, { $set: { organizationId: org._id } }),
      Dataset.updateMany({ organizationId: null }, { $set: { organizationId: org._id } }),
      QualityIssue.updateMany({ organizationId: { $exists: false } }, { $set: { organizationId: org._id } }),
      QualityIssue.updateMany({ organizationId: null }, { $set: { organizationId: org._id } }),
      Activity.updateMany({ organizationId: { $exists: false } }, { $set: { organizationId: org._id } }),
      Activity.updateMany({ organizationId: null }, { $set: { organizationId: org._id } }),
    ]);
  } catch (err) {
    console.warn('[OrganizationService] Legacy document migration notice:', err.message);
  }

  return org;
}

/**
 * Creates a unique slug for a given organization name.
 */
async function generateUniqueSlug(organizationName) {
  const baseSlug = (organizationName || 'org')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'workspace';

  let slug = baseSlug;
  let counter = 1;
  while (await Organization.findOne({ slug })) {
    slug = `${baseSlug}-${counter++}`;
  }
  return slug;
}

/**
 * Atomically registers a new Organization and provisions its initial Workspace Administrator.
 * Guarantees atomicity: if user creation fails, the orphan organization is purged.
 */
async function registerOrganizationWorkspace({ organizationName, name, email, password }) {
  if (!organizationName || !organizationName.trim()) {
    throw new Error('Organization name is required.');
  }
  if (!name || !name.trim()) {
    throw new Error('Administrator name is required.');
  }
  if (!email || !email.trim()) {
    throw new Error('Work email is required.');
  }
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedName = name.trim();
  const normalizedOrgName = organizationName.trim();

  // Validate duplicate email
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    const err = new Error('An account with this email address already exists.');
    err.statusCode = 400;
    throw err;
  }

  const slug = await generateUniqueSlug(normalizedOrgName);

  // 1. Create Organization Workspace
  const organization = await Organization.create({
    name: normalizedOrgName,
    slug,
    status: 'ACTIVE',
    settings: {
      tier: 'starter',
      maxDataSources: 20,
      maxUsers: 50
    }
  });

  // 2. Create Initial Workspace Administrator
  let user;
  try {
    user = await User.create({
      name: normalizedName,
      email: normalizedEmail,
      password, // Hashed by User model pre-save hook
      role: ROLES.MAIN_ADMIN,
      isMainAdmin: true,
      organizationId: organization._id,
      department: 'Executive Administration',
      status: 'ACTIVE'
    });

    organization.ownerId = user._id;
    await organization.save();
  } catch (userErr) {
    // Atomic rollback to prevent orphan workspaces
    await Organization.findByIdAndDelete(organization._id).catch(() => {});
    throw userErr;
  }

  // 3. Issue JWT Token
  const token = jwt.sign(
    {
      id: user._id,
      role: ROLES.MAIN_ADMIN,
      email: user.email,
      isMainAdmin: true,
      organizationId: organization._id
    },
    process.env.JWT_SECRET || 'super-secret-jwt-key-1234567890',
    { expiresIn: '30d' }
  );

  return {
    organization: {
      id: organization._id,
      name: organization.name,
      slug: organization.slug,
      status: organization.status
    },
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isMainAdmin: true,
      organizationId: organization._id,
      department: user.department,
      avatar: user.avatar,
      avatarBg: user.avatarBg,
      status: user.status
    },
    token
  };
}

module.exports = {
  ensureDefaultOrganization,
  generateUniqueSlug,
  registerOrganizationWorkspace
};
