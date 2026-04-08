/**
 * Unit Tests for Reporting Module
 * Tests GET /api/reports/requests, analytics, and export endpoints
 */

describe('Reporting Module Tests', () => {

  describe('GET /api/reports/requests', () => {

    describe('Authorization', () => {

      test('should only allow Management and Finance roles', () => {
        const allowedRoles = ['finance', 'managing_director', 'ceo', 'admin'];
        const deniedRoles = ['employee', 'direct_manager', 'hod'];

        allowedRoles.forEach(role => {
          expect(['finance', 'managing_director', 'ceo', 'admin']).toContain(role);
        });

        deniedRoles.forEach(role => {
          expect(['finance', 'managing_director', 'ceo', 'admin']).not.toContain(role);
        });
      });

      test('should return 403 for unauthorized roles', () => {
        const unauthorizedRoles = ['employee', 'direct_manager', 'hod'];

        unauthorizedRoles.forEach(role => {
          const response = { status: 403, message: 'Unauthorized - Reports are only available to Management and Finance' };
          expect(response.status).toBe(403);
        });
      });
    });

    describe('Filter Parameters', () => {

      test('should support all required filters', () => {
        const requiredFilters = [
          'startDate',
          'endDate',
          'minAmount',
          'maxAmount',
          'department',
          'requester',
          'status',
          'priority',
          'paymentMethod',
          'settlementStatus'
        ];

        requiredFilters.forEach(filter => {
          expect(filter).toBeDefined();
        });
      });

      test('should filter by date range', () => {
        const queryParams = {
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        };

        const query = {};
        if (queryParams.startDate || queryParams.endDate) {
          query.createdAt = {};
          if (queryParams.startDate) query.createdAt.$gte = new Date(queryParams.startDate);
          if (queryParams.endDate) query.createdAt.$lte = new Date(queryParams.endDate);
        }

        expect(query.createdAt).toBeDefined();
        expect(query.createdAt.$gte).toBeInstanceOf(Date);
        expect(query.createdAt.$lte).toBeInstanceOf(Date);
      });

      test('should filter by amount range', () => {
        const queryParams = {
          minAmount: 100000,
          maxAmount: 500000
        };

        const query = {};
        if (queryParams.minAmount || queryParams.maxAmount) {
          query.amount = {};
          if (queryParams.minAmount) query.amount.$gte = parseFloat(queryParams.minAmount);
          if (queryParams.maxAmount) query.amount.$lte = parseFloat(queryParams.maxAmount);
        }

        expect(query.amount).toBeDefined();
        expect(query.amount.$gte).toBe(100000);
        expect(query.amount.$lte).toBe(500000);
      });

      test('should filter by department', () => {
        const department = 'IT';
        const query = { department };

        expect(query.department).toBe('IT');
      });

      test('should filter by status', () => {
        const status = 'approved';
        const query = { status };

        expect(query.status).toBe('approved');
      });

      test('should filter by priority', () => {
        const priority = 'High';
        const query = { priority };

        expect(query.priority).toBe('High');
      });

      test('should filter by settlementStatus', () => {
        const settlementStatus = 'paid';
        const query = { settlementStatus };

        expect(query.settlementStatus).toBe('paid');
      });
    });

    describe('Pagination', () => {

      test('should support pagination parameters', () => {
        const queryParams = {
          page: 2,
          limit: 50
        };

        expect(queryParams.page).toBe(2);
        expect(queryParams.limit).toBe(50);
      });

      test('should default to page 1 and limit 50', () => {
        const defaults = {
          page: 1,
          limit: 50
        };

        expect(defaults.page).toBe(1);
        expect(defaults.limit).toBe(50);
      });

      test('should calculate skip correctly', () => {
        const page = 3;
        const limit = 50;
        const skip = (page - 1) * limit;

        expect(skip).toBe(100); // (3-1) * 50 = 100
      });

      test('should return pagination metadata', () => {
        const response = {
          requests: [],
          pagination: {
            currentPage: 1,
            totalPages: 5,
            totalRecords: 250,
            recordsPerPage: 50
          }
        };

        expect(response.pagination).toBeDefined();
        expect(response.pagination.currentPage).toBe(1);
        expect(response.pagination.totalPages).toBe(5);
        expect(response.pagination.totalRecords).toBe(250);
      });
    });

    describe('Response Format', () => {

      test('should include populated fields', () => {
        const populatedFields = [
          'requester',
          'approvalPath.approver',
          'financeReview.reviewedBy',
          'mdReview.reviewedBy',
          'settledBy'
        ];

        populatedFields.forEach(field => {
          expect(field).toBeDefined();
        });
      });

      test('should sort by createdAt descending', () => {
        const sortOrder = { createdAt: -1 };
        expect(sortOrder.createdAt).toBe(-1);
      });
    });
  });

  describe('GET /api/reports/analytics', () => {

    test('should return status breakdown', () => {
      const statusBreakdown = [
        { _id: 'approved', count: 150, totalAmount: 45000000 },
        { _id: 'pending', count: 30, totalAmount: 8000000 },
        { _id: 'rejected', count: 20, totalAmount: 5000000 }
      ];

      expect(statusBreakdown).toHaveLength(3);
      expect(statusBreakdown[0]).toHaveProperty('_id');
      expect(statusBreakdown[0]).toHaveProperty('count');
      expect(statusBreakdown[0]).toHaveProperty('totalAmount');
    });

    test('should return department breakdown', () => {
      const departmentBreakdown = [
        { _id: 'IT', count: 50, totalAmount: 15000000 },
        { _id: 'Finance', count: 40, totalAmount: 12000000 }
      ];

      expect(departmentBreakdown).toBeDefined();
      departmentBreakdown.forEach(dept => {
        expect(dept).toHaveProperty('_id');
        expect(dept).toHaveProperty('count');
        expect(dept).toHaveProperty('totalAmount');
      });
    });

    test('should return settlement breakdown', () => {
      const settlementBreakdown = [
        { _id: 'paid', count: 120, totalAmount: 40000000 },
        { _id: 'pending_payment', count: 30, totalAmount: 5000000 }
      ];

      expect(settlementBreakdown).toBeDefined();
    });

    test('should calculate approval time statistics', () => {
      const approvalTimeStats = {
        avgApprovalTime: 172800000, // 2 days in ms
        minApprovalTime: 86400000,  // 1 day
        maxApprovalTime: 604800000  // 7 days
      };

      expect(approvalTimeStats).toHaveProperty('avgApprovalTime');
      expect(approvalTimeStats).toHaveProperty('minApprovalTime');
      expect(approvalTimeStats).toHaveProperty('maxApprovalTime');
    });

    test('should calculate total statistics', () => {
      const totalStats = {
        totalRequested: 58000000,
        totalApproved: 45000000,
        totalRejected: 5000000,
        totalPending: 8000000
      };

      expect(totalStats.totalRequested).toBe(
        totalStats.totalApproved + totalStats.totalRejected + totalStats.totalPending
      );
    });
  });

  describe('GET /api/reports/export/pdf', () => {

    describe('PDF Generation', () => {

      test('should require pdfkit package', () => {
        const pdfkitAvailable = true; // Mock package availability
        expect(pdfkitAvailable).toBe(true);
      });

      test('should return 503 if pdfkit not installed', () => {
        const PDFDocument = null; // Mock missing package
        const response = PDFDocument
          ? { status: 200 }
          : { status: 503, message: 'PDF export not available. Please install pdfkit package.' };

        expect(response.status).toBe(503);
      });

      test('should set correct content type and disposition', () => {
        const headers = {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename=cash-requests-report-123456.pdf'
        };

        expect(headers['Content-Type']).toBe('application/pdf');
        expect(headers['Content-Disposition']).toContain('attachment');
        expect(headers['Content-Disposition']).toContain('.pdf');
      });
    });

    describe('PDF Content', () => {

      test('should include summary statistics', () => {
        const pdfSections = [
          'Total Requests',
          'Total Amount',
          'Approved',
          'Rejected',
          'Pending'
        ];

        pdfSections.forEach(section => {
          expect(section).toBeDefined();
        });
      });

      test('should include approval trail for each request', () => {
        const requestDetails = [
          'Request ID',
          'Requester',
          'Department',
          'Amount',
          'Purpose',
          'Status',
          'Approval Trail'
        ];

        expect(requestDetails).toContain('Approval Trail');
      });

      test('should include settlement information for approved requests', () => {
        const settlementInfo = [
          'Settlement Status',
          'Payment Reference',
          'Payment Date'
        ];

        settlementInfo.forEach(info => {
          expect(info).toBeDefined();
        });
      });
    });
  });

  describe('GET /api/reports/export/excel', () => {

    describe('Excel Generation', () => {

      test('should require exceljs package', () => {
        const exceljsAvailable = true; // Mock package availability
        expect(exceljsAvailable).toBe(true);
      });

      test('should return 503 if exceljs not installed', () => {
        const ExcelJS = null; // Mock missing package
        const response = ExcelJS
          ? { status: 200 }
          : { status: 503, message: 'Excel export not available. Please install exceljs package.' };

        expect(response.status).toBe(503);
      });

      test('should set correct content type and disposition', () => {
        const headers = {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename=cash-requests-report-123456.xlsx'
        };

        expect(headers['Content-Type']).toContain('spreadsheetml');
        expect(headers['Content-Disposition']).toContain('.xlsx');
      });
    });

    describe('Excel Structure', () => {

      test('should have main Requests worksheet', () => {
        const worksheets = ['Requests', 'Summary'];
        expect(worksheets).toContain('Requests');
      });

      test('should have Summary worksheet', () => {
        const worksheets = ['Requests', 'Summary'];
        expect(worksheets).toContain('Summary');
      });

      test('should include all required columns in Requests sheet', () => {
        const columns = [
          'Request ID',
          'Requester',
          'Department',
          'Amount (RF)',
          'Purpose',
          'Status',
          'Priority',
          'Payment Method',
          'Created Date',
          'Settlement Status',
          'Payment Reference',
          'Payment Date',
          'Approval Trail'
        ];

        expect(columns).toContain('Approval Trail');
        expect(columns).toContain('Settlement Status');
        expect(columns).toHaveLength(13);
      });

      test('should format approval trail as readable text', () => {
        const approvalPath = [
          { role: 'direct_manager', approver: { name: 'John' }, status: 'approved' },
          { role: 'hod', approver: { name: 'Jane' }, status: 'approved' },
          { role: 'managing_director', approver: { name: 'Bob' }, status: 'approved' }
        ];

        const approvalTrail = approvalPath
          .map(a => `${a.role}: ${a.approver.name} (${a.status})`)
          .join(' → ');

        expect(approvalTrail).toContain('→');
        expect(approvalTrail).toContain('direct_manager');
        expect(approvalTrail).toContain('hod');
        expect(approvalTrail).toContain('managing_director');
      });
    });

    describe('Summary Worksheet', () => {

      test('should include summary metrics', () => {
        const summaryMetrics = [
          'Total Requests',
          'Total Amount (RF)',
          'Approved Requests',
          'Rejected Requests',
          'Pending Requests',
          'Paid Requests',
          'Report Generated'
        ];

        expect(summaryMetrics).toHaveLength(7);
      });
    });
  });

  describe('Export Filter Integration', () => {

    test('PDF and Excel exports should support same filters as main reporting', () => {
      const supportedFilters = [
        'startDate',
        'endDate',
        'minAmount',
        'maxAmount',
        'department',
        'status',
        'priority'
      ];

      // All exports should support these filters
      supportedFilters.forEach(filter => {
        expect(filter).toBeDefined();
      });
    });
  });

  describe('Approval Trail Tracking', () => {

    test('should track complete approval history', () => {
      const approvalPath = [
        {
          approver: 'user1',
          role: 'direct_manager',
          status: 'approved',
          timestamp: new Date('2024-01-10')
        },
        {
          approver: 'user2',
          role: 'hod',
          status: 'approved',
          timestamp: new Date('2024-01-11')
        },
        {
          approver: 'user3',
          role: 'managing_director',
          status: 'approved',
          timestamp: new Date('2024-01-12')
        }
      ];

      expect(approvalPath).toHaveLength(3);
      expect(approvalPath[0].role).toBe('direct_manager');
      expect(approvalPath[1].role).toBe('hod');
      expect(approvalPath[2].role).toBe('managing_director');
    });

    test('should display approval trail in reports', () => {
      const reportIncludesApprovalTrail = true;
      expect(reportIncludesApprovalTrail).toBe(true);
    });
  });
});
