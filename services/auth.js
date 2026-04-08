require('dotenv').config();
const { ConfidentialClientApplication } = require('@azure/msal-node');

/**
 * Microsoft OAuth 2.0 Authentication Service
 *
 * Uses Microsoft Entra ID (formerly Azure AD) to acquire access tokens
 * for sending emails via Microsoft Graph API
 */

const msalConfig = {
  auth: {
    clientId: process.env.MICROSOFT_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}`,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
  },
};

const cca = new ConfidentialClientApplication(msalConfig);

/**
 * Acquire OAuth access token using client credentials flow
 * @returns {Promise<string>} Access token for Microsoft Graph API
 */
async function getAccessToken() {
  try {
    const tokenRequest = {
      scopes: ['https://graph.microsoft.com/.default'],
    };

    const response = await cca.acquireTokenByClientCredential(tokenRequest);
    console.log('✅ Microsoft OAuth token acquired successfully');
    return response.accessToken;
  } catch (error) {
    console.error('❌ Error acquiring Microsoft access token:', error.message);
    throw error;
  }
}

module.exports = { getAccessToken };
