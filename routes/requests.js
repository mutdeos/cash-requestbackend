const express = require('express');
const Request = require('../models/Request');
const User = require('../models/User');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');
const multer = require('multer'); // For file uploads
const path = require('path');
const emailService = require('../services/emailService');
const pushNotificationService = require('../services/pushNotificationService');
const { generateBulkPaymentReference, generateIndividualReference } = require('../utils/referenceGenerator');
const router = express.Router();

// Helper function to recursively convert all Date objects to ISO strings and ObjectIds to strings
// This ensures mobile apps and frontend get proper string formats
const convertDatesToStrings = (obj) => {
  if (!obj) return obj;

  // Handle primitive types
  if (typeof obj !== 'object') return obj;

  // Handle Date objects
  if (obj instanceof Date) {
    return obj.toISOString();
  }

  // Handle MongoDB ObjectId (check if it has toHexString method)
  if (obj.toHexString && typeof obj.toHexString === 'function') {
    return obj.toHexString();
  }

  // Handle Arrays
  if (Array.isArray(obj)) {
    return obj.map(item => convertDatesToStrings(item));
  }

  // Handle Objects
  const result = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      result[key] = convertDatesToStrings(obj[key]);
    }
  }
  return result;
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/documents/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname))
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Accept common document formats
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb('Error: Only document files are allowed!');
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Get approval order (stored in admin's document)
router.get('/approval-order', auth, async (req, res) => {
  try {
    const admin = await User.findOne({ role: 'admin' });
    res.json(admin.approvalOrder || ['direct_manager', 'finance', 'managing_director', 'ceo']);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching approval order', error: error.message });
  }
});

// Set approval order (admin only)
router.post('/approval-order', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Unauthorized' });
    const { order } = req.body;
    const admin = await User.findOneAndUpdate({ role: 'admin' }, { approvalOrder: order }, { new: true });
    res.json({ message: 'Approval order updated', order: admin.approvalOrder });
  } catch (error) {
    res.status(500).json({ message: 'Error updating approval order', error: error.message });
  }
});

// Create request with file uploads
router.post('/', auth, upload.fields([
  { name: 'invoice', maxCount: 1 },
  { name: 'contract', maxCount: 1 },
  { name: 'otherDocuments', maxCount: 5 }
]), async (req, res) => {
  try {
    const {
      amount,
      purpose,
      supplier,
      beneficiaryAccount,
      preferredPaymentDate,
      priority,
      paymentMethod
    } = req.body;

    // Get user's department
    const user = await User.findById(req.user.id);

    // Process uploaded files
    const attachments = {};
    if (req.files) {
      if (req.files.invoice) attachments.invoice = req.files.invoice[0].path;
      if (req.files.contract) attachments.contract = req.files.contract[0].path;
      if (req.files.otherDocuments) {
        attachments.otherDocuments = req.files.otherDocuments.map(file => file.path);
      }
    }

    const request = new Request({
      requester: req.user.id,
      amount: parseFloat(amount),
      purpose,
      department: user.department,
      supplier: supplier ? supplier : 'N/A',
      beneficiaryAccount: beneficiaryAccount || '',
      preferredPaymentDate: new Date(preferredPaymentDate),
      priority,
      paymentMethod,
      attachments,
      currentStep: 0,
      approvalPath: []
    });
    
    await request.save();
    await routeRequest(request, req.io);
    
    const populatedRequest = await Request.findById(request._id)
      .populate('requester approvalPath.approver financeReview.reviewedBy mdReview.reviewedBy');
    res.json({ message: 'Request created successfully', request: populatedRequest });
  } catch (error) {
    res.status(500).json({ message: 'Error creating request', error: error.message });
  }
});

// Get user-specific requests
router.get('/my-requests', auth, async (req, res) => {
  try {
    const requests = await Request.find({ requester: req.user.id })
      .populate('requester approvalPath.approver financeReview.reviewedBy mdReview.reviewedBy')
      .sort({ createdAt: -1 });
    const sanitizedRequests = requests.map(req => convertDatesToStrings(req.toObject()));
    res.json(sanitizedRequests);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching requests', error: error.message });
  }
});

