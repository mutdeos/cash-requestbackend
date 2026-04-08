const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

/**
 * Seeder script to create an admin user
 *
 * Usage:
 *   node seeders/createAdmin.js
 *
 * This will create an admin user with predefined credentials
 */

const adminData = {
  email: 'admin@cashrequest.com',
  name: 'System Administrator',
  password: 'Admin@123', // Default password - CHANGE AFTER FIRST LOGIN
  role: 'admin',
  department: 'Management'
};

async function createAdmin() {
  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB successfully\n');

    // Check if admin already exists
    console.log('🔍 Checking if admin user already exists...');
    const existingAdmin = await User.findOne({ email: adminData.email });

    if (existingAdmin) {
      console.log('⚠️  Admin user already exists!');
      console.log(`   Email: ${existingAdmin.email}`);
      console.log(`   Name: ${existingAdmin.name}`);
      console.log(`   Role: ${existingAdmin.role}`);
      console.log('\n💡 To reset the admin password, delete the user first or update manually.\n');
      process.exit(0);
    }

    // Hash password
    console.log('🔐 Hashing password...');
    const hashedPassword = await bcrypt.hash(adminData.password, 10);

    // Create admin user
    console.log('👤 Creating admin user...');
    const admin = new User({
      email: adminData.email,
      name: adminData.name,
      password: hashedPassword,
      role: adminData.role,
      department: adminData.department,
      manager: null
    });

    await admin.save();

    console.log('\n✅ Admin user created successfully!\n');
    console.log('═══════════════════════════════════════════════');
    console.log('📧 Email:    ', adminData.email);
    console.log('🔑 Password: ', adminData.password);
    console.log('👤 Name:     ', adminData.name);
    console.log('🎭 Role:     ', adminData.role);
    console.log('🏢 Department:', adminData.department);
    console.log('═══════════════════════════════════════════════');
    console.log('\n⚠️  IMPORTANT: Change the password after first login!\n');

  } catch (error) {
    console.error('\n❌ Error creating admin user:', error.message);
    console.error('Full error:', error);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
    process.exit(0);
  }
}

// Run the seeder
createAdmin();
