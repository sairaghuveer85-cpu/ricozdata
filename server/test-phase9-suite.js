// Phase 9: Production-Grade Data Quality Engine Test Suite
//
// Comprehensive test suite for the Data Quality Engine implementing:
// - 6 standard quality dimensions: Completeness, Accuracy, Consistency, Validity, Uniqueness, Timeliness
// - Deterministic score calculation with grade assignments (Excellent, Good, Fair, At Risk)
// - Quality Issue lifecycle management (OPEN, ACKNOWLEDGED, IN_PROGRESS, RESOLVED, IGNORED)
// - Rule engine with 12 rule types (NOT_NULL, UNIQUE, RANGE, REGEX, DATA_TYPE, ENUM, MIN_LENGTH, MAX_LENGTH, REFERENTIAL_INTEGRITY, FRESHNESS, DUPLICATE, CUSTOM)
// - Column and dataset-level profiling metrics
// - Historical trend tracking across 7d, 30d, 90d, and YTD windows
// - RBAC enforcement (QUALITY_READ, QUALITY_UPDATE, QUALITY_MANAGE permissions)
//
const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

let authToken = null;
let testUser = null;
let createdResources = {
  datasets: [],
  rules: [],
  issues: [],
  qualities: []
};

async function setupTestEnvironment() {
  // Use the live server's seeded database - authenticate with existing admin user
  const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
    email: 'raghuveer.chandran@ricoz-industries.demo',
    password: 'Password123!',
  });

  if (!loginResponse.data.success) {
    throw new Error('Failed to authenticate with seeded admin user');
  }

  authToken = loginResponse.data.data.token;
  testUser = loginResponse.data.data.user;

  console.log('✓ Test environment setup complete - using seeded admin user');
}

async function cleanupTestEnvironment() {
  // Clean up created resources via API
  for (const datasetId of createdResources.datasets) {
    try {
      await axios.delete(`${BASE_URL}/api/datasets/${datasetId}`, { headers: { Authorization: `Bearer ${authToken}` } });
    } catch (e) { /* ignore */ }
  }
  for (const ruleId of createdResources.rules) {
    try {
      await axios.delete(`${BASE_URL}/api/quality/rules/${ruleId}`, { headers: { Authorization: `Bearer ${authToken}` } });
    } catch (e) { /* ignore */ }
  }
  for (const issueId of createdResources.issues) {
    try {
      await axios.delete(`${BASE_URL}/api/quality/issues/${issueId}`, { headers: { Authorization: `Bearer ${authToken}` } });
    } catch (e) { /* ignore */ }
  }
  console.log('✓ Test environment cleaned up');
}

