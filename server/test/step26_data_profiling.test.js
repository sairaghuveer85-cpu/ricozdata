import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/database.js';
import { Dataset } from '../src/models/Dataset.js';
import { DataSource } from '../src/models/DataSource.js';
import { User } from '../src/models/User.js';
import { Organization } from '../src/models/Organization.js';
import { DataProfile } from '../src/models/DataProfile.js';
import { ProfilingService } from '../src/services/ProfilingService.js';
import * as datasetController from '../src/controllers/dataset.controller.js';
import '../src/connectors/index.js';

test('Step 26 — Data Profiling Verification (Live PostgreSQL)', async (t) => {
  await connectDB();

  const orgAId = new mongoose.Types.ObjectId();
  const orgBId = new mongoose.Types.ObjectId();
  const adminAId = new mongoose.Types.ObjectId();

  await Organization.create({ _id: orgAId, name: 'Profiling Org A', slug: 'prof-org-a-' + Date.now() });
  await Organization.create({ _id: orgBId, name: 'Profiling Org B', slug: 'prof-org-b-' + Date.now() });

  await User.create({
    _id: adminAId,
    organizationId: orgAId,
    name: 'Profile Admin',
    email: 'admin.profile@alpha.com',
    role: 'admin',
    passwordHash: 'dummy_hash'
  });

  const pgSource = new DataSource({
    organizationId: orgAId,
    name: 'Real PG Profiling Source',
    type: 'postgresql',
    configuration: {
      host: process.env.POSTGRES_TEST_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_TEST_PORT || '5432', 10),
      database: process.env.POSTGRES_TEST_DB || 'ricoz_test',
      username: process.env.POSTGRES_TEST_USER || 'postgres',
      schema: 'public'
    },
    status: 'ACTIVE',
    createdBy: adminAId
  });
  pgSource.setCredentials({
    username: process.env.POSTGRES_TEST_USER || 'postgres',
    password: String(process.env.POSTGRES_TEST_PASSWORD || '1818')
  });
  await pgSource.save();

  // Create real customers dataset
  const customersDataset = await Dataset.create({
    organizationId: orgAId,
    dataSourceId: pgSource._id,
    name: 'customers',
    schemaName: 'public',
    columns: [
      { name: 'customer_id', dataType: 'integer', isPrimaryKey: true, nullable: false },
      { name: 'name', dataType: 'character varying', nullable: false },
      { name: 'email', dataType: 'character varying', nullable: true, classification: 'pii' },
      { name: 'phone', dataType: 'character varying', nullable: true, classification: 'pii' },
      { name: 'age', dataType: 'integer', nullable: true },
      { name: 'created_at', dataType: 'timestamp without time zone', nullable: true }
    ],
    status: 'ACTIVE'
  });

  // Create real products dataset
  const productsDataset = await Dataset.create({
    organizationId: orgAId,
    dataSourceId: pgSource._id,
    name: 'products',
    schemaName: 'public',
    columns: [
      { name: 'product_id', dataType: 'integer', isPrimaryKey: true, nullable: false },
      { name: 'product_name', dataType: 'character varying', nullable: false },
      { name: 'price', dataType: 'numeric', nullable: false },
      { name: 'category', dataType: 'character varying', nullable: true },
      { name: 'created_at', dataType: 'timestamp without time zone', nullable: true }
    ],
    status: 'ACTIVE'
  });

  let customerProfile = null;
  let productProfile = null;

  await t.test('26.1 Live PostgreSQL Customers Profiling: Computes row count, null percentages, distinct counts, averages', async () => {
    customerProfile = await ProfilingService.profileDataset(customersDataset._id, orgAId, {
      actor: { _id: adminAId }
    });

    assert.ok(customerProfile);
    assert.equal(customerProfile.status, 'SUCCESS');
    assert.equal(customerProfile.rowCount, 4, 'customers table must have exactly 4 rows in PostgreSQL');
    assert.ok(customerProfile.columns.length >= 6);

    // Verify email column stats: 1 null out of 4 rows = 25% null percentage
    const emailCol = customerProfile.columns.find(c => c.columnName === 'email');
    assert.ok(emailCol);
    assert.equal(emailCol.nullCount, 1, 'email column has 1 null value in row 4');
    assert.equal(emailCol.nullPercentage, 25, 'email null percentage must be 25%');
    assert.equal(emailCol.distinctCount, 3, 'email distinct count must be 3 non-null emails');

    // Verify age column stats: numeric stats (mean, median, min, max)
    const ageCol = customerProfile.columns.find(c => c.columnName === 'age');
    assert.ok(ageCol);
    assert.equal(ageCol.nullCount, 0);
    assert.ok(ageCol.meanValue !== null);
    // Ages in customers: 28, 32, 41, 25 -> sum = 126, avg = 31.5
    assert.equal(ageCol.meanValue, 31.5, 'Average age must be exactly 31.5');
    assert.equal(ageCol.minValue, '25', 'Minimum age must be 25');
    assert.equal(ageCol.maxValue, '41', 'Maximum age must be 41');
  });

  await t.test('26.2 Live PostgreSQL Products Profiling: Computes price metrics and category histogram', async () => {
    productProfile = await ProfilingService.profileDataset(productsDataset._id, orgAId, {
      actor: { _id: adminAId }
    });

    assert.ok(productProfile);
    assert.equal(productProfile.status, 'SUCCESS');
    assert.equal(productProfile.rowCount, 4, 'products table must have 4 rows');

    // Prices: 65000, 2500, 1200, 18000 -> sum = 86700, avg = 21675
    const priceCol = productProfile.columns.find(c => c.columnName === 'price');
    assert.ok(priceCol);
    assert.equal(priceCol.nullCount, 0);
    assert.equal(priceCol.meanValue, 21675);
    assert.equal(priceCol.minValue, '1200.00');
    assert.equal(priceCol.maxValue, '65000.00');

    // Category histogram
    const catCol = productProfile.columns.find(c => c.columnName === 'category');
    assert.ok(catCol);
    assert.ok(catCol.histogram.length > 0);
    const accessoriesBucket = catCol.histogram.find(h => h.bucket === 'Accessories');
    assert.ok(accessoriesBucket);
    assert.equal(accessoriesBucket.count, 2, 'Accessories category appears twice');
  });

  await t.test('26.3 Sensitive Value Protection: PII columns have redacted histogram previews', async () => {
    const emailCol = customerProfile.columns.find(c => c.columnName === 'email');
    assert.ok(emailCol);
    if (emailCol.histogram.length > 0) {
      assert.equal(emailCol.histogram[0].bucket, '[REDACTED_SENSITIVE]', 'Sensitive email must be redacted from histogram');
    }
  });

  await t.test('26.4 Profiling History & APIs: getLatestProfile and getProfileHistory return stored data', async () => {
    const latest = await ProfilingService.getLatestProfile(customersDataset._id, orgAId);
    assert.ok(latest);
    assert.equal(latest._id.toString(), customerProfile._id.toString());

    const history = await ProfilingService.getProfileHistory(customersDataset._id, orgAId);
    assert.ok(history.profiles.length >= 1);
    assert.equal(history.meta.total >= 1, true);
  });

  await t.test('26.5 Tenant Isolation: Org B cannot profile or access Org A profiles', async () => {
    let resData;
    const res = {
      status(code) { this.statusCode = code; return this; },
      json(payload) { resData = payload; return this; }
    };

    // Org B tries to trigger profile on Org A dataset
    await assert.rejects(
      () => ProfilingService.profileDataset(customersDataset._id, orgBId),
      /Dataset not found/i
    );

    // Org B tries to get latest profile
    const bLatest = await ProfilingService.getLatestProfile(customersDataset._id, orgBId);
    assert.equal(bLatest, null);
  });

  // Cleanup
  await DataProfile.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await Dataset.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await DataSource.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await User.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await Organization.deleteMany({ _id: { $in: [orgAId, orgBId] } });

  await disconnectDB();
});
