const mongoose = require('mongoose');

const complianceFrameworkSchema = new mongoose.Schema({
  identifier: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  version: {
    type: String,
    default: '1.0'
  },
  category: {
    type: String,
    default: 'Privacy & Security',
    index: true
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'DRAFT', 'DEPRECATED', 'ARCHIVED'],
    default: 'ACTIVE',
    index: true
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  controlsCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

complianceFrameworkSchema.pre('save', function() {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model('ComplianceFramework', complianceFrameworkSchema);
