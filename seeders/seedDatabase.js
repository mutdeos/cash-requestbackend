const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

/**
 * Complete database seeder
 *
 * Usage:
 *   node seeders/seedDatabase.js
 *
 * This will create:
 * - 1 Admin user
 * - 1 CEO
 * - 1 Managing Director
 * - 1 Finance user
 * - 2 Direct Managers
 * - 3 Employees
 */

const users = [
  {
    email: 'admin@cashrequest.com',
    name: 'System Administrator',
    password: 'Admin@123',
    role: 'admin',
    department: 'Management',
    manager: null
  },
  {
    email: 'ceo@cashrequest.com',
    name: 'Chief Executive Officer',
    password: 'Ceo@123',
    role: 'ceo',
    department: 'Management',
    manager: null
  },
  {
    email: 'md@cashrequest.com',
    name: 'Managing Director',
    password: 'Director@123',
    role: 'managing_director',
    department: 'Management',
    manager: null
  },
  {
    email: 'finance@cashrequest.com',
    name: 'Finance Manager',
    password: 'Finance@123',
    role: 'finance',
    department: 'Finance & Logistics',
    manager: null
  },
  {
    email: 'manager1@cashrequest.com',
    name: 'Sales Manager',
    password: 'Manager@123',
    role: 'direct_manager',
    department: 'Sales',
    manager: null
  },
  {
    email: 'manager2@cashrequest.com',
    name: 'Technical Manager',
    password: 'Manager@123',
    role: 'direct_manager',
    department: 'Technical',
    manager: null
  },
  {
    email: 'employee1@cashrequest.com',
    name: 'John Doe',
    password: 'Employee@123',
    role: 'employee',
    department: 'Sales',
    managerEmail: 'manager1@cashrequest.com' // Will be linked after creation
  },
  {
    email: 'employee2@cashrequest.com',
    name: 'Jane Smith',
    password: 'Employee@123',
    role: 'employee',
    department: 'Sales',
    managerEmail: 'manager1@cashrequest.com'
  },
  {
    email: 'employee3@cashrequest.com',
    name: 'Bob Johnson',
    password: 'Employee@123',
    role: 'employee',
    department: 'Technical',
    managerEmail: 'manager2@cashrequest.com'
  }
];

async function seedDatabase() {
  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB successfully\n');

    console.log('═══════════════════════════════════════════════');
    console.log('           DATABASE SEEDER                     ');
    console.log('═══════════════════════════════════════════════\n');

    // Check if users already exist
    const existingUsers = await User.countDocuments();
    if (existingUsers > 0) {
      console.log(`⚠️  Database already contains ${existingUsers} user(s)`);
      console.log('This seeder will skip existing users and create only new ones.\n');
    }

    const createdUsers = {};
    let createdCount = 0;
    let skippedCount = 0;

    // Create users
    for (const userData of users) {
      const existingUser = await User.findOne({ email: userData.email });

      if (existingUser) {
        console.log(`⏭️  Skipping ${userData.email} (already exists)`);
        createdUsers[userData.email] = existingUser;
        skippedCount++;
        continue;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      // Create user
      const user = new User({
        email: userData.email,
        name: userData.name,
        password: hashedPassword,
        role: userData.role,
        department: userData.department,
        manager: userData.manager
      });

      await user.save();
      createdUsers[userData.email] = user;
      console.log(`✅ Created ${userData.role}: ${userData.name} (${userData.email})`);
      createdCount++;
    }

    // Link employees to their managers
    console.log('\n🔗 Linking employees to managers...');
    for (const userData of users) {
      if (userData.managerEmail) {
        const employee = createdUsers[userData.email];
        const manager = createdUsers[userData.managerEmail];

        if (employee && manager) {
          employee.manager = manager._id;
          await employee.save();
          console.log(`   Linked ${employee.name} → ${manager.name}`);
        }
      }
    }

    console.log('\n═══════════════════════════════════════════════');
    console.log('           SEEDING COMPLETE                     ');
    console.log('═══════════════════════════════════════════════\n');
    console.log(`✅ Created: ${createdCount} user(s)`);
    console.log(`⏭️  Skipped: ${skippedCount} user(s) (already existed)\n`);

    if (createdCount > 0) {
      console.log('Default Credentials:');
      console.log('───────────────────────────────────────────────');
      users.forEach(user => {
        console.log(`${user.role.padEnd(20)} | ${user.email.padEnd(30)} | ${user.password}`);
      });
      console.log('───────────────────────────────────────────────');
      console.log('\n⚠️  IMPORTANT: Change all passwords after first login!\n');
    }

  } catch (error) {
    console.error('\n❌ Error seeding database:', error.message);
    console.error('Full error:', error);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
    process.exit(0);
  }
}

// Run the seeder
seedDatabase();
