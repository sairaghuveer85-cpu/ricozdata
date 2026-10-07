/**
 * Central Relational Selectors and Query Helpers
 * Enables fast cross-entity lookups, joins, and search without state management overhead.
 */

/**
 * Find dataset by ID
 */
export function getDatasetById(datasets = [], id) {
  if (!id) return null;
  return datasets.find((d) => d.id === id || d._id === id) || null;
}

/**
 * Find user by ID or Name
 */
export function getUserById(users = [], idOrName) {
  if (!idOrName) return null;
  return (
    users.find((u) => u.id === idOrName || u._id === idOrName) ||
    users.find((u) => u.name?.toLowerCase() === idOrName.toLowerCase()) ||
    null
  );
}

/**
 * Find domain by ID or Name
 */
export function getDomainById(domains = [], idOrName) {
  if (!idOrName || !Array.isArray(domains)) return null;
  return (
    domains.find((d) => d.id === idOrName || d._id === idOrName) ||
    domains.find((d) => d.name?.toLowerCase() === idOrName.toLowerCase()) ||
    null
  );
}

/**
 * Resolves full user profile for dataset owner
 */
export function getDatasetOwner(users = [], dataset) {
  if (!dataset) return null;
  if (dataset.ownerId) {
    const user = users.find((u) => u.id === dataset.ownerId || u._id === dataset.ownerId);
    if (user) return user;
  }
  if (dataset.owner) {
    const user = users.find((u) => u.name === dataset.owner);
    if (user) return user;
  }
  return {
    id: dataset.ownerId || 'unknown',
    name: dataset.owner || 'Unassigned',
    email: dataset.ownerEmail || 'contact@ricozdata.com',
    role: dataset.ownerRole || 'Data Owner',
    avatar: (dataset.owner || 'U')[0],
    avatarBg: 'bg-slate-600'
  };
}

/**
 * Resolves quality overview and dimensions for a dataset
 */
export function getQualityForDataset(datasetId, datasets = []) {
  if (!datasetId) return null;
  const ds = Array.isArray(datasets) ? datasets.find(d => d.id === datasetId || d._id === datasetId) : null;
  if (!ds) {
    return {
      score: 0,
      grade: 'Unrated',
      trendText: 'No scan data',
      dimensions: []
    };
  }

  const score = Number(ds.qualityScore ?? ds.quality ?? 0);
  if (ds.dimensions && Array.isArray(ds.dimensions) && ds.dimensions.length > 0) {
    return {
      score,
      grade: ds.grade || (score >= 90 ? 'Excellent' : score >= 75 ? 'Good' : score > 0 ? 'Needs Review' : 'Unrated'),
      trendText: ds.trendText || (score > 0 ? 'Verified via quality engine' : 'No scans run'),
      dimensions: ds.dimensions
    };
  }

  return {
    score: ds.qualityScore !== undefined ? ds.qualityScore : (ds.quality !== undefined ? ds.quality : null),
    grade: ds.grade || (score >= 90 ? 'Excellent' : score >= 75 ? 'Good' : score > 0 ? 'Needs Review' : 'Unrated'),
    trendText: ds.trendText || (score > 0 ? 'Verified via quality engine' : 'No scans run'),
    dimensions: []
  };
}

/**
 * Filters quality issues for a given dataset
 */
export function getIssuesForDataset(issues = [], datasetId) {
  if (!datasetId) return issues;
  return issues.filter((i) => i.datasetId === datasetId || i.datasetId?._id === datasetId);
}

/**
 * Filters policies applying to a dataset
 */
export function getPoliciesForDataset(policies = [], datasetId) {
  if (!datasetId) return policies;
  return policies.filter(
    (p) =>
      p.datasetIds?.includes(datasetId) ||
      p.datasetIds?.includes('all') ||
      p.affectedDatasets?.some((name) => name.toLowerCase().includes(String(datasetId).replace('-', ' ')))
  );
}

/**
 * Returns lineage graph nodes and edges for a dataset
 */
export function getLineageForDataset(datasetId) {
  // Real lineage is loaded asynchronously via lineageApi
  return { nodes: [], edges: [] };
}

/**
 * Filters glossary terms linked to a dataset
 */
export function getGlossaryTermsForDataset(terms = [], datasetId) {
  if (!datasetId) return terms;
  return terms.filter(
    (t) =>
      t.relatedDatasetIds?.includes(datasetId) ||
      t.relatedDatasets?.some((name) => name.toLowerCase().includes(datasetId.replace('-', ' ')))
  );
}

/**
 * Filters activities for a dataset
 */
export function getActivitiesForDataset(activities = [], datasetId) {
  if (!datasetId) return activities;
  return activities.filter((a) => a.datasetId === datasetId);
}

/**
 * Enriches a dataset with joined entities for immediate UI rendering
 */
export function enrichDataset(dataset, { users = [], domains = DOMAIN_REGISTRY } = {}) {
  if (!dataset) return null;
  const ownerUser = getDatasetOwner(users, dataset);
  const domainData = getDomainById(domains, dataset.domainId || dataset.domain);
  const qualityData = getQualityForDataset(dataset.id);

  return {
    ...dataset,
    ownerUser,
    domainData,
    qualityData,
    // Ensure standard string properties remain backward compatible
    owner: ownerUser?.name || dataset.owner,
    ownerEmail: ownerUser?.email || dataset.ownerEmail,
    ownerRole: ownerUser?.role || dataset.ownerRole,
    domain: domainData?.name || dataset.domain,
    quality: qualityData?.score || dataset.quality
  };
}

/**
 * Unified multi-entity search helper (useful for CommandPalette and Global Header)
 */
export function searchCentralData(query, { datasets = [], users = [], glossary = [], policies = [] } = {}) {
  if (!query || !query.trim()) {
    return { datasets: [], users: [], glossary: [], policies: [] };
  }
  const q = query.toLowerCase().trim();

  return {
    datasets: datasets.filter(
      (d) =>
        d.name?.toLowerCase().includes(q) ||
        d.description?.toLowerCase().includes(q) ||
        d.tags?.some((t) => t.toLowerCase().includes(q))
    ),
    users: users.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.department?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q)
    ),
    glossary: glossary.filter(
      (g) =>
        g.term?.toLowerCase().includes(q) ||
        g.definition?.toLowerCase().includes(q) ||
        g.tags?.some((t) => t.toLowerCase().includes(q))
    ),
    policies: policies.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.compliance?.toLowerCase().includes(q)
    )
  };
}
