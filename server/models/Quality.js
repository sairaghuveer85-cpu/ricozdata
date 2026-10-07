const mongoose = require('mongoose');

const dimensionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  score: { type: Number, default: null },
  status: { type: String, enum: ['ASSESSED', 'NOT_ASSESSED'], default: 'ASSESSED' },
  color: { type: String, default: '#64748b' }
});

const qualitySchema = new mongoose.Schema({
  datasetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dataset', required: true, unique: true },
  score: { type: Number, required: true },
  grade: { type: String, required: true },
  trendText: { type: String },
  trendDirection: { type: String },
  passedRulesCount: { type: Number, default: 0 },
  totalRulesCount: { type: Number, default: 50 },
  dimensions: [dimensionSchema],
  sourceType: { type: String },
  sourceSystem: { type: String },
  lastScanned: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

qualitySchema.pre('save', function() {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model('Quality', qualitySchema);