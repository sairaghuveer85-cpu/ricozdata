const mongoose = require('mongoose');
const Policy = require('../models/Policy');
const GovernanceRule = require('../models/GovernanceRule');
const GovernanceFinding = require('../models/GovernanceFinding');
const ComplianceFramework = require('../models/ComplianceFramework');
const ComplianceControl = require('../models/ComplianceControl');
const ComplianceAssessment = require('../models/ComplianceAssessment');
const ComplianceEvidence = require('../models/ComplianceEvidence');
const ResourceAccess = require('../models/ResourceAccess');
const User = require('../models/User');
const Dataset = require('../models/Dataset');
const { ROLES } = require('../config/rbac');

async function seedGovernance() {
  console.log('[Seed] Seeding Governance Frameworks, Controls, and Rules...');

  const admin = await User.findOne({ role: ROLES.ADMIN }) || await User.findOne();
  const steward = await User.findOne({ role: ROLES.DATA_STEWARD }) || admin;
  const adminId = admin ? admin._id : new mongoose.Types.ObjectId();
  const stewardId = steward ? steward._id : adminId;

  // 1. Seed Compliance Frameworks
  const frameworksData = [
    {
      identifier: 'GDPR',
      name: 'General Data Protection Regulation (GDPR)',
      description: 'EU regulation on data protection and privacy for individuals within the European Union.',
      version: '2016/679',
      category: 'Privacy',
      status: 'ACTIVE',
      ownerId: stewardId,
    },
    {
      identifier: 'SOC2',
      name: 'Service Organization Control 2 (SOC 2 Type II)',
      description: 'AICPA trust services criteria for security, availability, processing integrity, and confidentiality.',
      version: '2022',
      category: 'Security & Availability',
      status: 'ACTIVE',
      ownerId: adminId,
    },
    {
      identifier: 'ISO27001',
      name: 'ISO/IEC 27001:2022 Information Security',
      description: 'International standard for information security management systems (ISMS).',
      version: '2022',
      category: 'Information Security',
      status: 'ACTIVE',
      ownerId: adminId,
    },
  ];

  const frameworkMap = {};
  for (const fw of frameworksData) {
    let existing = await ComplianceFramework.findOne({ identifier: fw.identifier });
    if (!existing) {
      existing = await ComplianceFramework.create(fw);
    }
    frameworkMap[fw.identifier] = existing;
  }

  // 2. Link Existing Policies to Datasets if missing
  const customerDataset = await Dataset.findOne({ name: { $regex: /customer/i } });
  const piiPolicy = await Policy.findOne({ name: { $regex: /PII Data Access/i } });
  const qualityPolicy = await Policy.findOne({ name: { $regex: /Data Quality Threshold/i } });
  const accessPolicy = await Policy.findOne({ name: { $regex: /Access Review/i } });

  if (customerDataset && piiPolicy && (!piiPolicy.datasetIds || piiPolicy.datasetIds.length === 0)) {
    piiPolicy.datasetIds = [customerDataset._id];
    await piiPolicy.save();
    await Dataset.findByIdAndUpdate(customerDataset._id, { $addToSet: { policyIds: piiPolicy._id } });
  }

  // 3. Seed Governance Rules
  const rulesToSeed = [];

  if (piiPolicy) {
    rulesToSeed.push({
      name: 'Customer PII Column Classification Verification',
      description: 'Verifies that all columns containing personal identifiers in customer datasets are marked with PII flags and Restricted/Confidential sensitivity.',
      policyId: piiPolicy._id,
      category: 'PII_PROTECTION',
      ruleType: 'PII_CLASSIFICATION',
      severity: 'high',
      status: 'active',
      targetType: customerDataset ? 'DATASET' : 'ALL_DATASETS',
      datasetId: customerDataset ? customerDataset._id : undefined,
      ownerId: stewardId,
      createdBy: stewardId,
    });
  }

  if (accessPolicy) {
    rulesToSeed.push({
      name: 'Governed Dataset Ownership Accountable Assignment',
      description: 'Verifies that every active dataset managed under data access governance has a designated business owner.',
      policyId: accessPolicy._id,
      category: 'DATASET_OWNERSHIP',
      ruleType: 'DATASET_OWNER_REQUIRED',
      severity: 'medium',
      status: 'active',
      targetType: 'ALL_DATASETS',
      ownerId: adminId,
      createdBy: adminId,
    });
  }

  if (qualityPolicy) {
    rulesToSeed.push({
      name: 'Production Quality Score Threshold (Min 80%)',
      description: 'Verifies that production datasets maintain an automated data quality health score of at least 80%.',
      policyId: qualityPolicy._id,
      category: 'QUALITY_THRESHOLD',
      ruleType: 'QUALITY_SCORE_THRESHOLD',
      severity: 'high',
      status: 'active',
      targetType: customerDataset ? 'DATASET' : 'ALL_DATASETS',
      datasetId: customerDataset ? customerDataset._id : undefined,
      parameters: { minQualityScore: 80 },
      ownerId: stewardId,
      createdBy: stewardId,
    });

    rulesToSeed.push({
      name: 'Business Glossary Semantic Definition Completeness',
      description: 'Ensures authoritative glossary terms maintain comprehensive definitions exceeding minimum governance criteria.',
      policyId: qualityPolicy._id,
      category: 'GLOSSARY_ALIGNMENT',
      ruleType: 'GLOSSARY_DEFINITION_REQUIRED',
      severity: 'medium',
      status: 'active',
      targetType: 'GLOSSARY_TERM',
      ownerId: stewardId,
      createdBy: stewardId,
    });
  }

  const seededRules = [];
  for (const rData of rulesToSeed) {
    let rule = await GovernanceRule.findOne({ name: rData.name });
    if (!rule) {
      rule = await GovernanceRule.create(rData);
      await Policy.findByIdAndUpdate(rData.policyId, { $addToSet: { ruleIds: rule._id } });
    }
    seededRules.push(rule);
  }

  // 4. Seed Compliance Controls
  const controlsData = [
    {
      frameworkId: frameworkMap.GDPR._id,
      controlId: 'GDPR-Art-25',
      name: 'Data Protection by Design & Default',
      description: 'Measures to implement data-protection principles (e.g. data classification and access controls) effectively.',
      category: 'Technical Safeguards',
      policyIds: piiPolicy ? [piiPolicy._id] : [],
      ruleIds: seededRules.filter((r) => r.ruleType === 'PII_CLASSIFICATION').map((r) => r._id),
      datasetIds: customerDataset ? [customerDataset._id] : [],
      status: 'COMPLIANT',
      ownerId: stewardId,
    },
    {
      frameworkId: frameworkMap.GDPR._id,
      controlId: 'GDPR-Art-30',
      name: 'Records of Processing Activities',
      description: 'Maintaining designated ownership, stewardship, and processing descriptions for all managed datasets.',
      category: 'Accountability',
      policyIds: accessPolicy ? [accessPolicy._id] : [],
      ruleIds: seededRules.filter((r) => r.ruleType === 'DATASET_OWNER_REQUIRED').map((r) => r._id),
      status: 'COMPLIANT',
      ownerId: adminId,
    },
    {
      frameworkId: frameworkMap.GDPR._id,
      controlId: 'GDPR-Art-32',
      name: 'Security of Personal Data Processing',
      description: 'Ensuring ongoing confidentiality, integrity, availability, and resilience of processing systems.',
      category: 'Security',
      policyIds: piiPolicy ? [piiPolicy._id] : [],
      status: 'PARTIALLY_COMPLIANT',
      ownerId: stewardId,
    },
    {
      frameworkId: frameworkMap.SOC2._id,
      controlId: 'CC-6.1',
      name: 'Logical Access Controls & Authorization',
      description: 'Infrastructure and application-level access controls to protect sensitive information assets.',
      category: 'Common Criteria',
      policyIds: accessPolicy ? [accessPolicy._id] : [],
      status: 'COMPLIANT',
      ownerId: adminId,
    },
    {
      frameworkId: frameworkMap.SOC2._id,
      controlId: 'CC-6.6',
      name: 'Logical Boundaries & Data Classification',
      description: 'Confidentiality and sensitivity boundaries maintained across organizational boundaries.',
      category: 'Common Criteria',
      policyIds: piiPolicy ? [piiPolicy._id] : [],
      status: 'NOT_ASSESSED',
      ownerId: stewardId,
    },
    {
      frameworkId: frameworkMap.ISO27001._id,
      controlId: 'A.8.2',
      name: 'Information Classification Taxonomy',
      description: 'Classification of information in terms of legal requirements, value, criticality, and sensitivity.',
      category: 'Asset Management',
      policyIds: piiPolicy ? [piiPolicy._id] : [],
      status: 'COMPLIANT',
      ownerId: stewardId,
    },
    {
      frameworkId: frameworkMap.ISO27001._id,
      controlId: 'A.8.8',
      name: 'Management of Technical Vulnerabilities',
      description: 'Regular evaluation of data quality anomalies and technical metadata integrity.',
      category: 'Operations Security',
      policyIds: qualityPolicy ? [qualityPolicy._id] : [],
      ruleIds: seededRules.filter((r) => r.ruleType === 'QUALITY_SCORE_THRESHOLD').map((r) => r._id),
      status: 'PARTIALLY_COMPLIANT',
      ownerId: adminId,
    },
  ];

  for (const cData of controlsData) {
    let existing = await ComplianceControl.findOne({
      frameworkId: cData.frameworkId,
      controlId: cData.controlId,
    });
    if (!existing) {
      existing = await ComplianceControl.create({
        ...cData,
        lastAssessedAt: new Date(),
        lastAssessedBy: stewardId,
      });

      // Create initial assessment record
      await ComplianceAssessment.create({
        controlId: existing._id,
        frameworkId: existing.frameworkId,
        status: existing.status,
        assessorId: stewardId,
        notes: `Initial governance baseline assessment for ${existing.controlId}: Verified alignment with platform policy and catalog metadata.`,
        assessedAt: new Date(),
      });
    }
  }

  // Update framework control counts
  for (const fw of Object.values(frameworkMap)) {
    const count = await ComplianceControl.countDocuments({ frameworkId: fw._id });
    await ComplianceFramework.findByIdAndUpdate(fw._id, { controlsCount: count });
  }

  console.log('[Seed] Governance seeding complete.');
}

module.exports = { seedGovernance };
