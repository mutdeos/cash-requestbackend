#!/usr/bin/env node
/**
 * Cleanup script to remove invalid FCM tokens from the database
 * Run with: node scripts/cleanup-fcm-tokens.js
 */

const mongoose = require('mongoose');
const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase Admin
const path = require('path');
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
const absolutePath = path.resolve(__dirname, '..', serviceAccountPath);
const serviceAccount = require(absolutePath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Import User model
const User = require('../models/User');

async function cleanupTokens() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');

    // Get all users with FCM tokens
    const users = await User.find({
      fcmTokens: { $exists: true, $not: { $size: 0 } }
    });

    console.log(`\n📊 Found ${users.length} users with FCM tokens\n`);

    let totalTokensRemoved = 0;
    let totalUsersUpdated = 0;

    for (const user of users) {
      const originalTokenCount = user.fcmTokens.length;
      const invalidTokens = [];

      console.log(`\nChecking user: ${user.email} (${user.fcmTokens.length} tokens)`);

      // Test each token
      for (let i = 0; i < user.fcmTokens.length; i++) {
        const token = user.fcmTokens[i];

        try {
          // Try to send a dry-run message to validate the token
          const message = {
            data: { test: 'validation' },
            token: token
          };

          await admin.messaging().send(message, true); // true = dry run
          console.log(`  ✅ Token ${i}: Valid`);
        } catch (error) {
          // Token is invalid
          console.log(`  ❌ Token ${i}: Invalid (${error.code})`);
          invalidTokens.push(token);
        }
      }

      // Remove invalid tokens
      if (invalidTokens.length > 0) {
        user.fcmTokens = user.fcmTokens.filter(token => !invalidTokens.includes(token));
        await user.save();

        totalTokensRemoved += invalidTokens.length;
        totalUsersUpdated++;

        console.log(`  🗑️  Removed ${invalidTokens.length} invalid token(s)`);
        console.log(`  📱 Remaining tokens: ${user.fcmTokens.length}`);
      } else {
        console.log(`  ✨ All tokens valid`);
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 Cleanup Summary:`);
    console.log(`   - Total users checked: ${users.length}`);
    console.log(`   - Users updated: ${totalUsersUpdated}`);
    console.log(`   - Tokens removed: ${totalTokensRemoved}`);
    console.log(`${'='.repeat(60)}\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

// Run the cleanup
cleanupTokens();
