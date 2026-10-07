const mongoose = require('mongoose');
const GovernanceRule = require('../models/GovernanceRule');
const GovernanceFinding = require('../models/GovernanceFinding');
const Policy = require('../models/Policy');
const Dataset = require('../models/Dataset');
const GlossaryTerm = require('../models/GlossaryTerm');
const Activity = require('../models/Activity');

// PII token recognition patterns (declarative, database-agnostic)
const PII_NAME_TOKENS = ['email', 'phone', 'ssn', 'social_security', 'dob', 'birth', 'passport', 'national_id', 'government_id', 'salary', 'credit_card'];

/**
 * Evaluates a single GovernanceRule against actual RicozData catalog metadata
 * @param {string|ObjectId} ruleId 
 * @param {object} actor - The user initiating evaluation
 * @returns {Promise<object>} Evaluation outcome
 */
async function evaluateRule(ruleId, actor = null) {
  const rule = await GovernanceRule.findById(ruleId).populate('policyId');
  if (!rule) {
    throw new Error('Governance rule not found');
  }

  const actorId = actor ? actor._id : rule.ownerId;
  const evaluationTimestamp = new Date();
  let result = 'PASS';
  let summary = '';
  let explanation = '';
  const newFindings = [];

  try {
    switch (rule.ruleType) {
      case 'PII_CLASSIFICATION': {
        // Evaluate columns for unclassified PII
        const targetDatasets = [];
        if (rule.targetType === 'DATASET' && rule.datasetId) {
          const ds = await Dataset.findById(rule.datasetId);
          if (ds) targetDatasets.push(ds);
        } else if (rule.targetType === 'ALL_DATASETS') {
          const allDs = await Dataset.find({ status: 'active' }).limit(50);
          targetDatasets.push(...allDs);
        } else if (rule.policyId && rule.policyId.datasetIds && rule.policyId.datasetIds.length > 0) {
          const policyDatasets = await Dataset.find({ _id: { $in: rule.policyId.datasetIds } });
          targetDatasets.push(...policyDatasets);
        }

        if (targetDatasets.length === 0) {
          result = 'NOT_EVALUATED';
          summary = 'No target datasets available for PII evaluation';
          explanation = 'Link target datasets to the rule or parent policy to evaluate PII classification.';
          break;
        }

        const violations = [];
        for (const ds of targetDatasets) {
          for (const col of ds.columns || []) {
            const colNameLower = col.name.toLowerCase();
            const isPiiCandidate = PII_NAME_TOKENS.some((tok) => colNameLower.includes(tok));
            if (isPiiCandidate) {
              const isClassified = col.pii === true || ['Confidential', 'Restricted'].includes(col.sensitivity);
              if (!isClassified) {
                violations.push({
                  datasetId: ds._id,
                  datasetName: ds.name,
                  columnName: col.name,
                  currentPii: col.pii,
                  currentSensitivity: col.sensitivity,
                });
              }
            }
          }
        }

        if (violations.length > 0) {
          result = 'FAIL';
          summary = `Identified ${violations.length} unclassified personal data column(s)`;
          explanation = `Columns containing personal data markers lack PII designation or required Confidential/Restricted sensitivity: ${violations
            .map((v) => `${v.datasetName}.${v.columnName}`)
            .slice(0, 5)
            .join(', ')}${violations.length > 5 ? ` and ${violations.length - 5} more` : ''}.`;

          for (const viol of violations) {
            newFindings.push({
              ruleId: rule._id,
              policyId: rule.policyId._id,
              targetType: 'COLUMN',
              datasetId: viol.datasetId,
              columnName: viol.columnName,
              resourceName: `${viol.datasetName}.${viol.columnName}`,
              severity: rule.severity || 'high',
              title: `Unclassified Sensitive Column: ${viol.datasetName}.${viol.columnName}`,
              explanation: `Column "${viol.columnName}" contains personal identifiers but is marked as pii=${viol.currentPii} with sensitivity="${viol.currentSensitivity}".`,
              evidence: {
                datasetName: viol.datasetName,
                columnName: viol.columnName,
                evaluatedAt: evaluationTimestamp,
                suggestedClassification: 'PII / Restricted',
              },
            });
          }
        } else {
          result = 'PASS';
          summary = `All evaluated columns (${targetDatasets.reduce((sum, d) => sum + (d.columns?.length || 0), 0)}) meet PII classification standards`;
          explanation = 'Evaluated columns with personal data markers have verified PII flags and compliant sensitivity ratings.';
        }
        break;
      }

      case 'DATASET_OWNER_REQUIRED': {
        const targetDatasets = [];
        if (rule.datasetId) {
          const ds = await Dataset.findById(rule.datasetId);
          if (ds) targetDatasets.push(ds);
        } else if (rule.policyId && rule.policyId.datasetIds?.length > 0) {
          const policyDatasets = await Dataset.find({ _id: { $in: rule.policyId.datasetIds } });
          targetDatasets.push(...policyDatasets);
        } else {
          const allDs = await Dataset.find({ status: 'active' }).limit(50);
          targetDatasets.push(...allDs);
        }

        const unownedDatasets = targetDatasets.filter((d) => !d.ownerId || !d.owner);
        if (unownedDatasets.length > 0) {
          result = 'FAIL';
          summary = `${unownedDatasets.length} dataset(s) lack an assigned business owner`;
          explanation = `Governance policy mandates accountable ownership. Unowned datasets: ${unownedDatasets
            .map((d) => d.name)
            .slice(0, 5)
            .join(', ')}.`;

          for (const ds of unownedDatasets) {
            newFindings.push({
              ruleId: rule._id,
              policyId: rule.policyId._id,
              targetType: 'DATASET',
              datasetId: ds._id,
              resourceName: ds.name,
              severity: rule.severity || 'medium',
              title: `Unassigned Dataset Owner: ${ds.name}`,
              explanation: `Dataset "${ds.name}" does not have an assigned ownerId in the catalog metadata.`,
              evidence: {
                datasetId: ds._id,
                datasetName: ds.name,
                evaluatedAt: evaluationTimestamp,
              },
            });
          }
        } else {
          result = 'PASS';
          summary = `All ${targetDatasets.length} evaluated dataset(s) have assigned business owners`;
          explanation = 'Every target dataset maintains documented business ownership.';
        }
        break;
      }

      case 'GLOSSARY_DEFINITION_REQUIRED': {
        const targetTerms = [];
        if (rule.glossaryTermId) {
          const term = await GlossaryTerm.findById(rule.glossaryTermId);
          if (term) targetTerms.push(term);
        } else if (rule.policyId && rule.policyId.glossaryTermIds?.length > 0) {
          const terms = await GlossaryTerm.find({ _id: { $in: rule.policyId.glossaryTermIds } });
          targetTerms.push(...terms);
        } else {
          const terms = await GlossaryTerm.find({ status: 'approved' }).limit(50);
          targetTerms.push(...terms);
        }

        const inadequateTerms = targetTerms.filter(
          (t) => !t.definition || t.definition.trim().length < 10 || t.definition.toLowerCase().includes('requires business review')
        );

        if (inadequateTerms.length > 0) {
          result = 'FAIL';
          summary = `${inadequateTerms.length} approved glossary term(s) lack formal definitions`;
          explanation = `Terms lack definitions or retain temporary placeholders: ${inadequateTerms.map((t) => t.term).join(', ')}.`;

          for (const term of inadequateTerms) {
            newFindings.push({
              ruleId: rule._id,
              policyId: rule.policyId._id,
              targetType: 'GLOSSARY_TERM',
              glossaryTermId: term._id,
              resourceName: term.term,
              severity: rule.severity || 'medium',
              title: `Incomplete Glossary Definition: ${term.term}`,
              explanation: `Glossary term "${term.term}" definition is deficient: "${term.definition || 'Empty'}".`,
              evidence: {
                termId: term._id,
                termName: term.term,
                definition: term.definition,
                evaluatedAt: evaluationTimestamp,
              },
            });
          }
        } else {
          result = 'PASS';
          summary = `All ${targetTerms.length} evaluated glossary term(s) have authoritative definitions`;
          explanation = 'Terms meet required length and semantic governance standards.';
        }
        break;
      }

      case 'QUALITY_SCORE_THRESHOLD': {
        const threshold = Number(rule.parameters?.minQualityScore) || 80;
        const targetDatasets = [];
        if (rule.datasetId) {
          const ds = await Dataset.findById(rule.datasetId);
          if (ds) targetDatasets.push(ds);
        } else if (rule.policyId && rule.policyId.datasetIds?.length > 0) {
          const policyDatasets = await Dataset.find({ _id: { $in: rule.policyId.datasetIds } });
          targetDatasets.push(...policyDatasets);
        }

        const belowThreshold = targetDatasets.filter((d) => (d.qualityScore || 0) < threshold);
        if (belowThreshold.length > 0) {
          result = 'FAIL';
          summary = `${belowThreshold.length} dataset(s) failed minimum quality threshold of ${threshold}%`;
          explanation = `Datasets below threshold: ${belowThreshold
            .map((d) => `${d.name} (${d.qualityScore || 0}%)`)
            .join(', ')}.`;

          for (const ds of belowThreshold) {
            newFindings.push({
              ruleId: rule._id,
              policyId: rule.policyId._id,
              targetType: 'DATASET',
              datasetId: ds._id,
              resourceName: ds.name,
              severity: rule.severity || 'high',
              title: `Quality Score Deficit: ${ds.name} (${ds.qualityScore || 0}% < ${threshold}%)`,
              explanation: `Dataset quality score of ${ds.qualityScore || 0}% does not meet required governance threshold of ${threshold}%.`,
              evidence: {
                datasetName: ds.name,
                actualScore: ds.qualityScore || 0,
                requiredThreshold: threshold,
                evaluatedAt: evaluationTimestamp,
              },
            });
          }
        } else {
          result = 'PASS';
          summary = `All ${targetDatasets.length} dataset(s) meet or exceed quality score of ${threshold}%`;
          explanation = 'Dataset quality scores satisfy enterprise governance requirements.';
        }
        break;
      }

      case 'SENSITIVITY_CLASSIFICATION': {
        const targetDatasets = [];
        if (rule.datasetId) {
          const ds = await Dataset.findById(rule.datasetId);
          if (ds) targetDatasets.push(ds);
        } else if (rule.policyId && rule.policyId.datasetIds?.length > 0) {
          const policyDatasets = await Dataset.find({ _id: { $in: rule.policyId.datasetIds } });
          targetDatasets.push(...policyDatasets);
        }

        const unclassified = targetDatasets.filter(
          (d) => !d.sensitivity || !['Public', 'Internal', 'Confidential', 'Restricted'].includes(d.sensitivity)
        );

        if (unclassified.length > 0) {
          result = 'FAIL';
          summary = `${unclassified.length} dataset(s) lack formal sensitivity classification`;
          explanation = `Datasets missing classification: ${unclassified.map((d) => d.name).join(', ')}.`;

          for (const ds of unclassified) {
            newFindings.push({
              ruleId: rule._id,
              policyId: rule.policyId._id,
              targetType: 'DATASET',
              datasetId: ds._id,
              resourceName: ds.name,
              severity: rule.severity || 'medium',
              title: `Missing Sensitivity Classification: ${ds.name}`,
              explanation: `Dataset "${ds.name}" has sensitivity set to "${ds.sensitivity || 'None'}".`,
              evidence: {
                datasetName: ds.name,
                evaluatedAt: evaluationTimestamp,
              },
            });
          }
        } else {
          result = 'PASS';
          summary = `All ${targetDatasets.length} dataset(s) have documented sensitivity classification`;
          explanation = 'Sensitivity classifications conform to enterprise taxonomy.';
        }
        break;
      }

      default:
        result = 'NOT_EVALUATED';
        summary = `Rule type "${rule.ruleType}" is not configured for automatic evaluation`;
        explanation = 'This rule represents a manual control requiring reviewer validation.';
    }
  } catch (err) {
    result = 'ERROR';
    summary = `Evaluation error: ${err.message}`;
    explanation = err.stack;
  }

  // Update rule evaluation status
  rule.lastRunAt = evaluationTimestamp;
  rule.lastResult = result;
  rule.lastRunSummary = summary;
  rule.lastRunExplanation = explanation;
  await rule.save();

  // Manage findings: prevent duplicates, create new, auto-resolve when rule passes
  if (result === 'FAIL') {
    for (const findingData of newFindings) {
      const existingOpenFinding = await GovernanceFinding.findOne({
        ruleId: rule._id,
        datasetId: findingData.datasetId || null,
        columnName: findingData.columnName || null,
        glossaryTermId: findingData.glossaryTermId || null,
        status: { $in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'] },
      });

      if (existingOpenFinding) {
        // Update existing finding timestamp and evidence
        existingOpenFinding.detectedAt = evaluationTimestamp;
        existingOpenFinding.evidence = findingData.evidence;
        existingOpenFinding.explanation = findingData.explanation;
        await existingOpenFinding.save();
      } else {
        await GovernanceFinding.create(findingData);
      }
    }
  } else if (result === 'PASS') {
    // Auto-resolve any previous open findings for this rule
    await GovernanceFinding.updateMany(
      {
        ruleId: rule._id,
        status: { $in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'] },
      },
      {
        $set: {
          status: 'RESOLVED',
          resolvedAt: evaluationTimestamp,
          resolutionNotes: 'Automated resolution: rule passed during re-evaluation',
        },
      }
    );
  }

  // Record audit activity
  try {
    await Activity.create({
      title: `Evaluated governance rule: "${rule.name}" (${result})`,
      type: 'policy',
      actorId,
      policyId: rule.policyId?._id || rule.policyId,
      metadata: {
        action: 'RULE_EVALUATED',
        ruleName: rule.name,
        result,
        summary,
        findingsGenerated: newFindings.length,
      },
    });
  } catch (actErr) {
    console.warn('Activity logging error:', actErr.message);
  }

  return {
    success: true,
    ruleId: rule._id,
    ruleName: rule.name,
    result,
    summary,
    explanation,
    evaluatedAt: evaluationTimestamp,
    findingsCount: newFindings.length,
  };
}

module.exports = {
  evaluateRule,
};
