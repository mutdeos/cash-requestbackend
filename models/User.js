const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['admin', 'employee', 'direct_manager', 'hod', 'managing_director', 'finance', 'ceo'], required: true },
  manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  department: {type: String, required: true},
  fcmTokens: [{ type: String }] // Array to support multiple devices
});

module.exports = mongoose.model('User', userSchema);