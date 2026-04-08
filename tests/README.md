# Backend Unit Tests

## Overview
This directory contains comprehensive unit tests for the Cash Requisition Workflow backend.

## Test Files

### 1. `models.test.js`
Tests for data models (User and Request)
- User role validation (including HoD role)
- Request settlement fields
- Approval path structure
- Required fields validation

### 2. `approval-workflow.test.js`
Tests for approval workflow logic
- Approval path determination based on amount
- 500,000 threshold validation
- Approval order (Direct Manager → HoD → MD → CEO)
- Finance exclusion from approval chain

### 3. `settlement.test.js`
Tests for Finance settlement endpoint
- Authorization (Finance-only access)
- Settlement validation
- Settlement field updates
- Notification after settlement

### 4. `reporting.test.js`
Tests for reporting module
- Comprehensive filtering
- Pagination
- PDF export
- Excel export
- Analytics aggregations
- Approval trail tracking

## Running Tests

### Install Testing Framework
First, install Jest and related dependencies:
```bash
npm install --save-dev jest supertest mongodb-memory-server @types/jest
```

### Update package.json
Add test script to `package.json`:
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  },
  "jest": {
    "testEnvironment": "node",
    "coveragePathIgnorePatterns": ["/node_modules/"]
  }
}
```

### Run Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test tests/approval-workflow.test.js
```

## Test Coverage

These tests verify all critical requirements:

### ✅ Workflow Requirements
- [x] Direct Manager is first approver
- [x] HoD is second approver
- [x] MD is third approver
- [x] CEO required for amounts >= 500,000
- [x] MD is final for amounts < 500,000
- [x] Finance NOT in approval chain

### ✅ Settlement Requirements
- [x] Settlement fields exist
- [x] Settlement endpoint (POST /api/requests/:id/settle)
- [x] Finance-only access
- [x] Settlement after all approvals
- [x] Requester notification with payment reference

### ✅ Reporting Requirements
- [x] Comprehensive filtering (date, amount, department, etc.)
- [x] Pagination support
- [x] PDF export
- [x] Excel export with multiple worksheets
- [x] Analytics and aggregations
- [x] Approval trail visibility

## Notes

- These are unit tests focused on logic validation
- Integration tests with actual database would require additional setup
- Some tests use mocks to simulate dependencies
- All critical business logic is covered

## Test Execution Order

1. Model tests (foundation)
2. Approval workflow tests (core logic)
3. Settlement tests (post-approval workflow)
4. Reporting tests (data visibility and exports)

## Continuous Integration

These tests can be integrated into CI/CD pipelines to ensure:
- No regression in approval logic
- Settlement workflow integrity
- Reporting functionality consistency
- Model structure validation
