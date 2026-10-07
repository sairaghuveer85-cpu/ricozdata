const mongoose = require('mongoose');

const sourceColumnRefSchema = new mongoose.Schema(
  {
    datasetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dataset', required: true },
    columnId: { type: mongoose.Schema.Types.ObjectId, required: true },
    columnName: { type: String, required: true },
    datasetName: { type: String, required: true },
    dataType: { type: String },
    isPII: { type: Boolean, default: false },
  },
  { _id: false }
);

const glossarySuggestionSchema = new mongoose.Schema({
  suggestedTerm: { type: String, required: true, trim: true, index: true },
  suggestedDefinition: { type: String, required: true, trim: true },
  suggestedDomainId: { type: mongoose.Schema.Types.ObjectId, ref: 'Domain', index: true },
  suggestedDomain: { type: String, trim: true },
  suggestedTags: [{ type: String, trim: true }],
  suggestedSynonyms: [{ type: String, trim: true }],
  suggestedExamples: [{ type: String, trim: true }],
  suggestedBusinessRules: [{ type: String, trim: true }],

  // Semantic understanding vs Glossary value distinction
  semanticConfidence: { type: Number, min: 0, max: 100, default: 85 },
  glossaryRelevanceScore: { type: Number, min: 0, max: 100, default: 80, index: true },
  definitionConfidence: { type: Number, min: 0, max: 100, default: 75 },
  conceptCategory: {
    type: String,
    enum: [
      'BUSINESS_ENTITY',
      'BUSINESS_ATTRIBUTE',
      'BUSINESS_MEASURE',
      'BUSINESS_METRIC',
      'IDENTIFIER',
      'REFERENCE',
      'STATUS',
      'DATE_ATTRIBUTE',
      'TECHNICAL_METADATA',
      'CLASSIFICATION',
      'OTHER',
    ],
    default: 'BUSINESS_ATTRIBUTE',
    index: true,
  },
  suggestionPriority: {
    type: String,
    enum: ['RECOMMENDED', 'REVIEW', 'LOW_PRIORITY', 'TECHNICAL_METADATA', 'DUPLICATE', 'EXISTING_TERM'],
    default: 'REVIEW',
    index: true,
  },
  classificationAnomaly: { type: String },

  // Entity-Attribute Semantic Hierarchy
  isEntity: { type: Boolean, default: false, index: true },
  parentEntityTerm: { type: String, trim: true, index: true },
  childAttributeTerms: [{ type: String, trim: true }],

  // Backward compatibility alias for confidenceScore and confidenceLevel
  confidenceScore: { type: Number, min: 0, max: 100, required: true, index: true },
  confidenceLevel: {
    type: String,
    enum: ['high', 'medium', 'low'],
    required: true,
    index: true,
  },

  sourceDatasetIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Dataset', index: true }],
  sourceColumnRefs: [sourceColumnRefSchema],

  relatedSuggestionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'GlossarySuggestion' }],
  relatedGlossaryTermIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'GlossaryTerm' }],
  matchedExistingTermId: { type: mongoose.Schema.Types.ObjectId, ref: 'GlossaryTerm' },
  matchType: {
    type: String,
    enum: ['new_term', 'existing_term_link', 'synonym_match'],
    default: 'new_term',
    index: true,
  },

  reasoning: { type: String, required: true },
  detectionMethod: { type: String, default: 'Rule Engine + Catalog Metadata' },

  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'dismissed'],
    default: 'pending',
    index: true,
  },
  rejectionReason: { type: String },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },

  createdTermId: { type: mongoose.Schema.Types.ObjectId, ref: 'GlossaryTerm' },

  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
});

glossarySuggestionSchema.index({ status: 1, confidenceScore: -1 });
glossarySuggestionSchema.index({ suggestedTerm: 1, status: 1 });
glossarySuggestionSchema.index({ suggestedTerm: 'text', suggestedDefinition: 'text', reasoning: 'text' });

module.exports = mongoose.model('GlossarySuggestion', glossarySuggestionSchema);
