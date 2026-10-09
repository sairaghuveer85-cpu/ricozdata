const Activity = require('../models/Activity');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Get total count of activities
// @route   GET /api/activities/count
// @access  Private
const getActivityCount = asyncHandler(async (req, res) => {
  const filter = req.user?.organizationId ? { organizationId: req.user.organizationId } : {};
  const totalCount = await Activity.countDocuments(filter);

  res.json({
    success: true,
    count: totalCount,
    totalCount,
  });
});

// @desc    Get recent activities
// @route   GET /api/activities
// @access  Private
const getActivities = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const filter = req.user?.organizationId ? { organizationId: req.user.organizationId } : {};

  const [activities, totalCount] = await Promise.all([
    Activity.find(filter)
      .populate('actorId', 'name email avatar avatarBg')
      .populate('datasetId', 'name')
      .sort({ timestamp: -1 })
      .limit(limit),
    Activity.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: activities,
    totalCount,
    count: totalCount,
    pagination: {
      total: totalCount,
      limit,
    },
  });
});

// @desc    Create activity
// @route   POST /api/activities
// @access  Private
const createActivity = asyncHandler(async (req, res) => {
  const activity = await Activity.create({
    ...req.body,
    actorId: req.user ? req.user._id : req.body.actorId,
    organizationId: req.user?.organizationId,
    timestamp: new Date()
  });

  const populated = await Activity.findById(activity._id)
    .populate('actorId', 'name email avatar avatarBg')
    .populate('datasetId', 'name');

  res.status(201).json({
    success: true,
    data: populated,
  });
});

module.exports = {
  getActivities,
  getActivityCount,
  createActivity,
};