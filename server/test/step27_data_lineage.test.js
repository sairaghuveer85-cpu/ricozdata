import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/database.js';
import { Dataset } from '../src/models/Dataset.js';
import { DataSource } from '../src/models/DataSource.js';
import { User } from '../src/models/User.js';
import { Organization } from '../src/models/Organization.js';
import { LineageEdge } from '../src/models/LineageEdge.js';
import { LineageService } from '../src/services/LineageService.js';
import * as lineageController from '../src/controllers/lineage.controller.js';

test('Step 27 — Data Lineage Verification', async (t) => {
  await connectDB();

  const orgAId = new mongoose.Types.ObjectId();
  const orgBId = new mongoose.Types.ObjectId();
  const adminAId = new mongoose.Types.ObjectId();

  await Organization.create({ _id: orgAId, name: 'Lineage Org A', slug: 'lin-org-a-' + Date.now() });
  await Organization.create({ _id: orgBId, name: 'Lineage Org B', slug: 'lin-org-b-' + Date.now() });

  await User.create({
    _id: adminAId,
    organizationId: orgAId,
    name: 'Lineage Admin',
    email: 'admin.lineage.' + Date.now() + '@alpha.com',
    role: 'admin',
    passwordHash: 'dummy_hash'
  });

  const dsA = await DataSource.create({
    organizationId: orgAId,
    name: 'Lineage Source A',
    type: 'postgresql',
    configuration: { host: 'localhost', database: 'analytics' },
    status: 'ACTIVE',
    createdBy: adminAId
  });

  const dsB = await DataSource.create({
    organizationId: orgBId,
    name: 'Lineage Source B',
    type: 'postgresql',
    configuration: { host: 'localhost', database: 'finance' },
    status: 'ACTIVE',
    createdBy: adminAId
  });

  // Create chain of datasets: Raw Source -> Staging -> Mart -> Dashboard Aggregate
  const rawDataset = await Dataset.create({
    organizationId: orgAId,
    dataSourceId: dsA._id,
    name: 'raw_events',
    schemaName: 'raw',
    columns: [{ name: 'event_id', dataType: 'integer' }, { name: 'user_id', dataType: 'integer' }],
    status: 'ACTIVE'
  });

  const stagingDataset = await Dataset.create({
    organizationId: orgAId,
    dataSourceId: dsA._id,
    name: 'stg_events',
    schemaName: 'staging',
    columns: [{ name: 'event_id', dataType: 'integer' }, { name: 'user_id', dataType: 'integer' }],
    status: 'ACTIVE'
  });

  const martDataset = await Dataset.create({
    organizationId: orgAId,
    dataSourceId: dsA._id,
    name: 'dim_users_events',
    schemaName: 'marts',
    columns: [{ name: 'user_id', dataType: 'integer' }, { name: 'total_events', dataType: 'bigint' }],
    status: 'ACTIVE'
  });

  // Org B dataset for tenant isolation test
  const foreignDataset = await Dataset.create({
    organizationId: orgBId,
    dataSourceId: dsB._id,
    name: 'foreign_table',
    schemaName: 'public',
    status: 'ACTIVE'
  });

  let edge1 = null;
  let edge2 = null;
  let columnEdge = null;

  await t.test('27.1 Lineage Creation: Creates dataset-level and column-level edges with relationship types', async () => {
    // Edge 1: raw -> stg
    edge1 = await LineageService.createEdge(
      {
        upstreamDatasetId: rawDataset._id,
        downstreamDatasetId: stagingDataset._id,
        relationshipType: 'DIRECT_COPY',
        confidence: 1.0
      },
      orgAId,
      adminAId
    );
    assert.ok(edge1._id);
    assert.equal(edge1.relationshipType, 'DIRECT_COPY');

    // Edge 2: stg -> mart
    edge2 = await LineageService.createEdge(
      {
        upstreamDatasetId: stagingDataset._id,
        downstreamDatasetId: martDataset._id,
        relationshipType: 'AGGREGATED',
        transformationId: 'dbt_model_marts_events'
      },
      orgAId,
      adminAId
    );
    assert.ok(edge2._id);
    assert.equal(edge2.relationshipType, 'AGGREGATED');

    // Column-level edge: stg.user_id -> mart.user_id
    columnEdge = await LineageService.createEdge(
      {
        upstreamDatasetId: stagingDataset._id,
        downstreamDatasetId: martDataset._id,
        upstreamColumn: 'user_id',
        downstreamColumn: 'user_id',
        relationshipType: 'JOINED'
      },
      orgAId,
      adminAId
    );
    assert.ok(columnEdge._id);
    assert.equal(columnEdge.upstreamColumn, 'user_id');
    assert.equal(columnEdge.downstreamColumn, 'user_id');
  });

  await t.test('27.2 Upstream Traversal: Discovers all ancestor datasets from mart back to raw', async () => {
    const upstream = await LineageService.getUpstream(martDataset._id, orgAId, { maxDepth: 5 });
    assert.equal(upstream.direction, 'UPSTREAM');
    assert.ok(upstream.nodes.length >= 3, 'Must discover mart, staging, and raw nodes');
    const nodeNames = upstream.nodes.map(n => n.name);
    assert.ok(nodeNames.includes('dim_users_events'));
    assert.ok(nodeNames.includes('stg_events'));
    assert.ok(nodeNames.includes('raw_events'));
  });

  await t.test('27.3 Downstream Traversal: Discovers all child datasets from raw down to mart', async () => {
    const downstream = await LineageService.getDownstream(rawDataset._id, orgAId, { maxDepth: 5 });
    assert.equal(downstream.direction, 'DOWNSTREAM');
    assert.ok(downstream.nodes.length >= 3);
    const nodeNames = downstream.nodes.map(n => n.name);
    assert.ok(nodeNames.includes('raw_events'));
    assert.ok(nodeNames.includes('stg_events'));
    assert.ok(nodeNames.includes('dim_users_events'));
  });

  await t.test('27.4 Dataset Full Lineage: Returns combined bidirectional nodes and edges', async () => {
    const fullGraph = await LineageService.getDatasetLineage(stagingDataset._id, orgAId);
    assert.ok(fullGraph.nodes.length >= 3);
    assert.ok(fullGraph.edges.length >= 3);
  });

  await t.test('27.5 Cycle Handling & Depth Limits: Traversal safely terminates on circular dependency without infinite loop', async () => {
    // Artificially create a cycle: mart -> raw
    const cycleEdge = await LineageEdge.create({
      organizationId: orgAId,
      upstreamDatasetId: martDataset._id,
      downstreamDatasetId: rawDataset._id,
      relationshipType: 'DERIVED'
    });

    // Traverse upstream from mart with cycle: must terminate cleanly within maxDepth
    const result = await LineageService.getUpstream(martDataset._id, orgAId, { maxDepth: 3 });
    assert.ok(result);
    assert.ok(result.nodes.length > 0);

    // Remove cycle edge
    await LineageEdge.findByIdAndDelete(cycleEdge._id);
  });

  await t.test('27.6 Tenant Isolation: Strictly prevents creating lineage across organizations', async () => {
    // Attempt to link Org A rawDataset to Org B foreignDataset
    await assert.rejects(
      () => LineageService.createEdge(
        {
          upstreamDatasetId: rawDataset._id,
          downstreamDatasetId: foreignDataset._id,
          relationshipType: 'DERIVED'
        },
        orgAId,
        adminAId
      ),
      /Downstream dataset not found or inaccessible in this organization/i
    );

    // Attempt from Org B
    await assert.rejects(
      () => LineageService.createEdge(
        {
          upstreamDatasetId: rawDataset._id,
          downstreamDatasetId: foreignDataset._id,
          relationshipType: 'DERIVED'
        },
        orgBId,
        adminAId
      ),
      /Upstream dataset not found or inaccessible in this organization/i
    );
  });

  await t.test('27.7 Self-Referencing Prevention: Rejects dataset linking to itself without columns', async () => {
    await assert.rejects(
      () => LineageService.createEdge(
        {
          upstreamDatasetId: rawDataset._id,
          downstreamDatasetId: rawDataset._id,
          relationshipType: 'DERIVED'
        },
        orgAId,
        adminAId
      ),
      /Dataset-level self-referential lineage is not permitted/i
    );
  });

  // Cleanup
  await LineageEdge.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await Dataset.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await DataSource.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await User.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await Organization.deleteMany({ _id: { $in: [orgAId, orgBId] } });

  await disconnectDB();
});
