import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { connectDB, disconnectDB } from '../src/config/database.js';
import { Organization } from '../src/models/Organization.js';
import { Dataset } from '../src/models/Dataset.js';
import { User } from '../src/models/User.js';
import { hashPassword } from '../src/utils/crypto.js';

const BASE_URL = 'http://localhost:5000/api/v1';

async function test() {
  await connectDB();
  console.log('--- 1. Checking MongoDB for ricoz-demo datasets ---');
  let org = await Organization.findOne({ slug: 'ricoz-demo' });
  if (!org) {
    console.log('Org ricoz-demo not found!');
    return;
  }
  console.log('Found org:', org._id.toString(), org.slug);

  const datasetsInDb = await Dataset.find({
    organizationId: org._id,
    isDeleted: { $ne: true }
  });
  console.log(`Total active datasets in DB for ricoz-demo: ${datasetsInDb.length}`);
  for (const d of datasetsInDb) {
    console.log(` - ID: ${d._id}, Name: "${d.name}", SyncStatus: ${d.syncStatus}, Origin: ${d.origin}`);
  }

  // Ensure lead.steward exists and has password
  let user = await User.findOne({ organizationId: org._id, email: 'lead.steward@ricoz.io' });
  if (!user) {
    user = await User.create({
      organizationId: org._id,
      email: 'lead.steward@ricoz.io',
      name: 'Aria Vance',
      passwordHash: hashPassword('EnterprisePassword2026!'),
      role: 'admin',
      isEmailVerified: true
    });
  } else {
    user.passwordHash = hashPassword('EnterprisePassword2026!');
    user.role = 'admin';
    await user.save();
  }

  // Login via API
  console.log('\n--- 2. Logging in via API ---');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tenant-Slug': 'ricoz-demo' },
    body: JSON.stringify({ email: 'lead.steward@ricoz.io', password: 'EnterprisePassword2026!', slug: 'ricoz-demo' })
  });
  const loginData = await loginRes.json();
  const token = loginData.data?.accessToken;
  console.log('Login status:', loginRes.status, 'Token acquired:', Boolean(token));

  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  // Test GET /api/v1/datasets
  console.log('\n--- 3. Testing GET /api/v1/datasets ---');
  const listRes = await fetch(`${BASE_URL}/datasets`, { headers: authHeaders });
  const listData = await listRes.json();
  console.log('GET /datasets status:', listRes.status, 'Returned count:', listData.data?.length);
  if (listData.data) {
    console.log('Dataset names from API:', listData.data.map(d => d.name));
  }

  // Test Search for "customers"
  console.log('\n--- 4. Testing GET /api/v1/datasets?search=customers ---');
  const custRes = await fetch(`${BASE_URL}/datasets?search=customers`, { headers: authHeaders });
  const custData = await custRes.json();
  console.log('Search customers status:', custRes.status, 'Found:', custData.data?.map(d => d.name));

  // Test Search for "products"
  console.log('\n--- 5. Testing GET /api/v1/datasets?search=products ---');
  const prodRes = await fetch(`${BASE_URL}/datasets?search=products`, { headers: authHeaders });
  const prodData = await prodRes.json();
  console.log('Search products status:', prodRes.status, 'Found:', prodData.data?.map(d => d.name));

  // Test Unified Search /api/v1/search?query=customers
  console.log('\n--- 6. Testing GET /api/v1/search?query=customers ---');
  const uniCustRes = await fetch(`${BASE_URL}/search?query=customers`, { headers: authHeaders });
  const uniCustData = await uniCustRes.json();
  console.log('Unified search status:', uniCustRes.status, 'Items:', uniCustData.data?.items?.map(i => `${i.name} (${i.entityType})`));

  // Test Unified Search /api/v1/search?query=products
  console.log('\n--- 7. Testing GET /api/v1/search?query=products ---');
  const uniProdRes = await fetch(`${BASE_URL}/search?query=products`, { headers: authHeaders });
  const uniProdData = await uniProdRes.json();
  console.log('Unified search status:', uniProdRes.status, 'Items:', uniProdData.data?.items?.map(i => `${i.name} (${i.entityType})`));

  await disconnectDB();
}

test().catch(console.error);
