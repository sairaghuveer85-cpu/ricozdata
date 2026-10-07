import assert from 'node:assert/strict';
import http from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDB, disconnectDB } from '../src/config/database.js';
import { User } from '../src/models/User.js';
import { Organization } from '../src/models/Organization.js';
import { Dataset } from '../src/models/Dataset.js';
import { QualityRule } from '../src/models/QualityRule.js';
import tokenService from '../src/services/token.service.js';

dotenv.config();

const BASE_URL = 'http://localhost:5000';

function apiCall(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const headers = options.headers || {};
    let body = options.body;
    if (body && typeof body === 'object') {
      body = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
    }
    const req = http.request(url, {
      method: options.method || 'GET',
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function testQualityExecution() {
  console.log('Testing Real Quality Engine Execution against PostgreSQL...\n');
  await connectDB();

  try {
    const org = await Organization.findOne({ slug: 'ricoz-demo' });
    const user = await User.findOne({ email: 'test@example.com' });
    assert.ok(org, 'Org must exist');
    assert.ok(user, 'User must exist');

    const token = tokenService.generateAccessToken({
      _id: user._id,
      organizationId: org._id,
      role: user.role
    });
    const headers = { Authorization: `Bearer ${token}` };

    // Find customers dataset
    const dataset = await Dataset.findOne({ organizationId: org._id, name: 'customers', isDeleted: { $ne: true } });
    if (!dataset) {
      console.log('customers dataset not found in ricoz-demo, checking all datasets...');
      const all = await Dataset.find({ organizationId: org._id });
      console.log('Existing datasets in ricoz-demo:', all.map(d => ({ id: d._id, name: d.name, source: d.dataSourceId })));
      return;
    }

    console.log(`Found dataset: ${dataset.name} (_id: ${dataset._id})`);

    // Delete any invalid previous rules
    await QualityRule.deleteMany({ datasetId: dataset._id, organizationId: org._id });

    console.log('Creating quality rule NULL_CHECK on targetColumn "name"...');
    const createRuleRes = await apiCall(`/api/v1/quality/datasets/${dataset._id}/rules`, {
      method: 'POST',
      headers,
      body: {
        name: 'Customer Name Not Null Check',
        targetColumn: 'name',
        ruleType: 'NULL_CHECK',
        dimension: 'COMPLETENESS',
        severity: 'HIGH',
        configuration: { threshold: 0.95 }
      }
    });
    assert.strictEqual(createRuleRes.status, 201, `Failed to create rule: ${JSON.stringify(createRuleRes.body)}`);
    const rule = createRuleRes.body.data;
    console.log(`Rule created successfully with targetColumn: ${rule.targetColumn}`);

    // Trigger quality execution
    console.log(`Triggering quality run for dataset ${dataset._id}...`);
    const runRes = await apiCall(`/api/v1/quality/datasets/${dataset._id}/run`, {
      method: 'POST',
      headers
    });
    console.log(`Quality run response status: ${runRes.status}`);
    console.log(`Quality run response body:`, JSON.stringify(runRes.body, null, 2));

    // Verify quality summary
    const summaryRes = await apiCall(`/api/v1/quality/datasets/${dataset._id}`, { headers });
    console.log(`Updated quality summary score:`, summaryRes.body.data?.overallScore);

  } finally {
    await disconnectDB();
  }
}

testQualityExecution().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
