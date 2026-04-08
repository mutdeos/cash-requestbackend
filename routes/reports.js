const express = require('express');
const Request = require('../models/Request');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

// These will be available once packages are installed
// Run: npm install pdfkit exceljs
let PDFDocument, ExcelJS;
try {
  PDFDocument = require('pdfkit');
  ExcelJS = require('exceljs');
} catch (err) {
  console.log('PDF/Excel export packages not installed. Run: npm install pdfkit exceljs');
}

// Comprehensive reporting endpoint with filters
router.get('/requests', auth, async (req, res) => {
  try {
    // Check authorization - Only Finance, MD, CEO, and Admin can access reports
    if (!['finance', 'managing_director', 'ceo', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Unauthorized - Reports are only available to Management and Finance' });
    }

    // Extract query parameters for filtering
    const {
      startDate,
      endDate,
      minAmount,
      maxAmount,
      department,
      requester,
      status,
      priority,
      paymentMethod,
      settlementStatus,
      page = 1,
      limit = 50
    } = req.query;

    // Build query object
    const query = {};

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Amount range filter
    if (minAmount || maxAmount) {
      query.amount = {};
      if (minAmount) query.amount.$gte = parseFloat(minAmount);
      if (maxAmount) query.amount.$lte = parseFloat(maxAmount);
    }

    // Department filter
    if (department) {
      query.department = department;
    }

    // Requester filter
    if (requester) {
      query.requester = requester;
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    // Priority filter
    if (priority) {
      query.priority = priority;
    }

    // Payment method filter
    if (paymentMethod) {
      query.paymentMethod = paymentMethod;
    }

    // Settlement status filter
    if (settlementStatus) {
      query.settlementStatus = settlementStatus;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query with pagination
    const requests = await Request.find(query)
      .populate('requester approvalPath.approver financeReview.reviewedBy mdReview.reviewedBy settledBy')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalCount = await Request.countDocuments(query);

    res.json({
      requests,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalRecords: totalCount,
        recordsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating report', error: error.message });
  }
});

// Analytics endpoint - aggregated statistics
router.get('/analytics', auth, async (req, res) => {
  try {
    // Check authorization
    if (!['finance', 'managing_director', 'ceo', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const { startDate, endDate } = req.query;
    const dateFilter = {};

    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Total requests by status
    const statusBreakdown = await Request.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } }
    ]);

    // Requests by department
    const departmentBreakdown = await Request.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$department', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } }
    ]);

    // Requests by priority
    const priorityBreakdown = await Request.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$priority', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } }
    ]);

    // Settlement status breakdown
    const settlementBreakdown = await Request.aggregate([
      { $match: { ...dateFilter, status: 'approved' } },
      { $group: { _id: '$settlementStatus', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } }
    ]);

    // Average approval time (for approved requests)
    const approvalTimeStats = await Request.aggregate([
      { $match: { ...dateFilter, status: 'approved' } },
      {
        $project: {
          approvalTime: {
            $subtract: ['$updatedAt', '$createdAt']
          }
        }
      },
      {
        $group: {
          _id: null,
          avgApprovalTime: { $avg: '$approvalTime' },
          minApprovalTime: { $min: '$approvalTime' },
          maxApprovalTime: { $max: '$approvalTime' }
        }
      }
    ]);

    // Total amounts
    const totalStats = await Request.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalRequested: { $sum: '$amount' },
          totalApproved: {
            $sum: {
              $cond: [{ $eq: ['$status', 'approved'] }, '$amount', 0]
            }
          },
          totalRejected: {
            $sum: {
              $cond: [{ $eq: ['$status', 'rejected'] }, '$amount', 0]
            }
          },
          totalPending: {
            $sum: {
              $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0]
            }
          }
        }
      }
    ]);

    res.json({
      statusBreakdown,
      departmentBreakdown,
      priorityBreakdown,
      settlementBreakdown,
      approvalTimeStats: approvalTimeStats[0] || {},
      totalStats: totalStats[0] || {}
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating analytics', error: error.message });
  }
});

