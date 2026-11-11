const mongoose = require('mongoose');

const urlSchema = new mongoose.Schema({
  originalUrl: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2048,
    validate: {
      validator: (v) => /^https?:\/\/\S+$/i.test(v),
      message: 'originalUrl must start with http:// or https://'
    }
  },
  shortId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true,
    minlength: 3,
    maxlength: 20,
    match: /^[a-zA-Z0-9_-]+$/
  },
  shortUrl: {
    type: String,
    required: true,
    maxlength: 4096
  },
  clicks: { type: Number, default: 0, min: 0 },
  clickData: [{
    timestamp: { type: Date, default: Date.now },
    ipAddress: { type: String, maxlength: 64 },
    userAgent: { type: String, maxlength: 512 },
    referrer: { type: String, maxlength: 512 }
  }],
  isCustom: { type: Boolean, default: false },
  expiresAt: { type: Date, default: null },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

urlSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Url', urlSchema);