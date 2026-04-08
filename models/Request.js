const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
  requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  purpose: { type: String, required: true },
  department: { type: String, required: true }, // From user's department
  supplier: { type: String, required: false },
  beneficiaryAccount: { type: String, required: false }, // Bank account or Mobile Money number
  preferredPaymentDate: { type: Date, required: true },
  priority: { 
    type: String, 
    enum: ['High', 'Medium', 'Low'], 
    required: true 
  },
  paymentMethod: { 
    type: String, 
    enum: ['Bank Transfer', 'Mobile Money', 'Cash'], 
    required: true 
  },
  
  // Document attachments (optional)
  attachments: {
    invoice: { type: String }, // File path/URL
    contract: { type: String }, // File path/URL
    otherDocuments: [{ type: String }] // Array of file paths/URLs
  },
  
  // Finance manager fields (added when request reaches finance)
  financeReview: {
    treasuryStatus: { type: String },
    budgetAvailable: { type: Boolean },
    cashflowImpact: { type: String },
    comments: { type: String },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date }
  },
  
  // Managing director fields (added when request reaches MD)
  mdReview: {
    operationalNeedConfirmed: { type: Boolean },
    approvedAmount: { type: Number },
    comments: { type: String },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date }
  },
  
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  approvalPath: [{
    approver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String }, // 'direct_manager', 'hod', 'managing_director', 'ceo'
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'auto_approved', 'cancelled'], default: 'pending' },
    timestamp: { type: Date, default: Date.now },
    note: { type: String } // For audit trail when auto-approved
  }],
  currentStep: { type: Number, default: 0 },

  // Cancellation fields (when requester cancels their own request)
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  cancelledAt: { type: Date },

  // Settlement fields (handled by Finance after all approvals)
  settlementStatus: {
    type: String,
    enum: ['pending_payment', 'paid', 'cancelled'],
    default: 'pending_payment'
  },
  paymentDate: { type: Date },
  paymentReference: { type: String },
  settledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  settledAt: { type: Date },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt field before saving
requestSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Request', requestSchema);