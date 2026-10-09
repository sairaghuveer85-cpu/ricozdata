const Dataset = require('../models/Dataset');
const User = require('../models/User');
const Policy = require('../models/Policy');
const Quality = require('../models/Quality');
const QualityIssue = require('../models/QualityIssue');
const Activity = require('../models/Activity');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Get dashboard metrics
// @route   GET /api/dashboard/metrics
// @access  Private
const getDashboardMetrics = asyncHandler(async (req, res) => {
  const orgFilter = req.user?.organizationId ? { organizationId: req.user.organizationId } : {};

  // 1. Total datasets
  const totalDatasets = await Dataset.countDocuments(orgFilter);

  // 2. Average quality score
  const qualities = await Quality.find(orgFilter);
  let avgQuality = 0;
  if (qualities.length > 0) {
    avgQuality = Math.round(qualities.reduce((acc, curr) => acc + curr.score, 0) / qualities.length);
  } else {
    const dsWithQuality = await Dataset.find({ ...orgFilter, $or: [{ qualityScore: { $gt: 0 } }, { quality: { $gt: 0 } }] });
    if (dsWithQuality.length > 0) {
      avgQuality = Math.round(dsWithQuality.reduce((acc, curr) => acc + (curr.qualityScore || curr.quality || 0), 0) / dsWithQuality.length);
    }
  }

  // 3. Policy violations / unresolved issues
  const openIssues = await QualityIssue.countDocuments({
    ...orgFilter,
    status: { $in: ['open', 'investigating'] }
  });

  // 4. Active users in workspace
  const activeUsers = await User.countDocuments({
    ...orgFilter,
    status: { $in: ['active', 'ACTIVE'] }
  });

  const isFreshWorkspace = totalDatasets === 0;

  // Build the 4 metrics array matching StatCard requirements
  const metrics = [
    {
      id: 'total-datasets',
      title: 'TOTAL DATASETS',
      value: totalDatasets.toString(),
      comparison: isFreshWorkspace ? '0 cataloged' : `${totalDatasets} registered`,
      comparisonText: isFreshWorkspace ? 'Fresh workspace catalog' : 'Governed catalog assets',
      isPositive: !isFreshWorkspace,
      trend: isFreshWorkspace ? 'neutral' : 'up',
      trendType: isFreshWorkspace ? 'neutral' : 'positive'
    },
    {
      id: 'data-quality',
      title: 'DATA QUALITY',
      value: isFreshWorkspace ? 'N/A' : `${avgQuality}%`,
      comparison: isFreshWorkspace ? 'No Scans' : (avgQuality >= 90 ? 'Healthy' : avgQuality >= 80 ? 'Warning' : 'At Risk'),
      comparisonText: isFreshWorkspace ? 'No scanned assets yet' : 'Composite platform score',
      isPositive: avgQuality >= 85,
      trend: avgQuality >= 85 ? 'up' : 'down',
      trendType: avgQuality >= 85 ? 'positive' : 'negative'
    },
    {
      id: 'policy-violations',
      title: 'POLICY VIOLATIONS',
      value: openIssues.toString(),
      comparison: openIssues === 0 ? 'Zero breaches' : `${openIssues} pending`,
      comparisonText: 'Unresolved quality issues',
      isPositive: openIssues === 0,
      trend: openIssues === 0 ? 'down' : 'up',
      trendType: openIssues === 0 ? 'positive' : 'negative'
    },
    {
      id: 'active-users',
      title: 'ACTIVE USERS',
      value: activeUsers.toString(),
      comparison: `${activeUsers} active`,
      comparisonText: 'Authorized workspace operators',
      isPositive: true,
      trend: 'up',
      trendType: 'positive'
    }
  ];

  res.json({
    success: true,
    data: {
      metrics,
      summary: {
        totalDatasets,
        avgQuality,
        openIssues,
        activeUsers,
        isFreshWorkspace
      }
    },
  });
});

// @desc    Get dashboard recent activity
// @route   GET /api/dashboard/activity
// @access  Private
const getDashboardActivity = asyncHandler(async (req, res) => {
  const orgFilter = req.user?.organizationId ? { organizationId: req.user.organizationId } : {};

  const activities = await Activity.find(orgFilter)
    .populate('actorId', 'name email avatar avatarBg')
    .populate('datasetId', 'name')
    .sort({ timestamp: -1 })
    .limit(5);

  const formatted = activities.map(act => ({
    id: act._id,
    title: act.title,
    user: act.actorId ? act.actorId.name : 'System',
    time: act.time || 'Recently',
    type: act.type,
    dataset: act.datasetId ? act.datasetId.name : 'Unknown Dataset'
  }));

  res.json({
    success: true,
    data: formatted,
  });
});

// @desc    Get dashboard popular datasets
// @route   GET /api/dashboard/popular-datasets
// @access  Private
const getPopularDatasets = asyncHandler(async (req, res) => {
  const orgFilter = req.user?.organizationId ? { organizationId: req.user.organizationId } : {};

  const datasets = await Dataset.find(orgFilter)
    .sort({ views: -1, viewCount: -1 })
    .limit(4);

  const formatted = datasets.map(d => ({
    id: d._id,
    name: d.name,
    domain: d.domain,
    views: d.views ?? d.viewCount ?? 0,
    quality: d.qualityScore ?? d.quality ?? 0,
    status: d.status
  }));

  res.json({
    success: true,
    data: formatted,
  });
});

module.exports = {
  getDashboardMetrics,
  getDashboardActivity,
  getPopularDatasets,
};