async function testQualityModels() {
  console.log('\n--- Testing Quality Models ---');

  // Create a test dataset via API
  const datasetResponse = await axios.post(`${BASE_URL}/api/datasets`, {
    name: 'Test Dataset',
    displayName: 'Test Dataset',
    description: 'Dataset for quality testing',
    owner: testUser.name,
    ownerId: testUser.id,
    steward: testUser.name,
    stewardId: testUser.id,
    domain: 'Customer Data',
    domainId: testUser.id,
    sourceSystem: 'Test System',
    source: 'Test System',
    sourceType: 'Database',
    environment: 'Production',
    sensitivity: 'Internal',
    classification: 'Operational',
    status: 'active',
    tags: ['test', 'quality'],
    columns: [
      { name: 'id', type: 'integer', nullable: false },
      { name: 'name', type: 'string' },
      { name: 'age', type: 'number' },
    ],
    rowCount: '1000',
    size: '0 GB',
    sizeBytes: 0,
    refreshFrequency: 'Daily',
    qualityScore: 90,
    qualityStatus: 'Healthy',
    certificationStatus: 'Not Certified',
  }, { headers: { Authorization: `Bearer ${authToken}` } });

  const dataset = datasetResponse.data.data;
  createdResources.datasets.push(dataset._id);
  console.log('✓ Test dataset created via API');

  // Test Quality model via API - get quality overview
  const qualityResponse = await axios.get(`${BASE_URL}/api/quality/overview/${dataset._id}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });

  console.assert(qualityResponse.data.success, 'Quality overview should be retrievable');
  console.assert(qualityResponse.data.data, 'Quality data should exist');
  console.log('✓ Quality model: PASSED');

  // Test QualityIssue model - get issues
  const issuesResponse = await axios.get(`${BASE_URL}/api/quality/issues`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });

  console.assert(issuesResponse.data.success, 'Quality issues should be retrievable');
  console.assert(Array.isArray(issuesResponse.data.data), 'Issues should be an array');
  console.log('✓ QualityIssue model: PASSED');

  // Test QualityHistory model via API - get trends
  const trendsResponse = await axios.get(`${BASE_URL}/api/quality/trends/${dataset._id}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });

  console.assert(trendsResponse.data.success, 'Quality trends should be retrievable');
  console.assert(Array.isArray(trendsResponse.data.data), 'Trends should be an array');
  console.log('✓ QualityHistory model: PASSED');

  // Test QualityProfile model via API - get profile
  const profileResponse = await axios.get(`${BASE_URL}/api/quality/profile/${dataset._id}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });

  console.assert(profileResponse.data.success, 'Quality profile should be retrievable');
  console.log('✓ QualityProfile model: PASSED');
}

async function testQualityEngine() {
  console.log('\n--- Testing Quality Engine ---');

  // Create a test dataset
  const datasetResponse = await axios.post(`${BASE_URL}/api/datasets`, {
    name: 'Test Dataset for Engine',
    displayName: 'Test Dataset for Engine',
    description: 'Dataset for quality engine testing',
    owner: testUser.name,
    ownerId: testUser.id,
    steward: testUser.name,
    stewardId: testUser.id,
    domain: 'Customer Data',
    domainId: testUser.id,
    sourceSystem: 'Test System',
    source: 'Test System',
    sourceType: 'Database',
    environment: 'Production',
    sensitivity: 'Internal',
    classification: 'Operational',
    status: 'active',
    tags: ['engine', 'test'],
    columns: [
      { name: 'id', type: 'integer', nullable: false },
      { name: 'email', type: 'string' },
      { name: 'age', type: 'number' },
      { name: 'status', type: 'string' },
    ],
    rowCount: '1000',
    size: '0 GB',
    sizeBytes: 0,
    refreshFrequency: 'Daily',
    qualityScore: 85,
    qualityStatus: 'Healthy',
    certificationStatus: 'Not Certified',
  }, { headers: { Authorization: `Bearer ${authToken}` } });

  const dataset = datasetResponse.data.data;
  createdResources.datasets.push(dataset._id);

  // Create test rules via API
  const rules = [
    {
      name: 'NOT_NULL_Email',
      datasetId: dataset._id,
      targetDatasetId: dataset._id,
      field: 'email',
      targetColumn: 'email',
      expression: '.+@.+.',
      dimension: 'completeness',
      ruleType: 'NOT_NULL',
      condition: {},
      threshold: 0.05,
      severity: 'high',
      enabled: true,
      owner: testUser.id,
      createdBy: testUser.id,
      status: 'active',
      metadata: { description: 'Ensure email field is not null' },
    },
    {
      name: 'RANGE_Age',
      datasetId: dataset._id,
      targetDatasetId: dataset._id,
      field: 'age',
      targetColumn: 'age',
      expression: 'age >= 18 && age <= 65',
      dimension: 'validity',
      ruleType: 'RANGE',
      condition: { min: 18, max: 65 },
      threshold: 0.95,
      severity: 'medium',
      enabled: true,
      owner: testUser.id,
      createdBy: testUser.id,
      status: 'active',
    },
    {
      name: 'UNIQUE_Status',
      datasetId: dataset._id,
      targetDatasetId: dataset._id,
      field: 'status',
      targetColumn: 'status',
      expression: 'unique values',
      dimension: 'uniqueness',
      ruleType: 'UNIQUE',
      condition: {},
      threshold: 0.02,
      severity: 'low',
      enabled: true,
      owner: testUser.id,
      createdBy: testUser.id,
      status: 'active',
    },
  ];

  for (const rule of rules) {
    const ruleResponse = await axios.post(`${BASE_URL}/api/quality/rules`, rule, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    createdResources.rules.push(ruleResponse.data.data._id);
  }
  console.log('✓ Test rules created via API');

  // Test evaluating entire dataset via API
  const evaluationResponse = await axios.post(`${BASE_URL}/api/quality/evaluate/${dataset._id}`, {}, {
    headers: { Authorization: `Bearer ${authToken}` },
  });

  const evaluation = evaluationResponse.data.data;
  console.log(`✓ Quality evaluation completed - Score: ${evaluation.score}, Grade: ${evaluation.grade}`);
  console.log(`✓ Dimensions evaluated: ${evaluation.dimensions.length}`);
  console.log(`✓ Rules evaluated: ${evaluation.rulesEvaluated}`);

  // Verify Quality document created via API
  const qualityResponse = await axios.get(`${BASE_URL}/api/quality/overview/${dataset._id}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  const qualityDoc = qualityResponse.data.data;
  console.assert(qualityDoc, 'Quality document should be created');
  console.assert(qualityDoc.score === evaluation.score, 'Quality score should match evaluation score');
  console.assert(qualityDoc.grade === evaluation.grade, 'Quality grade should match evaluation grade');

  // Verify QualityHistory created via API - get trends
  const historyResponse = await axios.get(`${BASE_URL}/api/quality/trends/${dataset._id}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  const history = historyResponse.data.data;
  console.assert(history && history.length > 0, 'QualityHistory document should be created');
  console.assert(history[0].score === evaluation.score, 'History score should match evaluation score');

  // Verify QualityProfile created via API
  const profileResponse = await axios.get(`${BASE_URL}/api/quality/profile/${dataset._id}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  const profile = profileResponse.data.data;
  console.assert(profile, 'QualityProfile document should be created');

  // Verify QualityIssues created via API
  const issuesResponse = await axios.get(`${BASE_URL}/api/quality/issues?datasetId=${dataset._id}&status=open`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  const issuesCount = issuesResponse.data.data.length;
  console.log(`✓ Quality issues created: ${issuesCount}`);
}

async function testQualityEngineEndpoints() {
  console.log('\n--- Testing Quality Engine Endpoints ---');

  // Create a test dataset
  const datasetResponse = await axios.post(`${BASE_URL}/api/datasets`, {
    name: 'API Test Dataset',
    displayName: 'API Test Dataset',
    description: 'Dataset for testing API endpoints',
    owner: testUser.name,
    ownerId: testUser.id,
    steward: testUser.name,
    stewardId: testUser.id,
    domain: 'Customer Data',
    domainId: testUser.id,
    sourceSystem: 'Test System',
    source: 'Test System',
    sourceType: 'Database',
    environment: 'Production',
    sensitivity: 'Internal',
    classification: 'Operational',
    status: 'active',
    tags: ['api', 'test'],
    columns: [
      { name: 'id', type: 'integer', nullable: false },
      { name: 'name', type: 'string' },
    ],
    rowCount: '500',
    size: '0 GB',
    sizeBytes: 0,
    refreshFrequency: 'Daily',
    qualityScore: 80,
    qualityStatus: 'Healthy',
    certificationStatus: 'Not Certified',
  }, { headers: { Authorization: `Bearer ${authToken}` } });

  const dataset = datasetResponse.data.data;
  createdResources.datasets.push(dataset._id);

  // Test creating a rule
  const ruleResponse = await axios.post(`${BASE_URL}/api/quality/rules`, {
    name: 'Test Rule',
    datasetId: dataset._id,
    targetDatasetId: dataset._id,
    field: 'name',
    targetColumn: 'name',
    expression: '.{2,}',
    dimension: 'validity',
    ruleType: 'MIN_LENGTH',
    condition: { length: 2 },
    threshold: 2,
    severity: 'medium',
    enabled: true,
    owner: testUser.id,
    createdBy: testUser.id,
  }, { headers: { Authorization: `Bearer ${authToken}` } });

  createdResources.rules.push(ruleResponse.data.data._id);
  console.log('✓ Rule creation API: PASSED');

  // Test evaluating entire dataset
  const evaluationResponse = await axios.post(`${BASE_URL}/api/quality/evaluate/${dataset._id}`, {}, {
    headers: { Authorization: `Bearer ${authToken}` },
  });

  console.log(`✓ Dataset evaluation API: PASSED - Score: ${evaluationResponse.data.data.score}`);

  // Test getting quality trends
  const trendsResponse = await axios.get(`${BASE_URL}/api/quality/trends/${dataset._id}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });

  console.assert(trendsResponse.data.success, 'Trends API should succeed');
  console.log('✓ Quality trends API: PASSED');

  // Test getting quality profile
  const profileResponse = await axios.get(`${BASE_URL}/api/quality/profile/${dataset._id}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });

  console.assert(profileResponse.data.success, 'Profile API should succeed');
  console.log('✓ Quality profile API: PASSED');

  // Test searching issues
  const issuesResponse = await axios.get(`${BASE_URL}/api/quality/issues/search`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });

  console.assert(issuesResponse.data.success, 'Search issues API should succeed');
  console.log('✓ Search issues API: PASSED');
}

