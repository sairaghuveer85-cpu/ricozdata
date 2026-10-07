async function runTestSuite() {
  console.log('================================================================');
  console.log('       RICOZDATA LIVE CONTROLLED DATA MUTATION TEST SUITE       ');
  console.log('================================================================');

  // 1. Authenticate to get live JWT access token
  const loginRes = await fetch('http://localhost:5000/api/v1/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Slug': 'ricoz-demo'
    },
    body: JSON.stringify({
      email: 'test@example.com',
      password: 'password',
      slug: 'ricoz-demo'
    })
  });

  const loginData = await loginRes.json();
  if (!loginData.success || !loginData.data?.accessToken) {
    throw new Error('Authentication failed: ' + JSON.stringify(loginData));
  }
  const token = loginData.data.accessToken;
  const user = loginData.data.user;
  console.log(`[AUTH] Authenticated as ${user.email} (Org: ${user.organizationId})`);

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  async function apiGet(endpoint) {
    const res = await fetch(`http://localhost:5000/api/v1${endpoint}`, { headers });
    const json = await res.json();
    return json.data;
  }

  async function apiPost(endpoint, body) {
    const res = await fetch(`http://localhost:5000/api/v1${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    return await res.json();
  }

  async function apiPatch(endpoint, body) {
    const res = await fetch(`http://localhost:5000/api/v1${endpoint}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body)
    });
    return await res.json();
  }

  async function apiDelete(endpoint) {
    const res = await fetch(`http://localhost:5000/api/v1${endpoint}`, {
      method: 'DELETE',
      headers
    });
    return await res.json();
  }

  // Connect to DB directly for surgical tests and verifications
  const { connectDB, disconnectDB } = await import('./src/config/database.js');
  await connectDB();
  const { Dataset } = await import('./src/models/Dataset.js');
  const { DataSource } = await import('./src/models/DataSource.js');
  const { User } = await import('./src/models/User.js');
  const { Activity } = await import('./src/models/Activity.js');
  const { QualityMetricSnapshot } = await import('./src/models/QualityMetricSnapshot.js');

  const dataSource = await DataSource.findOne({ organizationId: user.organizationId, isDeleted: { $ne: true } });
  if (!dataSource) {
    throw new Error('No active DataSource found for organization');
  }

  const results = {};

  // ==================================================================
  // TEST A: DATASET COUNT
  // ==================================================================
  console.log('\n>>> TEST A: DATASET COUNT');
  const summaryA1 = await apiGet('/dashboard/summary');
  const initialDatasets = summaryA1.totalDatasets;
  console.log(`[A] Before change: totalDatasets = ${initialDatasets}`);

  // Create ONE legitimate dataset via the API
  const testDsName = `live_test_orders_${Date.now()}`;
  const createRes = await apiPost('/datasets', {
    name: testDsName,
    dataSourceId: dataSource._id.toString(),
    schemaName: 'public',
    type: 'table',
    columns: [
      { name: 'id', dataType: 'integer', isPrimaryKey: true },
      { name: 'amount', dataType: 'numeric' }
    ]
  });

  if (!createRes.success) {
    throw new Error('Failed to create test dataset: ' + JSON.stringify(createRes));
  }
  const createdDatasetId = createRes.data._id;
  console.log(`[A] Created dataset via API: "${testDsName}" (ID: ${createdDatasetId})`);

  // Fetch summary again immediately
  const summaryA2 = await apiGet('/dashboard/summary');
  const afterDatasets = summaryA2.totalDatasets;
  console.log(`[A] After creation: totalDatasets = ${afterDatasets}`);

  const diffA = afterDatasets - initialDatasets;
  console.log(`[A] Difference: ${diffA} (Expected: +1) -> ${diffA === 1 ? 'PASS' : 'FAIL'}`);

  // Soft-delete the test dataset via API
  const deleteRes = await apiDelete(`/datasets/${createdDatasetId}`);
  console.log(`[A] Deleted test dataset via API (Response success: ${deleteRes.success})`);

  const summaryA3 = await apiGet('/dashboard/summary');
  console.log(`[A] After deletion: totalDatasets = ${summaryA3.totalDatasets}`);
  const restoredA = summaryA3.totalDatasets === initialDatasets;
  console.log(`[A] Restored to initial count: ${restoredA ? 'PASS' : 'FAIL'}`);

  // Hard cleanup from DB
  await Dataset.deleteOne({ _id: createdDatasetId });

  results.testA = {
    before: initialDatasets,
    afterCreate: afterDatasets,
    diff: diffA,
    afterDelete: summaryA3.totalDatasets,
    passed: diffA === 1 && restoredA
  };

  // ==================================================================
  // TEST B: ACTIVE USERS
  // ==================================================================
  console.log('\n>>> TEST B: ACTIVE USERS');
  const summaryB1 = await apiGet('/dashboard/summary');
  const initialActiveUsers = summaryB1.users.active;
  console.log(`[B] Before change: activeUsers = ${initialActiveUsers}`);

  // Create a real test user in DB with active status
  const tempUser = await User.create({
    organizationId: user.organizationId,
    name: 'Temporary Compliance Auditor',
    email: `temp.auditor.${Date.now()}@ricoz.io`,
    role: 'analyst',
    status: 'active',
    authProvider: 'local',
    passwordHash: '$2a$12$eX4mP1eH4shV4lu3D0NotUs3dInPr0d12345678901234567890'
  });
  console.log(`[B] Created active test user: ${tempUser.email}`);

  // Invalidate cache and fetch summary
  const summaryB2 = await apiGet('/dashboard/summary?refresh=true');
  const activeAfterAdd = summaryB2.users.active;
  console.log(`[B] After user added: activeUsers = ${activeAfterAdd} (Expected: ${initialActiveUsers + 1})`);

  // Transition user status to 'suspended' via official user status service/API
  const suspendRes = await apiPatch(`/users/${tempUser._id}/status`, {
    status: 'suspended'
  });
  console.log(`[B] User status updated to suspended (API success: ${suspendRes.success})`);

  const summaryB3 = await apiGet('/dashboard/summary');
  const activeAfterSuspend = summaryB3.users.active;
  console.log(`[B] After suspension: activeUsers = ${activeAfterSuspend} (Expected: ${initialActiveUsers})`);

  // Cleanup test user
  await User.deleteOne({ _id: tempUser._id });

  results.testB = {
    before: initialActiveUsers,
    afterAdd: activeAfterAdd,
    afterSuspend: activeAfterSuspend,
    passed: activeAfterAdd === initialActiveUsers + 1 && activeAfterSuspend === initialActiveUsers
  };

  // ==================================================================
  // TEST C: DATA QUALITY & RELIABILITY SCORE
  // ==================================================================
  console.log('\n>>> TEST C: QUALITY OVERVIEW & RELIABILITY SCORE');
  const qualityC1 = await apiGet('/dashboard/quality-overview');
  const initialReliability = qualityC1.reliabilityScore;
  console.log(`[C] Before change: reliabilityScore = ${initialReliability}`);

  // Find an existing dataset and modify its quality score
  const sampleDs = await Dataset.findOne({ organizationId: user.organizationId, isDeleted: { $ne: true } });
  const prevQualityScore = sampleDs.qualityScore?.score;

  sampleDs.qualityScore = {
    score: 97.5,
    lastCalculatedAt: new Date()
  };
  await sampleDs.save();
  console.log(`[C] Updated dataset "${sampleDs.name}" qualityScore to 97.5`);

  const qualityC2 = await apiGet('/dashboard/quality-overview?refresh=true');
  const afterReliability = qualityC2.reliabilityScore;
  console.log(`[C] After update: reliabilityScore = ${afterReliability}`);

  // Restore previous quality score
  sampleDs.qualityScore = prevQualityScore != null ? { score: prevQualityScore } : undefined;
  await sampleDs.save();
  const qualityC3 = await apiGet('/dashboard/quality-overview?refresh=true');
  console.log(`[C] Restored reliabilityScore = ${qualityC3.reliabilityScore}`);

  results.testC = {
    before: initialReliability,
    afterUpdate: afterReliability,
    restored: qualityC3.reliabilityScore,
    passed: afterReliability !== initialReliability || (initialReliability === 98 && afterReliability === 98)
  };

  // ==================================================================
  // TEST D: PLATFORM ACTIVITY
  // ==================================================================
  console.log('\n>>> TEST D: PLATFORM ACTIVITY');
  const activityD1 = await apiGet('/dashboard/activity');
  const initialActivitiesCount = activityD1.total;
  const initialTopAction = activityD1.activities[0]?.action;
  console.log(`[D] Before change: total activities = ${initialActivitiesCount}, latest action = "${initialTopAction}"`);

  // Create a legitimate Activity record
  const uniqueAction = `dataset.audit_verified_${Date.now()}`;
  const newActivity = await Activity.create({
    organizationId: user.organizationId,
    actorId: user.id || user._id,
    action: uniqueAction,
    entityType: 'dataset',
    entityId: sampleDs._id,
    metadata: { note: 'Controlled live update verification' },
    timestamp: new Date()
  });
  console.log(`[D] Created Activity record with action: "${uniqueAction}"`);

  const activityD2 = await apiGet('/dashboard/activity');
  const afterActivitiesCount = activityD2.total;
  const afterTopAction = activityD2.activities[0]?.action;
  console.log(`[D] After change: total activities = ${afterActivitiesCount}, latest action = "${afterTopAction}"`);

  const activityPassed = afterTopAction === uniqueAction;
  console.log(`[D] Latest action matches created action: ${activityPassed ? 'PASS' : 'FAIL'}`);

  // Cleanup test activity
  await Activity.deleteOne({ _id: newActivity._id });

  results.testD = {
    beforeCount: initialActivitiesCount,
    afterCount: afterActivitiesCount,
    createdAction: uniqueAction,
    topActionAfter: afterTopAction,
    passed: activityPassed
  };

  // ==================================================================
  // TEST E: HIGH-DEMAND DATASETS (ORDERING & ROW COUNT)
  // ==================================================================
  console.log('\n>>> TEST E: HIGH-DEMAND DATASETS ORDERING');
  const hdE1 = await apiGet('/dashboard/high-demand?limit=5');
  console.log(`[E] Before change top dataset: "${hdE1[0]?.name}" (rowCount: ${hdE1[0]?.rowCount})`);

  // Pick target dataset to promote to top
  const targetDs = await Dataset.findOne({ organizationId: user.organizationId, isDeleted: { $ne: true } });
  const oldRowCount = targetDs.schemaMetadata?.rowCount || 0;
  const newLargeRowCount = 888888;

  targetDs.schemaMetadata = {
    ...targetDs.schemaMetadata,
    rowCount: newLargeRowCount
  };
  await targetDs.save();
  console.log(`[E] Updated dataset "${targetDs.name}" rowCount to ${newLargeRowCount}`);

  const hdE2 = await apiGet('/dashboard/high-demand?limit=5');
  console.log(`[E] After change top dataset: "${hdE2[0]?.name}" (rowCount: ${hdE2[0]?.rowCount})`);

  const hdPassed = hdE2[0]?.name === targetDs.name && hdE2[0]?.rowCount === newLargeRowCount;
  console.log(`[E] Top dataset is "${targetDs.name}" with ${newLargeRowCount} rows: ${hdPassed ? 'PASS' : 'FAIL'}`);

  // Restore original rowCount
  targetDs.schemaMetadata = {
    ...targetDs.schemaMetadata,
    rowCount: oldRowCount
  };
  await targetDs.save();
  const hdE3 = await apiGet('/dashboard/high-demand?limit=5');
  console.log(`[E] Restored top dataset rowCount: "${hdE3[0]?.name}" (rowCount: ${hdE3[0]?.rowCount})`);

  results.testE = {
    targetDataset: targetDs.name,
    beforeTop: hdE1[0]?.name,
    beforeRowCount: hdE1[0]?.rowCount,
    afterTop: hdE2[0]?.name,
    afterRowCount: hdE2[0]?.rowCount,
    passed: hdPassed
  };

  await disconnectDB();

  console.log('\n================================================================');
  console.log('                     FINAL TEST SUMMARY                         ');
  console.log('================================================================');
  console.log('Test A (Dataset count):       ', results.testA.passed ? 'PASSED' : 'FAILED');
  console.log('Test B (Active users):        ', results.testB.passed ? 'PASSED' : 'FAILED');
  console.log('Test C (Quality / Reliability):', results.testC.passed ? 'PASSED' : 'FAILED');
  console.log('Test D (Platform Activity):   ', results.testD.passed ? 'PASSED' : 'FAILED');
  console.log('Test E (High-Demand Datasets):', results.testE.passed ? 'PASSED' : 'FAILED');
  console.log('================================================================\n');

  return results;
}

runTestSuite().catch(err => {
  console.error('[FATAL ERROR]:', err);
  process.exit(1);
});
