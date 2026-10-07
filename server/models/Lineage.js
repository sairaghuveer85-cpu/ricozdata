const mongoose = require('mongoose');

const lineageNodeSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: { type: String, default: 'dataset' },
  position: { x: Number, y: Number },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({})
  }
});

const lineageEdgeSchema = new mongoose.Schema({
  id: { type: String, required: true },
  source: { type: String, required: true },
  target: { type: String, required: true },
  animated: { type: Boolean, default: false },
  style: { type: mongoose.Schema.Types.Mixed },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({})
  }
});

const lineageSchema = new mongoose.Schema({
  datasetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dataset', required: true, unique: true },
  nodes: [lineageNodeSchema],
  edges: [lineageEdgeSchema],
  sourceDatasets: [{ type: String }],
  destinationDatasets: [{ type: String }],
  transformationInfo: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

lineageSchema.pre('save', function() {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model('Lineage', lineageSchema);