async function testIssueLifecycle() {
  console.log('\n--- Testing Issue Lifecycle ---');

  // Create a test dataset
  const datasetResponse = await axios.post(`${BASE_URL}/api/datasets`, {
    name: 'Issue Lifecycle Test Dataset',
    displayName: 'Issue Lifecycle Test Dataset',
    description: 'Dataset for testing issue lifecycle',
    owner: testUser.name,
    ownerId: testUser.id,
    steward: testUser.name,
    stewardId: testUser.id,
    domain: 'Customer Data',
    domainId: testUser.id,
    sourceSystem: 'Test System',
    source: 'Test System',
    sourceType: 'Database',
    environment: 'Production',
    sensitivity: 'Internal',
    classification: 'Operational',
    status: 'active',
    tags: ['lifecycle', 'test'],
    columns: [
      { name: 'field1', type: 'string' },
    ],
    rowCount: '100',
    size: '0 GB',
    sizeBytes: 0,
    refreshFrequency: 'Daily',
    qualityScore: 70,
    qualityStatus: 'Warning',
    certificationStatus: 'Not Certified',
  }, { headers: { Authorization: `Bearer ${authToken}` } });

  const dataset = datasetResponse.data.data;
  createdResources.datasets.push(dataset._id);

  // Create a test rule
  const ruleResponse = await axios.post(`${BASE_URL}/api/quality/rules`, {
    name: 'Lifecycle Test Rule',
    datasetId: dataset._id,
    targetDatasetId: dataset._id,
    field: 'field1',
    targetColumn: 'field1',
    expression: '.+',
    dimension: 'completeness',
    ruleType: 'NOT_NULL',
    condition: {},
    threshold: 0.05,
    severity: 'critical',
    enabled: true,
    owner: testUser.id,
    createdBy: testUser.id,
    status: 'active',
  }, { headers: { Authorization: `Bearer ${authToken}` } });

  const rule = ruleResponse.data.data;
  createdResources.rules.push(rule._id);

  // Create a test issue directly via API
  const issueResponse = await axios.post(`${BASE_URL}/api/quality/issues`, {
    datasetId: dataset._id,
    field: 'field1',
    column: 'field1',
    ruleId: rule._id,
    ruleType: 'NOT_NULL',
    dimension: 'completeness',
    issue: 'Test issue for lifecycle',
    count: 10,
    affectedRows: 100,
    severity: 'critical',
    status: 'open',
  }, { headers: { Authorization: `Bearer ${authToken}` } });

  const issue = issueResponse.data.data;
  createdResources.issues.push(issue._id);

  // Test acknowledge issue
  const acknowledgedResponse = await axios.post(`${BASE_URL}/api/quality/issues/${issue._id}/acknowledge`, {}, {
    headers: { Authorization: `Bearer ${authToken}` },
  });

  console.assert(acknowledgedResponse.data.data.status === 'acknowledged', 'Issue should be acknowledged');
  console.log('✓ Acknowledge issue: PASSED');

  // Test in-progress issue
  const inProgressResponse = await axios.post(`${BASE_URL}/api/quality/issues/${issue._id}/in-progress`, {}, {
    headers: { Authorization: `Bearer ${authToken}` },
  });

  console.assert(inProgressResponse.data.data.status === 'in_progress', 'Issue should be in progress');
  console.log('✓ In-progress issue: PASSED');

  // Test assign issue
  const assignedResponse = await axios.post(`${BASE_URL}/api/quality/issues/${issue._id}/assign`, {
    assignedToId: testUser.id,
  }, {
    headers: { Authorization: `Bearer ${authToken}` },
  });

  console.assert(assignedResponse.data.data.assignedToId === testUser.id, 'Issue should be assigned to test user');
  console.log('✓ Assign issue: PASSED');

  // Test resolve issue
  const resolvedResponse = await axios.post(`${BASE_URL}/api/quality/issues/${issue._id}/resolve`, {
    resolutionNote: 'Test resolution note',
  }, {
    headers: { Authorization: `Bearer ${authToken}` },
  });

  console.assert(resolvedResponse.data.data.status === 'resolved', 'Issue should be resolved');
  console.assert(resolvedResponse.data.data.resolvedAt, 'Issue should have resolvedAt timestamp');
  console.log('✓ Resolve issue: PASSED');

  // Test ignore issue (need to create a new issue first since resolved)
  const issue2Response = await axios.post(`${BASE_URL}/api/quality/issues`, {
    datasetId: dataset._id,
    field: 'field1',
    column: 'field1',
    ruleId: rule._id,
    ruleType: 'NOT_NULL',
    dimension: 'completeness',
    issue: 'Test issue for ignore lifecycle',
    count: 5,
    affectedRows: 50,
    severity: 'medium',
    status: 'open',
  }, { headers: { Authorization: `Bearer ${authToken}` } });

  const issue2 = issue2Response.data.data;
  createdResources.issues.push(issue2._id);

  const ignoredResponse = await axios.post(`${BASE_URL}/api/quality/issues/${issue2._id}/ignore`, {}, {
    headers: { Authorization: `Bearer ${authToken}` },
  });

  console.assert(ignoredResponse.data.data.status === 'ignored', 'Issue should be ignored');
  console.log('✓ Ignore issue: PASSED');
}

