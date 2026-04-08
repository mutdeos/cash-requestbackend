const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const readline = require('readline');
const User = require('../models/User');
require('dotenv').config();

/**
 * Interactive seeder script to create an admin user with custom credentials
 *
 * Usage:
 *   node seeders/createAdminCustom.js
 *
 * This will prompt you for admin details interactively
 */

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function createAdmin() {
  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB successfully\n');

    console.log('═══════════════════════════════════════════════');
    console.log('     CREATE ADMIN USER - INTERACTIVE MODE      ');
    console.log('═══════════════════════════════════════════════\n');

    // Get admin details
    const email = await question('📧 Enter admin email: ');

    // Validate email
    if (!email || !email.includes('@')) {
      console.log('❌ Invalid email address');
      process.exit(1);
    }

    // Check if admin already exists
    console.log('\n🔍 Checking if user already exists...');
    const existingAdmin = await User.findOne({ email });

    if (existingAdmin) {
      console.log('⚠️  User with this email already exists!');
      console.log(`   Email: ${existingAdmin.email}`);
      console.log(`   Name: ${existingAdmin.name}`);
      console.log(`   Role: ${existingAdmin.role}`);

      const overwrite = await question('\n❓ Do you want to delete and recreate? (yes/no): ');

      if (overwrite.toLowerCase() === 'yes' || overwrite.toLowerCase() === 'y') {
        await User.findByIdAndDelete(existingAdmin._id);
        console.log('✅ Existing user deleted\n');
      } else {
        console.log('❌ Operation cancelled');
        process.exit(0);
      }
    }

    const name = await question('👤 Enter admin name: ');
    const password = await question('🔑 Enter admin password: ');
    const department = await question('🏢 Enter department (default: Management): ') || 'Management';

    // Validate inputs
    if (!name || !password) {
      console.log('❌ Name and password are required');
      process.exit(1);
    }

    if (password.length < 6) {
      console.log('❌ Password must be at least 6 characters long');
      process.exit(1);
    }

    // Hash password
    console.log('\n🔐 Hashing password...');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin user
    console.log('👤 Creating admin user...');
    const admin = new User({
      email: email.trim(),
      name: name.trim(),
      password: hashedPassword,
      role: 'admin',
      department: department.trim(),
      manager: null
    });

    await admin.save();

    console.log('\n✅ Admin user created successfully!\n');
    console.log('═══════════════════════════════════════════════');
    console.log('📧 Email:    ', email);
    console.log('👤 Name:     ', name);
    console.log('🎭 Role:     ', 'admin');
    console.log('🏢 Department:', department);
    console.log('═══════════════════════════════════════════════');
    console.log('\n✅ You can now login with these credentials!\n');

  } catch (error) {
    console.error('\n❌ Error creating admin user:', error.message);
    console.error('Full error:', error);
  } finally {
    // Close readline and MongoDB connection
    rl.close();
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
    process.exit(0);
  }
}

// Run the seeder
createAdmin();
