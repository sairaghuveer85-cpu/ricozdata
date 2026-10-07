import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/database.js';
import { Dataset } from '../src/models/Dataset.js';
import { DataSource } from '../src/models/DataSource.js';
import { User } from '../src/models/User.js';
import { Organization } from '../src/models/Organization.js';
import { GlossaryTerm } from '../src/models/GlossaryTerm.js';
import * as glossaryController from '../src/controllers/glossary.controller.js';

test('Step 28 — Business Glossary Verification', async (t) => {
  await connectDB();

  const orgAId = new mongoose.Types.ObjectId();
  const orgBId = new mongoose.Types.ObjectId();
  const adminAId = new mongoose.Types.ObjectId();

  await Organization.create({ _id: orgAId, name: 'Glossary Org A', slug: 'glo-org-a-' + Date.now() });
  await Organization.create({ _id: orgBId, name: 'Glossary Org B', slug: 'glo-org-b-' + Date.now() });

  await User.create({
    _id: adminAId,
    organizationId: orgAId,
    name: 'Glossary Admin',
    email: 'admin.glossary@alpha.com',
    role: 'admin',
    passwordHash: 'dummy_hash'
  });

  const dsA = await DataSource.create({
    organizationId: orgAId,
    name: 'Glossary Source A',
    type: 'postgresql',
    configuration: { host: 'localhost', database: 'analytics' },
    status: 'ACTIVE',
    createdBy: adminAId
  });

  const dsB = await DataSource.create({
    organizationId: orgBId,
    name: 'Glossary Source B',
    type: 'postgresql',
    configuration: { host: 'localhost', database: 'finance' },
    status: 'ACTIVE',
    createdBy: adminAId
  });

  const datasetA = await Dataset.create({
    organizationId: orgAId,
    dataSourceId: dsA._id,
    name: 'customers',
    schemaName: 'public',
    columns: [
      { name: 'customer_id', dataType: 'integer' },
      { name: 'email', dataType: 'character varying' }
    ],
    status: 'ACTIVE'
  });

  const datasetB = await Dataset.create({
    organizationId: orgBId,
    dataSourceId: dsB._id,
    name: 'foreign_customers',
    schemaName: 'public',
    status: 'ACTIVE'
  });

  let termId = null;

  await t.test('28.1 Glossary CRUD: Creates a business glossary term with definition, domain, tags', async () => {
    let resData;
    const res = {
      status(code) { this.statusCode = code; return this; },
      json(payload) { resData = payload; return this; }
    };

    const req = {
      organizationId: orgAId,
      user: { _id: adminAId },
      body: {
        name: 'Customer Lifetime Value',
        definition: 'Total monetary value expected from a customer throughout their relationship',
        domain: 'Revenue',
        tags: ['finance', 'marketing'],
        synonyms: ['LTV', 'CLV'],
        status: 'APPROVED'
      }
    };

    await glossaryController.createGlossaryTerm(req, res);
    assert.equal(res.statusCode, 201);
    assert.equal(resData.success, true);
    assert.equal(resData.data.name, 'Customer Lifetime Value');
    termId = resData.data._id;
  });

  await t.test('28.2 Duplicate Handling: Rejects duplicate term name within the same organization', async () => {
    let resData;
    const res = {
      status(code) { this.statusCode = code; return this; },
      json(payload) { resData = payload; return this; }
    };

    const req = {
      organizationId: orgAId,
      user: { _id: adminAId },
      body: {
        name: 'Customer Lifetime Value',
        definition: 'Another definition attempt for duplicate name'
      }
    };

    await glossaryController.createGlossaryTerm(req, res);
    assert.equal(res.statusCode, 409);
    assert.equal(resData.error.code, 'DUPLICATE_TERM');
  });

  await t.test('28.3 Dataset & Column Linking: Links term to dataset and specific column', async () => {
    let resData;
    const res = {
      status(code) { this.statusCode = code; return this; },
      json(payload) { resData = payload; return this; }
    };

    // 1. Link to dataset
    await glossaryController.linkDataset({
      params: { id: termId },
      organizationId: orgAId,
      user: { _id: adminAId },
      body: { datasetId: datasetA._id }
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(resData.data.linkedDatasets.length, 1);
    assert.equal(resData.data.linkedDatasets[0].column, null);

    // 2. Link to specific column
    await glossaryController.linkDataset({
      params: { id: termId },
      organizationId: orgAId,
      user: { _id: adminAId },
      body: { datasetId: datasetA._id, column: 'customer_id' }
    }, res);

    assert.equal(resData.data.linkedDatasets.length, 2);
    assert.equal(resData.data.linkedDatasets[1].column, 'customer_id');

    // 3. Unlink column
    await glossaryController.unlinkDataset({
      params: { id: termId },
      organizationId: orgAId,
      body: { datasetId: datasetA._id, column: 'customer_id' }
    }, res);

    assert.equal(resData.data.linkedDatasets.length, 1);
  });

  await t.test('28.4 Search & Filtering: Filters glossary terms by domain, search query, and tags', async () => {
    let resData;
    const res = {
      status(code) { this.statusCode = code; return this; },
      json(payload) { resData = payload; return this; }
    };

    // Search by query
    await glossaryController.getGlossaryTerms({
      organizationId: orgAId,
      query: { search: 'Lifetime' }
    }, res);
    assert.equal(resData.success, true);
    assert.equal(resData.data.length, 1);

    // Search by domain
    await glossaryController.getGlossaryTerms({
      organizationId: orgAId,
      query: { domain: 'Revenue' }
    }, res);
    assert.equal(resData.data.length, 1);

    // Search non-existent
    await glossaryController.getGlossaryTerms({
      organizationId: orgAId,
      query: { domain: 'NonExistentDomain' }
    }, res);
    assert.equal(resData.data.length, 0);
  });

  await t.test('28.5 Tenant Isolation: Org B cannot access Org A glossary terms or link Org A datasets', async () => {
    let resData;
    const res = {
      status(code) { this.statusCode = code; return this; },
      json(payload) { resData = payload; return this; }
    };

    // Org B attempts to fetch Org A term
    await glossaryController.getGlossaryTermById({
      params: { id: termId },
      organizationId: orgBId
    }, res);
    assert.equal(res.statusCode, 404);

    // Org A attempts to link Org B dataset
    await glossaryController.linkDataset({
      params: { id: termId },
      organizationId: orgAId,
      user: { _id: adminAId },
      body: { datasetId: datasetB._id }
    }, res);
    assert.equal(res.statusCode, 404);
    assert.match(resData.error.message, /inaccessible in this organization/i);
  });

  // Cleanup
  await GlossaryTerm.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await Dataset.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await DataSource.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await User.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await Organization.deleteMany({ _id: { $in: [orgAId, orgBId] } });

  await disconnectDB();
});