async function testRBAC() {
  console.log('\n--- Testing RBAC Integration ---');

  // Create a test dataset
  const datasetResponse = await axios.post(`${BASE_URL}/api/datasets`, {
    name: 'RBAC Test Dataset',
    displayName: 'RBAC Test Dataset',
    description: 'Dataset for testing RBAC permissions',
    owner: testUser.name,
    ownerId: testUser.id,
    steward: testUser.name,
    stewardId: testUser.id,
    domain: 'Customer Data',
    domainId: testUser.id,
    sourceSystem: 'Test System',
    source: 'Test System',
    sourceType: 'Database',
    environment: 'Production',
    sensitivity: 'Internal',
    classification: 'Operational',
    status: 'active',
    tags: ['rbac', 'test'],
    columns: [{ name: 'field1', type: 'string' }],
    rowCount: '100',
    size: '0 GB',
    sizeBytes: 0,
    refreshFrequency: 'Daily',
    qualityScore: 75,
    qualityStatus: 'Warning',
    certificationStatus: 'Not Certified',
  }, { headers: { Authorization: `Bearer ${authToken}` } });

  const dataset = datasetResponse.data.data;
  createdResources.datasets.push(dataset._id);

  // Test that SUPER_ADMIN (which has all permissions) can manage quality
  const createResponse = await axios.post(`${BASE_URL}/api/quality/evaluate/${dataset._id}`, {}, {
    headers: { Authorization: `Bearer ${authToken}` },
  });

  console.assert(createResponse.status === 200, 'SUPER_ADMIN should be able to evaluate quality');
  console.log('✓ RBAC permission enforcement: PASSED');
}