// PDF Export endpoint
router.get('/export/pdf', auth, async (req, res) => {
  try {
    if (!['finance', 'managing_director', 'ceo', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    if (!PDFDocument) {
      return res.status(503).json({ message: 'PDF export not available. Please install pdfkit package.' });
    }

    // Get filtered requests (same filters as reporting endpoint)
    const {
      startDate,
      endDate,
      minAmount,
      maxAmount,
      department,
      status,
      priority
    } = req.query;

    const query = {};
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    if (minAmount || maxAmount) {
      query.amount = {};
      if (minAmount) query.amount.$gte = parseFloat(minAmount);
      if (maxAmount) query.amount.$lte = parseFloat(maxAmount);
    }
    if (department) query.department = department;
    if (status) query.status = status;
    if (priority) query.priority = priority;

    const requests = await Request.find(query)
      .populate('requester approvalPath.approver settledBy')
      .sort({ createdAt: -1 });

    // Create PDF document
    const doc = new PDFDocument({ margin: 50 });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=cash-requests-report-${Date.now()}.pdf`);

    // Pipe PDF to response
    doc.pipe(res);

    // Add title
    doc.fontSize(20).text('Cash Requisition Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(2);

    // Add summary statistics
    doc.fontSize(14).text('Summary', { underline: true });
    doc.moveDown();
    doc.fontSize(10);
    doc.text(`Total Requests: ${requests.length}`);
    const totalAmount = requests.reduce((sum, req) => sum + req.amount, 0);
    doc.text(`Total Amount: RF${totalAmount.toLocaleString()}`);
    const approvedCount = requests.filter(r => r.status === 'approved').length;
    doc.text(`Approved: ${approvedCount}`);
    const rejectedCount = requests.filter(r => r.status === 'rejected').length;
    doc.text(`Rejected: ${rejectedCount}`);
    const pendingCount = requests.filter(r => r.status === 'pending').length;
    doc.text(`Pending: ${pendingCount}`);
    doc.moveDown(2);

    // Add requests table
    doc.fontSize(14).text('Requests Details', { underline: true });
    doc.moveDown();

    requests.forEach((request, index) => {
      if (doc.y > 700) {
        doc.addPage();
      }

      doc.fontSize(10);
      doc.text(`${index + 1}. Request ID: ${request._id}`, { continued: false });
      doc.text(`   Requester: ${request.requester ? request.requester.name : 'N/A'}`);
      doc.text(`   Department: ${request.department}`);
      doc.text(`   Amount: RF${request.amount.toLocaleString()}`);
      doc.text(`   Purpose: ${request.purpose}`);
      doc.text(`   Status: ${request.status.toUpperCase()}`);
      doc.text(`   Priority: ${request.priority}`);
      doc.text(`   Created: ${new Date(request.createdAt).toLocaleDateString()}`);

      // Approval trail
      if (request.approvalPath && request.approvalPath.length > 0) {
        doc.text(`   Approval Trail:`);
        request.approvalPath.forEach((approval, idx) => {
          const approverName = approval.approver ? approval.approver.name : 'N/A';
          doc.text(`      ${idx + 1}. ${approval.role}: ${approverName} - ${approval.status} (${new Date(approval.timestamp).toLocaleDateString()})`);
        });
      }

      // Settlement info
      if (request.status === 'approved') {
        doc.text(`   Settlement: ${request.settlementStatus}`);
        if (request.settlementStatus === 'paid') {
          doc.text(`   Payment Ref: ${request.paymentReference || 'N/A'}`);
          doc.text(`   Payment Date: ${request.paymentDate ? new Date(request.paymentDate).toLocaleDateString() : 'N/A'}`);
        }
      }

      doc.moveDown();
    });

    // Finalize PDF
    doc.end();
  } catch (error) {
    res.status(500).json({ message: 'Error generating PDF export', error: error.message });
  }
});

// Excel Export endpoint
router.get('/export/excel', auth, async (req, res) => {
  try {
    if (!['finance', 'managing_director', 'ceo', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    if (!ExcelJS) {
      return res.status(503).json({ message: 'Excel export not available. Please install exceljs package.' });
    }

    // Get filtered requests
    const {
      startDate,
      endDate,
      minAmount,
      maxAmount,
      department,
      status,
      priority
    } = req.query;

    const query = {};
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    if (minAmount || maxAmount) {
      query.amount = {};
      if (minAmount) query.amount.$gte = parseFloat(minAmount);
      if (maxAmount) query.amount.$lte = parseFloat(maxAmount);
    }
    if (department) query.department = department;
    if (status) query.status = status;
    if (priority) query.priority = priority;

    const requests = await Request.find(query)
      .populate('requester approvalPath.approver settledBy')
      .sort({ createdAt: -1 });

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Cash Request System';
    workbook.created = new Date();

    // Create main worksheet
    const worksheet = workbook.addWorksheet('Requests');

    // Define columns
    worksheet.columns = [
      { header: 'Request ID', key: 'id', width: 25 },
      { header: 'Requester', key: 'requester', width: 20 },
      { header: 'Department', key: 'department', width: 20 },
      { header: 'Amount (RF)', key: 'amount', width: 15 },
      { header: 'Purpose', key: 'purpose', width: 30 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Priority', key: 'priority', width: 10 },
      { header: 'Payment Method', key: 'paymentMethod', width: 15 },
      { header: 'Created Date', key: 'createdAt', width: 15 },
      { header: 'Settlement Status', key: 'settlementStatus', width: 18 },
      { header: 'Payment Reference', key: 'paymentReference', width: 20 },
      { header: 'Payment Date', key: 'paymentDate', width: 15 },
      { header: 'Approval Trail', key: 'approvalTrail', width: 50 }
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Add data rows
    requests.forEach(request => {
      const approvalTrail = request.approvalPath
        .map(a => `${a.role}: ${a.approver ? a.approver.name : 'N/A'} (${a.status})`)
        .join(' → ');

      worksheet.addRow({
        id: request._id.toString(),
        requester: request.requester ? request.requester.name : 'N/A',
        department: request.department,
        amount: request.amount,
        purpose: request.purpose,
        status: request.status.toUpperCase(),
        priority: request.priority,
        paymentMethod: request.paymentMethod,
        createdAt: new Date(request.createdAt).toLocaleDateString(),
        settlementStatus: request.settlementStatus || 'N/A',
        paymentReference: request.paymentReference || 'N/A',
        paymentDate: request.paymentDate ? new Date(request.paymentDate).toLocaleDateString() : 'N/A',
        approvalTrail: approvalTrail || 'No approvals yet'
      });
    });

    // Add summary worksheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 20 }
    ];

    summarySheet.getRow(1).font = { bold: true };
    summarySheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    const totalAmount = requests.reduce((sum, req) => sum + req.amount, 0);
    const approvedCount = requests.filter(r => r.status === 'approved').length;
    const rejectedCount = requests.filter(r => r.status === 'rejected').length;
    const pendingCount = requests.filter(r => r.status === 'pending').length;
    const paidCount = requests.filter(r => r.settlementStatus === 'paid').length;

    summarySheet.addRows([
      { metric: 'Total Requests', value: requests.length },
      { metric: 'Total Amount (RF)', value: totalAmount },
      { metric: 'Approved Requests', value: approvedCount },
      { metric: 'Rejected Requests', value: rejectedCount },
      { metric: 'Pending Requests', value: pendingCount },
      { metric: 'Paid Requests', value: paidCount },
      { metric: 'Report Generated', value: new Date().toLocaleString() }
    ]);

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=cash-requests-report-${Date.now()}.xlsx`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ message: 'Error generating Excel export', error: error.message });
  }
});

module.exports = router;
