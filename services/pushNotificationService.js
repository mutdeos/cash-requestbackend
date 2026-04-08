const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin SDK
function initializeFirebase() {
  // Check if Firebase Admin is already initialized
  if (admin.apps.length > 0) {
    console.log('Firebase Admin already initialized, using existing instance');
    return true;
  }

  try {
    // Check if service account credentials are available
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

    if (serviceAccountPath) {
      // Resolve to absolute path from backend directory
      const absolutePath = path.resolve(__dirname, '..', serviceAccountPath);

      // Check if file exists
      if (!fs.existsSync(absolutePath)) {
        console.warn(`Firebase service account file not found at: ${absolutePath}`);
        console.warn('Push notifications will not be sent.');
        return false;
      }

      // Initialize with service account file
      const serviceAccount = require(absolutePath);
      console.log('Firebase service account loaded:');
      console.log('  Project ID:', serviceAccount.project_id);
      console.log('  Client Email:', serviceAccount.client_email);
      console.log('  Private Key ID:', serviceAccount.private_key_id);
      console.log('  Has Private Key:', !!serviceAccount.private_key);

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('✅ Firebase Admin initialized successfully with service account file');
    } else {
      // Try to initialize with environment variables
      const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

      if (serviceAccountKey) {
        const serviceAccount = JSON.parse(serviceAccountKey);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        console.log('✅ Firebase Admin initialized successfully with environment variable');
      } else {
        console.warn('Firebase credentials not found. Push notifications will not be sent.');
        console.warn('Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_KEY in .env');
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('❌ Error initializing Firebase Admin:', error.message);
    console.warn('Push notifications will not be sent.');
    return false;
  }
}

// Initialize Firebase when module is loaded
const firebaseInitialized = initializeFirebase();

/**
 * Send push notification to specific user
 * @param {string} userId - User ID to send notification to
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} data - Additional data payload
 */
async function sendPushNotification(userId, title, body, data = {}) {
  // Ensure Firebase is initialized before proceeding
  if (!firebaseInitialized && !initializeFirebase()) {
    console.log('Firebase not initialized. Skipping push notification.');
    return;
  }

  // Double-check that Firebase Admin has an active app instance
  if (admin.apps.length === 0) {
    console.error('❌ Firebase Admin has no active app instance. Cannot send notification.');
    return;
  }

  try {
    const User = require('../models/User');
    const user = await User.findById(userId);

    if (!user || !user.fcmTokens || user.fcmTokens.length === 0) {
      console.log(`No FCM tokens found for user ${userId}`);
      return;
    }

    // Prepare the message
    const message = {
      notification: {
        title,
        body
      },
      data: {
        ...data,
        click_action: 'FLUTTER_NOTIFICATION_CLICK'
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'cash_request_channel',
          sound: 'default',
          priority: 'high',
          defaultSound: true,
          defaultVibrateTimings: true
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            contentAvailable: true
          }
        }
      },
      tokens: user.fcmTokens
    };

    // Send notification to all user's devices
    const response = await admin.messaging().sendEachForMulticast(message);

    console.log(`Push notification sent to user ${userId}:`);
    console.log(`  Success: ${response.successCount}`);
    console.log(`  Failure: ${response.failureCount}`);

    // Remove invalid tokens
    if (response.failureCount > 0) {
      const invalidTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const error = resp.error;
          console.log(`  Token ${idx} failed:`, error.code, '-', error.message);
          // Check if token is invalid, unregistered, or has auth errors (simulator/wrong project)
          if (
            error.code === 'messaging/invalid-registration-token' ||
            error.code === 'messaging/registration-token-not-registered' ||
            error.code === 'messaging/third-party-auth-error' ||
            error.code === 'messaging/invalid-argument'
          ) {
            invalidTokens.push(user.fcmTokens[idx]);
            console.log(`  ⚠️ Marking token ${idx} for removal (${error.code})`);
          }
        }
      });

      // Remove invalid tokens from user
      if (invalidTokens.length > 0) {
        user.fcmTokens = user.fcmTokens.filter(token => !invalidTokens.includes(token));
        await user.save();
        console.log(`✅ Removed ${invalidTokens.length} invalid token(s) for user ${userId}`);
      }
    }

    return response;
  } catch (error) {
    console.error('Error sending push notification:', error);
    throw error;
  }
}

/**
 * Send push notification to multiple users
 * @param {Array<string>} userIds - Array of user IDs
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} data - Additional data payload
 */
async function sendPushNotificationToMultiple(userIds, title, body, data = {}) {
  // Ensure Firebase is initialized before proceeding
  if (!firebaseInitialized && !initializeFirebase()) {
    console.log('Firebase not initialized. Skipping push notifications.');
    return;
  }

  // Double-check that Firebase Admin has an active app instance
  if (admin.apps.length === 0) {
    console.error('❌ Firebase Admin has no active app instance. Cannot send notifications.');
    return;
  }

  try {
    const promises = userIds.map(userId =>
      sendPushNotification(userId, title, body, data).catch(err => {
        console.error(`Failed to send notification to user ${userId}:`, err.message);
      })
    );

    await Promise.all(promises);
  } catch (error) {
    console.error('Error sending push notifications to multiple users:', error);
  }
}

module.exports = {
  sendPushNotification,
  sendPushNotificationToMultiple
};