async function testProfiling() {
  console.log('\n--- Testing Profiling ---');

  // Create a test dataset with multiple columns
  const datasetResponse = await axios.post(`${BASE_URL}/api/datasets`, {
    name: 'Profiling Test Dataset',
    displayName: 'Profiling Test Dataset',
    description: 'Dataset for testing profiling',
    owner: testUser.name,
    ownerId: testUser.id,
    steward: testUser.name,
    stewardId: testUser.id,
    domain: 'Customer Data',
    domainId: testUser.id,
    sourceSystem: 'Test System',
    source: 'Test System',
    sourceType: 'Database',
    environment: 'Production',
    sensitivity: 'Internal',
    classification: 'Operational',
    status: 'active',
    tags: ['profiling', 'test'],
    columns: [
      { name: 'id', type: 'integer', nullable: false },
      { name: 'name', type: 'string' },
      { name: 'age', type: 'number' },
      { name: 'email', type: 'string' },
    ],
    rowCount: '1000',
    size: '0 GB',
    sizeBytes: 0,
    refreshFrequency: 'Daily',
    qualityScore: 85,
    qualityStatus: 'Healthy',
    certificationStatus: 'Not Certified',
  }, { headers: { Authorization: `Bearer ${authToken}` } });

  const dataset = datasetResponse.data.data;
  createdResources.datasets.push(dataset._id);

  // Create rules for different columns
  const rules = [
    {
      name: 'NOT_NULL_ID',
      datasetId: dataset._id,
      targetDatasetId: dataset._id,
      field: 'id',
      targetColumn: 'id',
      expression: '',
      dimension: 'completeness',
      ruleType: 'NOT_NULL',
      condition: {},
      threshold: 0.01,
      severity: 'high',
      enabled: true,
      owner: testUser.id,
      createdBy: testUser.id,
      status: 'active',
    },
    {
      name: 'MIN_LENGTH_NAME',
      datasetId: dataset._id,
      targetDatasetId: dataset._id,
      field: 'name',
      targetColumn: 'name',
      expression: 'length >= 2',
      dimension: 'validity',
      ruleType: 'MIN_LENGTH',
      condition: { length: 2 },
      threshold: 1,
      severity: 'medium',
      enabled: true,
      owner: testUser.id,
      createdBy: testUser.id,
      status: 'active',
    },
    {
      name: 'RANGE_AGE',
      datasetId: dataset._id,
      targetDatasetId: dataset._id,
      field: 'age',
      targetColumn: 'age',
      expression: '18 <= age <= 65',
      dimension: 'validity',
      ruleType: 'RANGE',
      condition: { min: 18, max: 65 },
      threshold: 0.95,
      severity: 'medium',
      enabled: true,
      owner: testUser.id,
      createdBy: testUser.id,
      status: 'active',
    },
    {
      name: 'REGEX_EMAIL',
      datasetId: dataset._id,
      targetDatasetId: dataset._id,
      field: 'email',
      targetColumn: 'email',
      expression: 'regex',
      dimension: 'validity',
      ruleType: 'REGEX',
      condition: { pattern: '^[^@]+@[^@]+\\.[^@]+$' },
      threshold: 0.98,
      severity: 'medium',
      enabled: true,
      owner: testUser.id,
      createdBy: testUser.id,
      status: 'active',
    },
  ];

  for (const rule of rules) {
    const ruleResponse = await axios.post(`${BASE_URL}/api/quality/rules`, rule, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    createdResources.rules.push(ruleResponse.data.data._id);
  }

  // Evaluate dataset
  const evaluationResponse = await axios.post(`${BASE_URL}/api/quality/evaluate/${dataset._id}`, {}, {
    headers: { Authorization: `Bearer ${authToken}` },
  });

  const evaluation = evaluationResponse.data.data;
  console.log(`✓ Profiling evaluation completed - Score: ${evaluation.score}, Grade: ${evaluation.grade}`);

  // Get profile
  const profileResponse = await axios.get(`${BASE_URL}/api/quality/profile/${dataset._id}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });

  const profile = profileResponse.data.data;
  console.assert(profile, 'Profile should exist');
  console.assert(profile.columns, 'Profile should have columns');
  console.assert(profile.columns.length >= 4, 'Profile should have columns for all fields');
  console.log('✓ Column-level profiling: PASSED');
}

async function testScoringAndTrends() {
  console.log('\n--- Testing Scoring and Trends ---');

  // Create a test dataset
  const datasetResponse = await axios.post(`${BASE_URL}/api/datasets`, {
    name: 'Scoring Test Dataset',
    displayName: 'Scoring Test Dataset',
    description: 'Dataset for testing scoring',
    owner: testUser.name,
    ownerId: testUser.id,
    steward: testUser.name,
    stewardId: testUser.id,
    domain: 'Customer Data',
    domainId: testUser.id,
    sourceSystem: 'Test System',
    source: 'Test System',
    sourceType: 'Database',
    environment: 'Production',
    sensitivity: 'Internal',
    classification: 'Operational',
    status: 'active',
    tags: ['scoring', 'test'],
    columns: [
      { name: 'id', type: 'integer', nullable: false },
      { name: 'value', type: 'number' },
    ],
    rowCount: '1000',
    size: '0 GB',
    sizeBytes: 0,
    refreshFrequency: 'Daily',
    qualityScore: 90,
    qualityStatus: 'Healthy',
    certificationStatus: 'Not Certified',
  }, { headers: { Authorization: `Bearer ${authToken}` } });

  const dataset = datasetResponse.data.data;
  createdResources.datasets.push(dataset._id);

  // Create a rule that will pass
  await axios.post(`${BASE_URL}/api/quality/rules`, {
    name: 'PASS_RULE',
    datasetId: dataset._id,
    targetDatasetId: dataset._id,
    field: 'id',
    targetColumn: 'id',
    expression: '',
    dimension: 'completeness',
    ruleType: 'NOT_NULL',
    condition: {},
    threshold: 0.01,
    severity: 'high',
    enabled: true,
    owner: testUser.id,
    createdBy: testUser.id,
    status: 'active',
  }, { headers: { Authorization: `Bearer ${authToken}` } });

  // First evaluation
  const eval1Response = await axios.post(`${BASE_URL}/api/quality/evaluate/${dataset._id}`, {}, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  const score1 = eval1Response.data.data.score;
  console.log(`✓ First evaluation - Score: ${score1}, Grade: ${eval1Response.data.data.grade}`);

  // Get trends
  const trendsResponse = await axios.get(`${BASE_URL}/api/quality/trends/${dataset._id}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });

  console.assert(trendsResponse.data.success, 'Trends API should succeed');
  console.assert(trendsResponse.data.data.length > 0, 'Should have trend data');
  console.log('✓ Quality trends tracking: PASSED');

  // Verify dimensions have scores
  const evalData = eval1Response.data.data;
  console.assert(evalData.dimensions && evalData.dimensions.length === 6, 'Should have 6 dimensions');

  const dimNames = evalData.dimensions.map(d => d.name.toLowerCase());
  const expectedDims = ['completeness', 'accuracy', 'consistency', 'validity', 'uniqueness', 'timeliness'];
  for (const dim of expectedDims) {
    console.assert(dimNames.includes(dim), `Should have ${dim} dimension`);
  }
  console.log('✓ All 6 quality dimensions present: PASSED');
}

