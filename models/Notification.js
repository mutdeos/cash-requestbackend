const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  type: {
    type: String,
    enum: ['new_request', 'approval', 'rejection', 'final_approval', 'general'],
    default: 'general'
  },
  relatedRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'Request' },
  read: { type: Boolean, default: false },
  emailSent: { type: Boolean, default: false },
  emailSentAt: { type: Date },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', notificationSchema);