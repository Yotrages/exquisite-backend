const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  ip: { type: String },
  message: { type: String, required: true }, // redacted message
  response: { type: String, required: true }, // redacted response
  source: { type: String, enum: ['openai', 'rule-based', 'fallback'], default: 'rule-based' },
  metadata: { type: mongoose.Schema.Types.Mixed },
  redacted: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);