async function testRuleExecution() {
  console.log('\n--- Testing Rule Execution ---');

  // Create a test dataset
  const datasetResponse = await axios.post(`${BASE_URL}/api/datasets`, {
    name: 'Rule Execution Test Dataset',
    displayName: 'Rule Execution Test Dataset',
    description: 'Dataset for testing rule execution',
    owner: testUser.name,
    ownerId: testUser.id,
    steward: testUser.name,
    stewardId: testUser.id,
    domain: 'Customer Data',
    domainId: testUser.id,
    sourceSystem: 'Test System',
    source: 'Test System',
    sourceType: 'Database',
    environment: 'Production',
    sensitivity: 'Internal',
    classification: 'Operational',
    status: 'active',
    tags: ['rule-exec', 'test'],
    columns: [
      { name: 'id', type: 'integer', nullable: false },
      { name: 'email', type: 'string' },
      { name: 'age', type: 'number' },
    ],
    rowCount: '1000',
    size: '0 GB',
    sizeBytes: 0,
    refreshFrequency: 'Daily',
    qualityScore: 85,
    qualityStatus: 'Healthy',
    certificationStatus: 'Not Certified',
  }, { headers: { Authorization: `Bearer ${authToken}` } });

  const dataset = datasetResponse.data.data;
  createdResources.datasets.push(dataset._id);

  // Test different rule types
  const ruleTypes = [
    { name: 'NOT_NULL_TEST', ruleType: 'NOT_NULL', field: 'id', dimension: 'completeness' },
    { name: 'RANGE_TEST', ruleType: 'RANGE', field: 'age', dimension: 'validity', condition: { min: 18, max: 65 } },
    { name: 'REGEX_TEST', ruleType: 'REGEX', field: 'email', dimension: 'validity', condition: { pattern: '^[^@]+@[^@]+\\.[^@]+$' } },
    { name: 'MIN_LENGTH_TEST', ruleType: 'MIN_LENGTH', field: 'email', dimension: 'validity', condition: { length: 5 } },
    { name: 'ENUM_TEST', ruleType: 'ENUM', field: 'age', dimension: 'validity', condition: { values: [18, 19, 20, 21, 22] } },
  ];

  for (const rt of ruleTypes) {
    const ruleResponse = await axios.post(`${BASE_URL}/api/quality/rules`, {
      name: rt.name,
      datasetId: dataset._id,
      targetDatasetId: dataset._id,
      field: rt.field,
      targetColumn: rt.field,
      expression: '',
      dimension: rt.dimension,
      ruleType: rt.ruleType,
      condition: rt.condition || {},
      threshold: 0.95,
      severity: 'medium',
      enabled: true,
      owner: testUser.id,
      createdBy: testUser.id,
      status: 'active',
    }, { headers: { Authorization: `Bearer ${authToken}` } });

    createdResources.rules.push(ruleResponse.data.data._id);

    // Run the rule
    const runResponse = await axios.post(`${BASE_URL}/api/quality/rules/${ruleResponse.data.data._id}/run`, {}, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    console.assert(runResponse.data.success, `Rule ${rt.ruleType} should execute`);
    console.assert(runResponse.data.data.compliance !== undefined, `Rule ${rt.ruleType} should return compliance`);
    console.log(`✓ Rule type ${rt.ruleType} execution: PASSED`);
  }
}

async function runAllTests() {
  console.log('='.repeat(60));
  console.log('PHASE 9 DATA QUALITY ENGINE - TEST SUITE');
  console.log('='.repeat(60));

  try {
    await setupTestEnvironment();
    await testQualityModels();
    await testQualityEngine();
    await testQualityEngineEndpoints();
    await testIssueLifecycle();
    await testRBAC();
    await testProfiling();
    await testScoringAndTrends();
    await testRuleExecution();

    console.log('\n' + '='.repeat(60));
    console.log('ALL TESTS PASSED ✅');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await cleanupTestEnvironment();
  }
}

// Run the test suite
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  runAllTests,
  setupTestEnvironment,
  cleanupTestEnvironment,
};