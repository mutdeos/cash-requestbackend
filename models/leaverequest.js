const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema({
  requester: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  leaveType: { 
    type: String, 
    enum: ['Annual', 'Sick', 'Maternity', 'Paternity', 'Unpaid', 'Other'], 
    required: true 
  },
  startDate: { 
    type: Date, 
    required: true 
  },
  endDate: { 
    type: Date, 
    required: true 
  },
  reason: { 
    type: String, 
    required: true 
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  // Simple approval path for leave (usually just the direct manager)
  approvedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  approvalNotes: { 
    type: String 
  }
}, { 
  timestamps: true 
});

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);