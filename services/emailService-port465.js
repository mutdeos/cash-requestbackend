const nodemailer = require('nodemailer');

/**
 * Email Service for sending notifications via Gmail (Port 465)
 *
 * Use this version if port 587 is blocked by your hosting provider (Render, Heroku, etc.)
 *
 * Configuration required in .env:
 * - EMAIL_USER: Your Gmail email address
 * - EMAIL_PASSWORD: Gmail App password (16 characters)
 * - EMAIL_FROM_NAME: Display name for sender (e.g., "Cash Request System")
 */

class EmailService {
  constructor() {
    this.transporter = null;
    this.initialized = false;
  }

  /**
   * Initialize email transporter with Gmail settings (Port 465 with SSL)
   */
  async initialize() {
    if (this.initialized) return;

    // Check if email credentials are configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.log('⚠️  Email credentials not configured - email notifications disabled');
      console.log('   Set EMAIL_USER and EMAIL_PASSWORD environment variables to enable emails');
      return;
    }

    try {
      // Gmail SMTP configuration with SSL on port 465
      this.transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true, // use SSL
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
        connectionTimeout: 10000, // 10 seconds
        greetingTimeout: 5000,    // 5 seconds
        socketTimeout: 10000      // 10 seconds
      });

      // Verify connection with timeout
      const verifyPromise = this.transporter.verify();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout')), 15000)
      );

      await Promise.race([verifyPromise, timeoutPromise]);
      console.log('✅ Email service initialized successfully (Gmail - Port 465 SSL)');
      this.initialized = true;
    } catch (error) {
      console.error('❌ Email service initialization failed:', error.message);
      console.log('⚠️  Email notifications will be disabled.');
      console.log('   The application will continue to work without email notifications.');
      // Don't throw error - allow app to continue without email
    }
  }

  /**
   * Send an email notification
   * @param {Object} options - Email options
   * @param {string} options.to - Recipient email address
   * @param {string} options.subject - Email subject
   * @param {string} options.html - HTML email body
   * @param {string} options.text - Plain text fallback
   * @returns {Promise<boolean>} - Success status
   */
  async sendEmail({ to, subject, html, text }) {
    if (!this.initialized || !this.transporter) {
      console.warn('Email service not initialized - skipping email to:', to);
      return false;
    }

    try {
      const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME || 'Cash Request System'}" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html,
        text: text || this.stripHtml(html)
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`✅ Email sent successfully to ${to}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to send email to ${to}:`, error.message);
      return false;
    }
  }

  /**
   * Send new cash request notification to approvers
   */
  async sendNewRequestNotification(approverEmail, requesterName, amount, purpose, requestId) {
    const subject = `New Cash Request Awaiting Your Approval - ${amount} RWF`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #ef4444; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
          .button { display: inline-block; padding: 12px 24px; background-color: #ef4444; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          .details { background-color: white; padding: 15px; border-left: 4px solid #ef4444; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Cash Request</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>A new cash request has been submitted and requires your approval.</p>

            <div class="details">
              <p><strong>Requester:</strong> ${requesterName}</p>
              <p><strong>Amount:</strong> ${amount.toLocaleString()} RWF</p>
              <p><strong>Purpose:</strong> ${purpose}</p>
            </div>

            <p>Please review and take action on this request at your earliest convenience.</p>

            <div style="text-align: center; margin-top: 30px;">
              <a href="${process.env.FRONTEND_URL}/approvals" class="button" style="color: white;">
                View Pending Approvals
              </a>
            </div>

            <p style="margin-top: 30px; font-size: 12px; color: #6b7280;">
              <strong>Note:</strong> This is an automated notification from the Cash Request Workflow System.
            </p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Cash Request Workflow System. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to: approverEmail,
      subject,
      html
    });
  }

  /**
   * Send approval notification to requester
   */
  async sendApprovalNotification(requesterEmail, approverName, approverRole, amount, purpose) {
    const subject = `Cash Request Approved by ${approverRole}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #10b981; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
          .details { background-color: white; padding: 15px; border-left: 4px solid #10b981; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✓ Request Approved</h1>
          </div>
          <div class="content">
            <p>Good news!</p>
            <p>Your cash request has been approved by ${approverName} (${approverRole}).</p>

            <div class="details">
              <p><strong>Amount:</strong> ${amount.toLocaleString()} RWF</p>
              <p><strong>Purpose:</strong> ${purpose}</p>
              <p><strong>Approved by:</strong> ${approverName}</p>
            </div>

            <p>You will be notified of any further updates to this request.</p>

            <div style="text-align: center; margin-top: 30px;">
              <a href="${process.env.FRONTEND_URL}/history" class="button" style="color: white; background-color: #10b981;">
                View Request History
              </a>
            </div>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Cash Request Workflow System. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to: requesterEmail,
      subject,
      html
    });
  }

  /**
   * Send rejection notification to requester
   */
  async sendRejectionNotification(requesterEmail, approverName, approverRole, amount, purpose, comments) {
    const subject = `Cash Request Rejected by ${approverRole}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #ef4444; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
          .details { background-color: white; padding: 15px; border-left: 4px solid #ef4444; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Request Rejected</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>Unfortunately, your cash request has been rejected by ${approverName} (${approverRole}).</p>

            <div class="details">
              <p><strong>Amount:</strong> ${amount.toLocaleString()} RWF</p>
              <p><strong>Purpose:</strong> ${purpose}</p>
              <p><strong>Rejected by:</strong> ${approverName}</p>
              ${comments ? `<p><strong>Comments:</strong> ${comments}</p>` : ''}
            </div>

            <p>If you have questions about this decision, please contact ${approverName} directly.</p>

            <div style="text-align: center; margin-top: 30px;">
              <a href="${process.env.FRONTEND_URL}/history" class="button" style="color: white;">
                View Request History
              </a>
            </div>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Cash Request Workflow System. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to: requesterEmail,
      subject,
      html
    });
  }

  /**
   * Send final approval notification (all approvers approved)
   */
  async sendFinalApprovalNotification(requesterEmail, amount, purpose) {
    const subject = `Cash Request Fully Approved - ${amount} RWF`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #10b981; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
          .details { background-color: white; padding: 15px; border-left: 4px solid #10b981; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          .success { color: #10b981; font-size: 48px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Request Fully Approved!</h1>
          </div>
          <div class="content">
            <p>Congratulations!</p>
            <p>Your cash request has received all required approvals and is now fully approved.</p>

            <div class="details">
              <p><strong>Amount:</strong> ${amount.toLocaleString()} RWF</p>
              <p><strong>Purpose:</strong> ${purpose}</p>
              <p><strong>Status:</strong> <span style="color: #10b981;">Fully Approved</span></p>
            </div>

            <p>The finance team will process your request according to the approved timeline.</p>

            <div style="text-align: center; margin-top: 30px;">
              <a href="${process.env.FRONTEND_URL}/history" class="button" style="color: white; background-color: #10b981;">
                View Request History
              </a>
            </div>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Cash Request Workflow System. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to: requesterEmail,
      subject,
      html
    });
  }

  /**
   * Send welcome email to new user
   */
  async sendWelcomeEmail(userEmail, userName, tempPassword) {
    const subject = 'Welcome to Cash Request Workflow System';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
          .credentials { background-color: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin: 20px 0; }
          .warning { background-color: #fee2e2; padding: 15px; border-left: 4px solid #ef4444; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Cash Request System</h1>
          </div>
          <div class="content">
            <p>Hello ${userName},</p>
            <p>Your account has been created in the Cash Request Workflow System.</p>

            <div class="credentials">
              <p><strong>Login Credentials:</strong></p>
              <p><strong>Email:</strong> ${userEmail}</p>
              <p><strong>Temporary Password:</strong> ${tempPassword}</p>
            </div>

            <div class="warning">
              <p><strong>⚠️ Important Security Notice:</strong></p>
              <p>Please change your password after your first login to ensure account security.</p>
            </div>

            <p>You can now access the system to:</p>
            <ul>
              <li>Submit cash requests</li>
              <li>Track request status</li>
              <li>Approve requests (if applicable to your role)</li>
              <li>View request history</li>
            </ul>

            <div style="text-align: center; margin-top: 30px;">
              <a href="${process.env.FRONTEND_URL}/" class="button" style="color: white; background-color: #3b82f6;">
                Login to Cash Request System
              </a>
            </div>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Cash Request Workflow System. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to: userEmail,
      subject,
      html
    });
  }

  /**
   * Strip HTML tags for plain text fallback
   */
  stripHtml(html) {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }
}

// Export singleton instance
module.exports = new EmailService();
