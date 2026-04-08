/**
 * Test script for Microsoft Graph API email service
 *
 * Usage: node test-email.js <recipient-email>
 * Example: node test-email.js gasana@maicoltd.com
 */

require('dotenv').config();
const emailService = require('./services/emailService');

async function testEmail() {
  const recipientEmail = process.argv[2];

  if (!recipientEmail) {
    console.error('❌ Please provide a recipient email address');
    console.log('Usage: node test-email.js <recipient-email>');
    console.log('Example: node test-email.js gasana@maicoltd.com');
    process.exit(1);
  }

  console.log('\n🧪 Testing Microsoft Graph API Email Service\n');
  console.log('Configuration:');
  console.log('  Client ID:', process.env.MICROSOFT_CLIENT_ID ? '✓ Set' : '✗ Missing');
  console.log('  Client Secret:', process.env.MICROSOFT_CLIENT_SECRET ? '✓ Set' : '✗ Missing');
  console.log('  Tenant ID:', process.env.MICROSOFT_TENANT_ID ? '✓ Set' : '✗ Missing');
  console.log('  Sender Email:', process.env.MICROSOFT_SENDER_EMAIL || '✗ Missing');
  console.log('  Recipient:', recipientEmail);
  console.log('');

  try {
    // Initialize email service
    console.log('📧 Initializing email service...');
    await emailService.initialize();

    if (!emailService.initialized) {
      console.error('❌ Email service failed to initialize. Check your credentials.');
      process.exit(1);
    }

    // Send test email
    console.log('📤 Sending test email...');
    const success = await emailService.sendEmail({
      to: recipientEmail,
      subject: 'Test Email from Cash Request System',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
            .success { background-color: #d1fae5; padding: 15px; border-left: 4px solid #10b981; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Email Service Test</h1>
            </div>
            <div class="content">
              <p>Hello!</p>
              <p>This is a test email from the Cash Request Workflow System using Microsoft Graph API with OAuth 2.0.</p>

              <div class="success">
                <p><strong>Success!</strong> Your Microsoft 365 email integration is working correctly.</p>
              </div>

              <p><strong>Technical Details:</strong></p>
              <ul>
                <li>Authentication: Microsoft Entra ID OAuth 2.0</li>
                <li>API: Microsoft Graph API v1.0</li>
                <li>Sender: ${process.env.MICROSOFT_SENDER_EMAIL}</li>
                <li>Timestamp: ${new Date().toLocaleString()}</li>
              </ul>

              <p>If you received this email, your email service is configured correctly and ready to send notifications!</p>
            </div>
          </div>
        </body>
        </html>
      `
    });

    if (success) {
      console.log('✅ Test email sent successfully!');
      console.log('📬 Please check the recipient inbox:', recipientEmail);
    } else {
      console.error('❌ Failed to send test email');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response?.data) {
      console.error('API Error:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

testEmail();