// Get pending approvals for current user
router.get('/pending', auth, async (req, res) => {
  try {
    const requests = await Request.find({
      'approvalPath': { $elemMatch: { approver: req.user.id, status: 'pending' } }
    }).populate('requester approvalPath.approver financeReview.reviewedBy mdReview.reviewedBy')
      .sort({ createdAt: -1 });

    // Filter out requests with null/deleted requesters
    const validRequests = requests.filter(req => req.requester !== null);

    const sanitizedRequests = validRequests.map(req => convertDatesToStrings(req.toObject()));
    res.json(sanitizedRequests);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching pending requests', error: error.message });
  }
});

// Get requests approved by current user
router.get('/my-approvals', auth, async (req, res) => {
  try {
    const requests = await Request.find({
      'approvalPath': { $elemMatch: { approver: req.user.id, status: 'approved' } }
    }).populate('requester approvalPath.approver financeReview.reviewedBy mdReview.reviewedBy')
      .sort({ createdAt: -1 });

    // Filter out requests with null/deleted requesters
    const validRequests = requests.filter(req => req.requester !== null);

    const sanitizedRequests = validRequests.map(req => convertDatesToStrings(req.toObject()));
    res.json(sanitizedRequests);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching approved requests', error: error.message });
  }
});

// Get all approved requests (for finance, general manager, CEO)
router.get('/approved', auth, async (req, res) => {
  try {
    if (!['finance', 'managing_director', 'ceo'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    const requests = await Request.find({ status: 'approved' })
      .populate('requester approvalPath.approver financeReview.reviewedBy mdReview.reviewedBy')
      .sort({ createdAt: -1 });
    const sanitizedRequests = requests.map(req => convertDatesToStrings(req.toObject()));
    res.json(sanitizedRequests);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching approved requests', error: error.message });
  }
});

// Get all requests (for authorized roles)
router.get('/requests', auth, async (req, res) => {
  try {
    if (!['finance', 'managing_director', 'ceo', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    const requests = await Request.find()
      .populate('requester approvalPath.approver financeReview.reviewedBy mdReview.reviewedBy')
      .sort({ createdAt: -1 });
    const sanitizedRequests = requests.map(req => convertDatesToStrings(req.toObject()));
    res.json(sanitizedRequests);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching requests', error: error.message });
  }
});

// Approve/reject request with role-specific fields
router.post('/:id/action', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { approve, ...reviewData } = req.body;
    const request = await Request.findById(id);
    
    if (!request || request.status !== 'pending') {
      return res.status(404).json({ message: 'Request not found or not pending' });
    }

    // Find the current pending approval for this user
    const currentPathIndex = request.approvalPath.findIndex(
      path => path.approver.toString() === req.user.id && path.status === 'pending'
    );
    
    if (currentPathIndex === -1) {
      return res.status(403).json({ message: 'Unauthorized - no pending approval found for this user' });
    }

    const currentPath = request.approvalPath[currentPathIndex];
    currentPath.status = approve ? 'approved' : 'rejected';
    currentPath.timestamp = new Date();
    
    // Add role-specific review data
    if (approve && req.user.role === 'finance') {
      request.financeReview = {
        treasuryStatus: reviewData.treasuryStatus,
        budgetAvailable: reviewData.budgetAvailable,
        cashflowImpact: reviewData.cashflowImpact,
        comments: reviewData.comments,
        reviewedBy: req.user.id,
        reviewedAt: new Date()
      };
    }
    
    if (approve && req.user.role === 'managing_director') {
      request.mdReview = {
        operationalNeedConfirmed: reviewData.operationalNeedConfirmed,
        approvedAmount: reviewData.approvedAmount || request.amount,
        comments: reviewData.comments,
        reviewedBy: req.user.id,
        reviewedAt: new Date()
      };
    }
    
    if (!approve) {
      request.status = 'rejected';

      // Get requester and approver info for email
      const requester = await User.findById(request.requester);
      const approver = await User.findById(req.user.id);

      await createNotification(
        request.requester,
        `Your request for RF${request.amount} was rejected.`,
        req.io,
        'rejection',
        request._id
      );

      // Send rejection email
      await emailService.sendRejectionNotification(
        requester.email,
        approver.name,
        req.user.role,
        request.amount,
        request.purpose,
        reviewData.comments,
        request._id
      );
    } else {
      // Get approver info for email
      const approver = await User.findById(req.user.id);
      const requester = await User.findById(request.requester);

      await createNotification(
        request.requester,
        `Your request for RF${request.amount} was approved by ${approver.name}.`,
        req.io,
        'approval',
        request._id
      );

      // Send approval email
      await emailService.sendApprovalNotification(
        requester.email,
        approver.name,
        req.user.role,
        request.amount,
        request.purpose,
        request._id
      );

      request.currentStep++;
      await routeRequest(request, req.io);
    }
    
    await request.save();
    res.json({ 
      message: `Request ${approve ? 'approved' : 'rejected'} successfully`,
      request: await Request.findById(id)
        .populate('requester approvalPath.approver financeReview.reviewedBy mdReview.reviewedBy')
    });
  } catch (error) {
    res.status(500).json({ message: 'Error processing request action', error: error.message });
  }
});

// Bulk settle multiple requests (MUST come before /:id/settle to avoid route conflicts)
router.post('/bulk/settle', auth, async (req, res) => {
  try {
    if (req.user.role !== 'finance') {
      return res.status(403).json({ message: 'Unauthorized - Only Finance can settle payments' });
    }

    const { requestIds, paymentReference, paymentDate } = req.body;

    // Validate input
    if (!requestIds || !Array.isArray(requestIds) || requestIds.length === 0) {
      return res.status(400).json({ message: 'Request IDs array is required and must not be empty' });
    }

    // Generate bulk reference if not provided
    const bulkReference = paymentReference || generateBulkPaymentReference();
    const settlementDate = paymentDate ? new Date(paymentDate) : new Date();

    // Track results
    const results = {
      successful: [],
      failed: [],
      totalProcessed: requestIds.length
    };

    // Process each request
    for (let i = 0; i < requestIds.length; i++) {
      const requestId = requestIds[i];

      try {
        const request = await Request.findById(requestId);

        if (!request) {
          results.failed.push({
            requestId,
            reason: 'Request not found'
          });
          continue;
        }

        if (request.status !== 'approved') {
          results.failed.push({
            requestId,
            reason: 'Request must be approved before settlement'
          });
          continue;
        }

        if (request.settlementStatus === 'paid') {
          results.failed.push({
            requestId,
            reason: 'Request has already been settled'
          });
          continue;
        }

        // Generate individual reference for this request within the bulk
        const individualReference = generateIndividualReference(bulkReference, i + 1);

        // Update settlement details
        request.settlementStatus = 'paid';
        request.paymentReference = individualReference;
        request.paymentDate = settlementDate;
        request.settledBy = req.user.id;
        request.settledAt = new Date();

        await request.save();

        // Notify requester of settlement completion
        const requester = await User.findById(request.requester);

        // Create notification
        await createNotification(
          request.requester,
          `Your request for RF${request.amount} has been settled. Payment reference: ${individualReference}`,
          req.io,
          'general',
          request._id
        );

        // Send settlement confirmation email
        if (requester && requester.email) {
          await emailService.sendFinalApprovalNotification(
            requester.email,
            request.amount,
            `${request.purpose} - Settlement completed with reference: ${individualReference}`,
            request._id
          );
        }

        results.successful.push({
          requestId,
          reference: individualReference,
          amount: request.amount
        });

      } catch (error) {
        results.failed.push({
          requestId,
          reason: error.message
        });
      }
    }

    // Determine response status based on results
    const allSuccessful = results.failed.length === 0;
    const allFailed = results.successful.length === 0;

    const statusCode = allSuccessful ? 200 : allFailed ? 400 : 207; // 207 = Multi-Status

    res.status(statusCode).json({
      message: allSuccessful
        ? 'All payments settled successfully'
        : allFailed
          ? 'All payments failed to settle'
          : 'Some payments settled successfully',
      bulkReference,
      results
    });

  } catch (error) {
    res.status(500).json({ message: 'Error processing bulk settlement', error: error.message });
  }
});

// Finance settlement endpoint - confirm payment (individual request)
router.post('/:id/settle', auth, async (req, res) => {
  try {
    if (req.user.role !== 'finance') {
      return res.status(403).json({ message: 'Unauthorized - Only Finance can settle payments' });
    }

    const { id } = req.params;
    const { paymentReference, paymentDate } = req.body;
    const request = await Request.findById(id);

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (request.status !== 'approved') {
      return res.status(400).json({ message: 'Request must be approved before settlement' });
    }

    if (request.settlementStatus === 'paid') {
      return res.status(400).json({ message: 'Request has already been settled' });
    }

    // Update settlement details
    request.settlementStatus = 'paid';
    request.paymentReference = paymentReference;
    request.paymentDate = paymentDate ? new Date(paymentDate) : new Date();
    request.settledBy = req.user.id;
    request.settledAt = new Date();

    await request.save();

    // Notify requester of settlement completion
    const requester = await User.findById(request.requester);
    await createNotification(
      request.requester,
      `Your request for RF${request.amount} has been settled. Payment reference: ${paymentReference}`,
      req.io,
      'general',
      request._id
    );

    // Send settlement confirmation email
    // Note: You may want to create a new email template for this
    await emailService.sendFinalApprovalNotification(
      requester.email,
      request.amount,
      `${request.purpose} - Settlement completed with reference: ${paymentReference}`,
      request._id
    );

    const populatedRequest = await Request.findById(id)
      .populate('requester approvalPath.approver financeReview.reviewedBy mdReview.reviewedBy settledBy');

    res.json({
      message: 'Payment settled successfully',
      request: populatedRequest
    });
  } catch (error) {
    res.status(500).json({ message: 'Error settling payment', error: error.message });
  }
});

// Get single request by ID (MUST come after specific routes to avoid conflicts)
router.get('/:id', auth, async (req, res) => {
  try {
    const request = await Request.findById(req.params.id)
      .populate('requester approvalPath.approver financeReview.reviewedBy mdReview.reviewedBy settledBy');

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    // Check if user has permission to view this request
    const isRequester = request.requester && request.requester._id.toString() === req.user.id;
    const isApprover = request.approvalPath.some(ap => ap.approver && ap.approver._id.toString() === req.user.id);
    const hasElevatedRole = ['admin', 'finance', 'hod', 'managing_director', 'ceo'].includes(req.user.role);

    if (!isRequester && !isApprover && !hasElevatedRole) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Convert the request to a plain object and ensure ALL dates are strings
    const requestObj = request.toObject();
    const sanitizedRequest = convertDatesToStrings(requestObj);
    res.json(sanitizedRequest);
  } catch (error) {
    console.error('Error fetching request:', error);
    res.status(500).json({ message: 'Error fetching request', error: error.message });
  }
});

// Helper function to check if CEO approval is required based on amount
function requiresCEOApproval(amount) {
  return amount >= 100000;
}

// Helper function to check if a user has already approved this request
function hasAlreadyApproved(request, userId) {
  return request.approvalPath.some(
    path => path.approver.toString() === userId.toString() &&
            (path.status === 'approved' || path.status === 'pending')
  );
}

// Helper function to route requests through approval process (manager-chain based)
async function routeRequest(request, io) {
  try {
    const requester = await User.findById(request.requester);
    const needsCEO = requiresCEOApproval(request.amount);
    const ceoUser = await User.findOne({ role: 'ceo' });

    // Debug logging
    console.log('=== routeRequest Debug ===');
    console.log('Amount:', request.amount, 'Type:', typeof request.amount);
    console.log('needsCEO:', needsCEO);
    console.log('approvalPath length:', request.approvalPath.length);

    // Determine who should be the next approver
    // If this is a new request (no approvals yet), start with requester's manager
    // Otherwise, get the last approver and find their manager
    let nextApprover = null;

    if (request.approvalPath.length === 0) {
      // New request - route to requester's direct manager
      if (requester.manager) {
        nextApprover = await User.findById(requester.manager);
      }
    } else {
      // Find the last person who approved and get their manager
      const lastApproval = request.approvalPath[request.approvalPath.length - 1];
      const lastApprover = await User.findById(lastApproval.approver);

      if (lastApprover && lastApprover.manager) {
        nextApprover = await User.findById(lastApprover.manager);
      }
    }

    // Check if next approver is CEO and if CEO approval is actually needed
    // If amount < 500K and next approver is CEO, skip CEO and mark as approved
    const nextApproverIsCEO = nextApprover && ceoUser &&
                              nextApprover._id.toString() === ceoUser._id.toString();

    console.log('nextApprover:', nextApprover ? nextApprover.name : 'null');
    console.log('nextApproverIsCEO:', nextApproverIsCEO);
    console.log('Should skip CEO?', nextApproverIsCEO && !needsCEO);

    if (nextApproverIsCEO && !needsCEO) {
      // Amount is below threshold - don't send to CEO, mark as approved
      console.log('Skipping CEO - amount below threshold');
      nextApprover = null;
    }

    // Determine if we've reached the end of the approval chain
    const reachedEndOfChain = !nextApprover ||
                              nextApprover._id.toString() === requester._id.toString();

    if (reachedEndOfChain) {
      // Check if CEO approval is still needed (for high amounts where CEO hasn't approved)
      const ceoHasApproved = ceoUser ? hasAlreadyApproved(request, ceoUser._id) : false;

      if (needsCEO && ceoUser && !ceoHasApproved &&
          requester._id.toString() !== ceoUser._id.toString()) {
        // Route to CEO for final approval on high-value requests
        nextApprover = ceoUser;
      } else {
        // All approvals complete - mark as approved
        request.status = 'approved';

        // Notify Finance for settlement
        const financeUser = await User.findOne({ role: 'finance' });
        if (financeUser) {
          await createNotification(
            financeUser._id,
            `Request from ${requester.name} for RF${request.amount} is fully approved. Proceed with settlement.`,
            io,
            'new_request',
            request._id
          );

          await emailService.sendNewRequestNotification(
            financeUser.email,
            requester.name,
            request.amount,
            request.purpose,
            request._id
          );
        }

        // Notify Requester of full approval
        await createNotification(
          request.requester,
          `Great news! Your request for RF${request.amount} has been fully approved and sent to Finance for settlement.`,
          io,
          'final_approval',
          request._id
        );

        await emailService.sendFinalApprovalNotification(
          requester.email,
          request.amount,
          request.purpose,
          request._id
        );

        // Notify CEO about disbursement (if CEO exists and wasn't the requester)
        if (ceoUser && requester._id.toString() !== ceoUser._id.toString()) {
          await createNotification(ceoUser._id,
            `A cash request of RF${request.amount} by ${requester.name} has been approved and disbursed`,
            io,
            'final_approval',
            request._id
          );
        }

        await request.save();
        return;
      }
    }

    // Route to the next approver
    if (nextApprover && nextApprover._id.toString() !== requester._id.toString()) {
      request.approvalPath.push({
        approver: nextApprover._id,
        role: nextApprover.role, // Store role for reference only
        status: 'pending',
        timestamp: new Date()
      });

      await createNotification(
        nextApprover._id,
        `New approval request from ${requester.name} for RF${request.amount} awaits your review.`,
        io,
        'new_request',
        request._id
      );

      await emailService.sendNewRequestNotification(
        nextApprover.email,
        requester.name,
        request.amount,
        request.purpose,
        request._id
      );
    } else {
      // No valid approver found (requester has no manager assigned)
      request.status = 'rejected';
      await createNotification(
        request.requester,
        `Your request could not be routed for approval. No manager assigned. Please contact your administrator.`,
        io,
        'error'
      );
    }

    await request.save();
  } catch (error) {
    console.error('Error in routeRequest:', error);
  }
}

// Helper function to create and emit notifications
async function createNotification(userId, message, io, type = 'general', relatedRequest = null) {
  try {
    const notification = new Notification({
      user: userId,
      message,
      type,
      relatedRequest,
      read: false,
      emailSent: false,
      timestamp: new Date()
    });
    await notification.save();

    // Emit notification to all connected clients (they can filter on frontend)
    if (io) {
      io.emit('notification', {
        userId: userId.toString(),
        id: notification._id,
        message: notification.message,
        type: notification.type,
        relatedRequest: notification.relatedRequest,
        timestamp: notification.timestamp,
        read: notification.read
      });
    }

    // Send push notification to mobile app
    try {
      let title = 'Cash Request Update';

      // Customize title based on notification type
      switch (type) {
        case 'new_request':
          title = 'New Cash Request';
          break;
        case 'approval':
          title = 'Request Approved';
          break;
        case 'rejection':
          title = 'Request Rejected';
          break;
        case 'final_approval':
          title = 'Request Fully Approved';
          break;
        default:
          title = 'Cash Request Update';
      }

      await pushNotificationService.sendPushNotification(
        userId,
        title,
        message,
        {
          type,
          requestId: relatedRequest?.toString() || '',
          notificationId: notification._id.toString()
        }
      );
    } catch (pushError) {
      console.error('Error sending push notification:', pushError);
      // Don't fail the whole notification if push fails
    }

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}

// Send reminder to current pending approver
router.post('/:id/remind', auth, async (req, res) => {
  try {
    const request = await Request.findById(req.params.id)
      .populate('requester')
      .populate('approvalPath.approver');

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    // Only the requester can send reminders
    if (request.requester._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the requester can send reminders' });
    }

    // Can only remind for pending requests
    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Can only send reminders for pending requests' });
    }

    // Find the current pending approver
    const pendingApproval = request.approvalPath.find(ap => ap.status === 'pending');
    if (!pendingApproval || !pendingApproval.approver) {
      return res.status(400).json({ message: 'No pending approver found' });
    }

    const approver = pendingApproval.approver;

    // Calculate days pending
    const daysPending = Math.floor((new Date() - new Date(pendingApproval.timestamp)) / (1000 * 60 * 60 * 24));

    // Send reminder email
    await emailService.sendReminderNotification(
      approver.email,
      request.requester.name,
      request.amount,
      request.purpose,
      request._id.toString(),
      daysPending
    );

    // Create notification for the approver
    await createNotification(
      approver._id,
      `Reminder: ${request.requester.name} is waiting for your approval on a cash request of RF${request.amount.toLocaleString()}`,
      req.io,
      'new_request',
      request._id
    );

    res.json({ message: 'Reminder sent successfully', approverName: approver.name });
  } catch (error) {
    console.error('Error sending reminder:', error);
    res.status(500).json({ message: 'Error sending reminder', error: error.message });
  }
});

// Cancel a pending request (requester only)
router.post('/:id/cancel', auth, async (req, res) => {
  try {
    const request = await Request.findById(req.params.id)
      .populate('requester')
      .populate('approvalPath.approver');

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    // Only the requester can cancel their own requests
    if (request.requester._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the requester can cancel this request' });
    }

    // Can only cancel pending requests
    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Can only cancel pending requests' });
    }

    // Update request status to cancelled (using rejected status with a flag)
    request.status = 'rejected';
    request.settlementStatus = 'cancelled';
    request.cancelledBy = req.user.id;
    request.cancelledAt = new Date();

    // Mark all pending approvals as cancelled
    request.approvalPath.forEach(ap => {
      if (ap.status === 'pending') {
        ap.status = 'cancelled';
      }
    });

    await request.save();

    // Notify all approvers who had pending approvals
    const pendingApprovers = request.approvalPath.filter(ap => ap.status === 'cancelled' && ap.approver);
    for (const approval of pendingApprovers) {
      const approver = approval.approver;

      // Send cancellation email
      await emailService.sendCancellationNotification(
        approver.email,
        request.requester.name,
        request.amount,
        request.purpose,
        request._id.toString()
      );

      // Create notification
      await createNotification(
        approver._id,
        `Cash request of RF${request.amount.toLocaleString()} by ${request.requester.name} has been cancelled by the requester`,
        req.io,
        'general',
        request._id
      );
    }

    const populatedRequest = await Request.findById(request._id)
      .populate('requester approvalPath.approver financeReview.reviewedBy mdReview.reviewedBy');

    res.json({ message: 'Request cancelled successfully', request: populatedRequest });
  } catch (error) {
    console.error('Error cancelling request:', error);
    res.status(500).json({ message: 'Error cancelling request', error: error.message });
  }
});

// Download attachment endpoint
router.get('/attachment/:requestId/:type', auth, async (req, res) => {
  try {
    const { requestId, type } = req.params;
    const request = await Request.findById(requestId);
    
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }
    
    // Check if user has permission to view this request
    const isAuthorized = request.requester.toString() === req.user.id ||
                        request.approvalPath.some(path => path.approver.toString() === req.user.id) ||
                        ['finance', 'managing_director', 'ceo', 'admin'].includes(req.user.role);
    
    if (!isAuthorized) {
      return res.status(403).json({ message: 'Unauthorized to access this attachment' });
    }
    
    let filePath;
    if (type === 'invoice' && request.attachments.invoice) {
      filePath = request.attachments.invoice;
    } else if (type === 'contract' && request.attachments.contract) {
      filePath = request.attachments.contract;
    } else if (type.startsWith('other-') && request.attachments.otherDocuments) {
      const index = parseInt(type.split('-')[1]);
      filePath = request.attachments.otherDocuments[index];
    }
    
    if (!filePath) {
      return res.status(404).json({ message: 'Attachment not found' });
    }
    
    res.download(filePath);
  } catch (error) {
    res.status(500).json({ message: 'Error downloading attachment', error: error.message });
  }
});

module.exports = router;