const mongoose = require('mongoose');

const columnProfileSchema = new mongoose.Schema({
  field: { type: String, required: true },
  dataType: { type: String, required: true },
  rowCount: { type: Number, required: true },
  nullCount: { type: Number, required: true, default: 0 },
  nullPercentage: { type: Number, required: true, default: 0 },
  distinctCount: { type: Number, required: true, default: 0 },
  duplicateCount: { type: Number, required: true, default: 0 },
  uniquenessRatio: { type: Number, required: true, default: 0 },
  min: { type: mongoose.Schema.Types.Mixed },
  max: { type: mongoose.Schema.Types.Mixed },
  avg: { type: Number },
  stdDev: { type: Number },
  validity: { type: Number, required: true, default: 100 },
  freshness: { type: Number, required: true, default: 100 },
  lastUpdated: { type: Date, default: Date.now }
});

const qualityProfileSchema = new mongoose.Schema({
  datasetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dataset', required: true, unique: true, index: true },
  rowCount: { type: Number, required: true, default: 0 },
  nullCount: { type: Number, required: true, default: 0 },
  nullPercentage: { type: Number, required: true, default: 0 },
  distinctCount: { type: Number, required: true, default: 0 },
  duplicateCount: { type: Number, required: true, default: 0 },
  uniquenessRatio: { type: Number, required: true, default: 0 },
  min: { type: mongoose.Schema.Types.Mixed },
  max: { type: mongoose.Schema.Types.Mixed },
  avg: { type: Number },
  stdDev: { type: Number },
  freshness: { type: Number, required: true, default: 100 },
  validity: { type: Number, required: true, default: 100 },
  columns: [columnProfileSchema],
  lastUpdated: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

qualityProfileSchema.pre('save', function() {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model('QualityProfile', qualityProfileSchema);