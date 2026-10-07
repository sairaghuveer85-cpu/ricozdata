const mongoose = require('mongoose');

const relatedColumnRefSchema = new mongoose.Schema({
  datasetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dataset', required: true },
  columnId: { type: mongoose.Schema.Types.ObjectId, required: true }
}, { _id: false });

const glossaryTermSchema = new mongoose.Schema({
  term: { type: String, required: true, trim: true, index: true },
  definition: { type: String, required: true, trim: true },
  domainId: { type: mongoose.Schema.Types.ObjectId, ref: 'Domain', index: true },
  domain: { type: String, trim: true, index: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  owner: { type: String, trim: true },
  status: {
    type: String,
    default: 'draft',
    enum: ['draft', 'approved', 'deprecated', 'archived', 'active'],
    index: true
  },
  tags: [{ type: String, trim: true }],
  synonyms: [{ type: String, trim: true }],
  examples: [{ type: String, trim: true }],
  businessRules: [{ type: String, trim: true }],
  relatedDatasetIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Dataset', index: true }],
  relatedColumnRefs: [relatedColumnRefSchema],
  relatedTermIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'GlossaryTerm', index: true }],
  usageCount: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now, index: true }
});

glossaryTermSchema.index({ term: 'text', definition: 'text', synonyms: 'text', tags: 'text' });

module.exports = mongoose.model('GlossaryTerm', glossaryTermSchema);