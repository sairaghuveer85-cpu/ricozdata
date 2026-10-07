const mongoose = require('mongoose');

const domainSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  icon: { type: String, default: 'Globe' },
  color: { type: String, default: 'bg-blue-600' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Domain', domainSchema);