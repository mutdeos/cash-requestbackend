const express = require('express');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');
const emailService = require('../services/emailService');
const router = express.Router();

// Admin: Onboard new user
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const { email, name, role, department, manager, password } = req.body;

    // Validate required fields
    if (!email || !name || !role || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }
    
    // Validate manager exists if provided
    if (manager && manager !== '') {
      const managerUser = await User.findById(manager);
      if (!managerUser) {
        return res.status(400).json({ message: 'Invalid manager ID' });
      }
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = new User({ 
      email, 
      name, 
      role,
      department, 
      manager: manager && manager !== '' ? manager : null, 
      password: hashedPassword 
    });
    
    await user.save();

    // Send welcome email with credentials
    await emailService.sendWelcomeEmail(email, name, password);

    res.json({
      message: 'User onboarded successfully',
      user: {
        id: user._id,
        email,
        name,
        role,
        department,
        manager: user.manager
      }
    });
    
  } catch (error) {
    console.error('Error onboarding user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all users (for admin)
router.get('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const users = await User.find().select('-password').populate('manager', 'name email');
    res.json(users);
    
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update user (PUT /)
router.put('/', auth, async (req, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Unauthorized' });
      }
  
      const { id, email, name, role, department, manager, password } = req.body;
  
      // Validate required fields
      if (!id) {
        return res.status(400).json({ message: 'User ID is required' });
      }
  
      if (!email || !name || !role || !department) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
  
      // Check if user exists
      const existingUser = await User.findById(id);
      if (!existingUser) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      // Check if email is already taken by another user
      const emailExists = await User.findOne({ email, _id: { $ne: id } });
      if (emailExists) {
        return res.status(400).json({ message: 'Email already exists' });
      }
  
      // Validate manager exists if provided
      if (manager && manager !== '' && manager !== id) {
        const managerUser = await User.findById(manager);
        if (!managerUser) {
          return res.status(400).json({ message: 'Invalid manager ID' });
        }
      }
  
      // Prepare update data
      const updateData = {
        email,
        name,
        role,
        department,
        manager: manager && manager !== '' && manager !== id ? manager : null
      };
  
      // Hash password if provided
      if (password && password.trim() !== '') {
        updateData.password = await bcrypt.hash(password, 10);
      }
  
      const updatedUser = await User.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      ).select('-password').populate('manager', 'name email');
  
      res.json({
        message: 'User updated successfully',
        user: updatedUser
      });
  
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // Delete user (DELETE /:id)
  router.delete('/:id', auth, async (req, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      const { id } = req.params;

      // Validate user ID
      if (!id) {
        return res.status(400).json({ message: 'User ID is required' });
      }

      // Check if user exists
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Prevent admin from deleting themselves
      if (id === req.user.id) {
        return res.status(400).json({ message: 'Cannot delete your own account' });
      }

      // Check if user is a manager of other users
      const managedUsers = await User.find({ manager: id });
      if (managedUsers.length > 0) {
        return res.status(400).json({
          message: 'Cannot delete user who is managing other users. Please reassign managed users first.'
        });
      }

      await User.findByIdAndDelete(id);

      res.json({
        message: 'User deleted successfully',
        deletedUserId: id
      });

    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

// Register device FCM token
router.post('/device-token', auth, async (req, res) => {
  console.log('🔔 [FCM DEBUG] POST /device-token endpoint called');
  console.log('🔔 [FCM DEBUG] User ID from auth:', req.user.id);
  console.log('🔔 [FCM DEBUG] Request body:', JSON.stringify(req.body));

  try {
    const { fcmToken } = req.body;

    if (!fcmToken) {
      console.log('🔔 [FCM DEBUG] ❌ No FCM token in request body');
      return res.status(400).json({ message: 'FCM token is required' });
    }

    console.log('🔔 [FCM DEBUG] FCM token received:', fcmToken.substring(0, 30) + '...');
    console.log('🔔 [FCM DEBUG] Token length:', fcmToken.length);

    const user = await User.findById(req.user.id);

    if (!user) {
      console.log('🔔 [FCM DEBUG] ❌ User not found in database');
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('🔔 [FCM DEBUG] User found:', user.email);
    console.log('🔔 [FCM DEBUG] Current fcmTokens count:', user.fcmTokens?.length || 0);

    // Add token if it doesn't already exist
    if (!user.fcmTokens.includes(fcmToken)) {
      user.fcmTokens.push(fcmToken);
      await user.save();
      console.log('🔔 [FCM DEBUG] ✅ Token added successfully! New count:', user.fcmTokens.length);
    } else {
      console.log('🔔 [FCM DEBUG] ⚠️ Token already exists, not adding duplicate');
    }

    res.json({ message: 'Device token registered successfully' });
  } catch (error) {
    console.error('🔔 [FCM DEBUG] ❌ Error registering device token:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove device FCM token
router.post('/device-token/remove', auth, async (req, res) => {
  try {
    const { fcmToken } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Remove the token if it exists
    if (fcmToken) {
      user.fcmTokens = user.fcmTokens.filter(token => token !== fcmToken);
    } else {
      // If no specific token provided, clear all tokens
      user.fcmTokens = [];
    }

    await user.save();

    res.json({ message: 'Device token removed successfully' });
  } catch (error) {
    console.error('Error removing device token:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;