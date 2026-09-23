import { INITIAL_DATASETS } from '../data/datasets.js';
import { INITIAL_USERS } from '../data/users.js';
import { INITIAL_DOMAINS } from '../data/domains.js';
import { INITIAL_POLICIES, INITIAL_RULES } from '../data/policies.js';
import { INITIAL_GLOSSARY_TERMS } from '../data/glossary.js';
import { INITIAL_ACTIVITIES } from '../data/activities.js';
import { DATASET_QUALITY_METRICS, QUALITY_ISSUES } from '../data/quality.js';
import { DATASET_LINEAGE_GRAPHS } from '../data/lineage.js';

/** Validates all canonical frontend records before they are used in the demo. */
export function validateDataIntegrity() {
  const datasetIds = new Set(INITIAL_DATASETS.map(({ id }) => id));
  const userIds = new Set(INITIAL_USERS.map(({ id }) => id));
  const domainIds = new Set(INITIAL_DOMAINS.map(({ id }) => id));
  const policyIds = new Set(INITIAL_POLICIES.map(({ id }) => id));
  const termIds = new Set(INITIAL_GLOSSARY_TERMS.map(({ id }) => id));
  const ruleIds = new Set(INITIAL_RULES.map(({ id }) => id));
  const errors = [];
  const assert = (condition, message) => { if (!condition) errors.push(message); };

  INITIAL_DATASETS.forEach((dataset) => {
    assert(domainIds.has(dataset.domainId), `Dataset ${dataset.id}: invalid domain`);
    assert(userIds.has(dataset.ownerId), `Dataset ${dataset.id}: invalid owner`);
    assert(userIds.has(dataset.stewardId), `Dataset ${dataset.id}: invalid steward`);
    assert(Boolean(DATASET_QUALITY_METRICS[dataset.qualityRef]), `Dataset ${dataset.id}: missing quality`);
    dataset.policyIds.forEach((id) => assert(policyIds.has(id), `Dataset ${dataset.id}: invalid policy ${id}`));
    dataset.glossaryTermIds.forEach((id) => assert(termIds.has(id), `Dataset ${dataset.id}: invalid glossary term ${id}`));
  });
  INITIAL_POLICIES.forEach((policy) => { assert(userIds.has(policy.ownerId), `Policy ${policy.id}: invalid owner`); policy.datasetIds.forEach((id) => assert(datasetIds.has(id), `Policy ${policy.id}: invalid dataset ${id}`)); });
  INITIAL_GLOSSARY_TERMS.forEach((term) => { assert(domainIds.has(term.domainId), `Glossary ${term.id}: invalid domain`); assert(userIds.has(term.ownerId), `Glossary ${term.id}: invalid owner`); term.relatedDatasetIds.forEach((id) => assert(datasetIds.has(id), `Glossary ${term.id}: invalid dataset ${id}`)); });
  INITIAL_ACTIVITIES.forEach((activity) => { assert(userIds.has(activity.actorId), `Activity ${activity.id}: invalid actor`); assert(datasetIds.has(activity.datasetId), `Activity ${activity.id}: invalid dataset`); if (activity.policyId) assert(policyIds.has(activity.policyId), `Activity ${activity.id}: invalid policy`); if (activity.glossaryTermId) assert(termIds.has(activity.glossaryTermId), `Activity ${activity.id}: invalid term`); });
  INITIAL_RULES.forEach((rule) => { const dataset = INITIAL_DATASETS.find(({ id }) => id === rule.datasetId); assert(dataset?.schema.some(({ name }) => name === rule.field), `Rule ${rule.id}: invalid field`); });
  QUALITY_ISSUES.forEach((issue) => { const dataset = INITIAL_DATASETS.find(({ id }) => id === issue.datasetId); const rule = INITIAL_RULES.find(({ id }) => id === issue.ruleId); assert(dataset?.schema.some(({ name }) => name === issue.field), `Issue ${issue.id}: invalid field`); assert(ruleIds.has(issue.ruleId) && rule?.datasetId === issue.datasetId && rule?.field === issue.field, `Issue ${issue.id}: invalid rule`); });
  Object.entries(DATASET_LINEAGE_GRAPHS).forEach(([datasetId, graph]) => { assert(datasetIds.has(datasetId), `Lineage ${datasetId}: invalid dataset`); const nodeIds = new Set(graph.nodes.map(({ id }) => id)); graph.nodes.forEach((item) => { assert(userIds.has(item.data.ownerId), `Lineage ${item.id}: invalid owner`); if (item.data.datasetId) assert(datasetIds.has(item.data.datasetId), `Lineage ${item.id}: invalid dataset ref`); }); graph.edges.forEach((edge) => assert(nodeIds.has(edge.source) && nodeIds.has(edge.target), `Lineage ${edge.id}: broken edge`)); });
  return { valid: errors.length === 0, errors };
}
