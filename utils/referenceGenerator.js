/**
 * Utility functions for generating payment reference codes
 */

/**
 * Generates a unique payment reference code
 * Format: BULK-YYYYMMDD-HHMMSS-RANDOM
 * Example: BULK-20241216-143052-A7F2
 *
 * @returns {string} Generated reference code
 */
function generateBulkPaymentReference() {
  const now = new Date();

  // Date component: YYYYMMDD
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateString = `${year}${month}${day}`;

  // Time component: HHMMSS
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const timeString = `${hours}${minutes}${seconds}`;

  // Random component: 4 alphanumeric characters
  const randomString = Math.random().toString(36).substring(2, 6).toUpperCase();

  return `BULK-${dateString}-${timeString}-${randomString}`;
}

/**
 * Generates a unique payment reference code for a single settlement
 * Format: PAY-YYYYMMDD-HHMMSS-RANDOM
 * Example: PAY-20241216-143052-A7F2
 *
 * @returns {string} Generated reference code
 */
function generateSinglePaymentReference() {
  const now = new Date();

  // Date component: YYYYMMDD
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateString = `${year}${month}${day}`;

  // Time component: HHMMSS
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const timeString = `${hours}${minutes}${seconds}`;

  // Random component: 4 alphanumeric characters
  const randomString = Math.random().toString(36).substring(2, 6).toUpperCase();

  return `PAY-${dateString}-${timeString}-${randomString}`;
}

/**
 * Generates an individual reference for a request within a bulk settlement
 * Format: BULK-YYYYMMDD-HHMMSS-RANDOM-SEQ
 * Example: BULK-20241216-143052-A7F2-001
 *
 * @param {string} bulkReference - The bulk reference code
 * @param {number} sequenceNumber - The sequence number for this request
 * @returns {string} Generated individual reference
 */
function generateIndividualReference(bulkReference, sequenceNumber) {
  const sequence = String(sequenceNumber).padStart(3, '0');
  return `${bulkReference}-${sequence}`;
}

module.exports = {
  generateBulkPaymentReference,
  generateSinglePaymentReference,
  generateIndividualReference
};
