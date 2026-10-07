const Dataset = require('../models/Dataset');
const User = require('../models/User');
const GlossaryTerm = require('../models/GlossaryTerm');
const Policy = require('../models/Policy');
const QualityIssue = require('../models/QualityIssue');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Global search across datasets, users, glossary, policies, quality
// @route   GET /api/search
// @access  Private
const globalSearch = asyncHandler(async (req, res) => {
  const q = req.query.q || '';

  if (!q.trim()) {
    return res.json({
      success: true,
      data: {
        datasets: [],
        users: [],
        glossary: [],
        policies: [],
        quality: [],
      },
    });
  }

  const regex = { $regex: q, $options: 'i' };

  // Search datasets
  const datasets = await Dataset.find({
    $or: [{ name: regex }, { description: regex }, { tags: regex }, { domain: regex }],
  }).limit(5).select('_id name description domain sensitivity quality');

  // Search users
  const users = await User.find({
    $or: [{ name: regex }, { email: regex }, { role: regex }, { department: regex }],
  }).limit(5).select('_id name email role department avatar avatarBg');

  // Search glossary
  const glossary = await GlossaryTerm.find({
    $or: [{ term: regex }, { definition: regex }, { tags: regex }],
  }).limit(5).select('_id term definition domain status');

  // Search policies
  const policies = await Policy.find({
    $or: [{ name: regex }, { description: regex }, { category: regex }],
  }).limit(5).select('_id name description status category');

  // Search quality issues
  const quality = await QualityIssue.find({
    $or: [{ issue: regex }, { field: regex }, { column: regex }],
  }).limit(5).select('_id issue field severity status count');

  res.json({
    success: true,
    data: {
      datasets: datasets.map(d => ({
        id: d._id,
        title: d.name,
        subtitle: `${d.domain} • ${d.quality}% Quality`,
        category: 'Dataset',
        path: `/catalog/${d._id}`
      })),
      users: users.map(u => ({
        id: u._id,
        title: u.name,
        subtitle: `${u.role} • ${u.department}`,
        category: 'User',
        path: `/users`
      })),
      glossary: glossary.map(g => ({
        id: g._id,
        title: g.term,
        subtitle: g.definition.slice(0, 60) + '...',
        category: 'Glossary',
        path: `/glossary`
      })),
      policies: policies.map(p => ({
        id: p._id,
        title: p.name,
        subtitle: `${p.category} • ${p.status}`,
        category: 'Policy',
        path: `/governance`
      })),
      quality: quality.map(q => ({
        id: q._id,
        title: q.issue,
        subtitle: `${q.severity} • ${q.count} records`,
        category: 'Quality Issue',
        path: `/quality`
      })),
    },
  });
});

module.exports = {
  globalSearch,
};