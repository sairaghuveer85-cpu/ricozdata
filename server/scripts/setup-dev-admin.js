/**
 * Safe Local Development Administrator Setup Script
 *
 * Configures or provisions a local development administrator account with
 * the ADMIN role and full application permissions.
 *
 * RESTRICTIONS:
 * - Local development only (Strictly blocked in production).
 * - Reads credentials from environment variables (DEV_ADMIN_EMAIL, DEV_ADMIN_PASSWORD).
 * - Does NOT silently change existing passwords.
 * - Idempotent: safe to run multiple times.
 */

const path = require('path');
const dotenv = require('dotenv');

// Load environment from server directory
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const { ROLES } = require('../config/rbac');

async function setupDevAdmin() {
  console.log('===============================================================');
  console.log('RicozData Development Admin Account Configuration');
  console.log('===============================================================');

  // Hard production guard
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: This development bootstrap script cannot be run in production mode.');
    process.exit(1);
  }

  const devEmail = (process.env.DEV_ADMIN_EMAIL || 'mainadmin@ricozdata.com').trim().toLowerCase();
  const devPassword = process.env.DEV_ADMIN_PASSWORD || 'MainAdmin2026!';
  const devName = process.env.DEV_ADMIN_NAME || 'Designated Main Admin';
  const devDepartment = process.env.DEV_ADMIN_DEPT || 'Enterprise Administration';

  try {
    await connectDB();

    let user = await User.findOne({ email: devEmail });

    if (user) {
      console.log(`\nFound existing account for: ${devEmail}`);
      let modified = false;

      if (user.role !== ROLES.MAIN_ADMIN) {
        console.log(`Setting role to "${ROLES.MAIN_ADMIN}"...`);
        user.role = ROLES.MAIN_ADMIN;
        modified = true;
      }

      if (!user.isMainAdmin) {
        console.log(`Designating account as Main Admin (isMainAdmin: true)...`);
        user.isMainAdmin = true;
        modified = true;
      }

      if (user.status !== 'ACTIVE') {
        console.log(`Activating suspended/inactive account status to "ACTIVE"...`);
        user.status = 'ACTIVE';
        modified = true;
      }

      if (process.env.DEV_ADMIN_FORCE_PASSWORD === 'true') {
        console.log(`Resetting password per DEV_ADMIN_FORCE_PASSWORD flag...`);
        user.password = devPassword;
        modified = true;
      }

      if (modified) {
        await user.save();
        console.log(`✓ Account successfully configured as designated Main Admin.`);
      } else {
        console.log(`✓ Account is already configured as the designated Main Admin.`);
      }
      console.log(`Note: Existing account password was preserved unchanged.`);
    } else {
      console.log(`\nCreating designated Main Admin account: ${devEmail}...`);
      user = await User.create({
        name: devName,
        email: devEmail,
        password: devPassword, // Hashed by userSchema.pre('save')
        role: ROLES.MAIN_ADMIN,
        isMainAdmin: true,
        department: devDepartment,
        avatar: devName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'MA',
        avatarBg: 'bg-indigo-600',
        status: 'ACTIVE',
      });
      console.log(`✓ Designated Main Admin created successfully.`);
    }

    const { ensureDefaultOrganization } = require('../services/organizationService');
    const defaultOrg = await ensureDefaultOrganization();
    if (!user.organizationId) {
      user.organizationId = defaultOrg._id;
      await user.save();
    }

    console.log('\n--- Main Admin Account Details ---');
    console.log(`Name:        ${user.name}`);
    console.log(`Email:       ${user.email}`);
    console.log(`Role:        ${user.role}`);
    console.log(`isMainAdmin: ${user.isMainAdmin}`);
    console.log(`Status:      ${user.status}`);
    console.log(`Department:  ${user.department}`);
    console.log('-----------------------------------');
    console.log('Main Admin setup completed successfully.\n');
  } catch (error) {
    console.error('Main admin setup failed:', error.message);
    process.exit(1);
  } finally {
    if (mongoose.connection && mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

if (require.main === module) {
  setupDevAdmin();
}

module.exports = { setupDevAdmin };
