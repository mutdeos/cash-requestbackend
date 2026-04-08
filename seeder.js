require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User'); 

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('🌐 Connected to MongoDB!');

    // Generate the password hash
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password123', salt);n

    // Create the dummy user
    const testUser = new User({
      name: 'Deo Mutama',
      email: 'employee@test.com',
      password: hashedPassword,
      role: 'employee', // Exactly matches your enum
      department: 'Engineering' // Satisfies the required field
    });

    // Save to Atlas and exit
    await testUser.save();
    console.log('✅ Success! Test user seeded: employee@test.com / password123');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();