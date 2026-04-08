const express = require('express');
const router = express.Router();
const LeaveRequest = require('../models/leaverequest'); 

router.post('/', async (req, res) => {
  try {
    // 1. Grab the data sent from Flutter
    const { requesterId, leaveType, startDate, endDate, reason } = req.body;

    // DEBUGGING: Print exactly what Flutter sent us to the Node terminal
    console.log("📥 Received Leave Request Data:", req.body);

    // 2. Safety Check: Map Flutter's dropdown values to match MongoDB's strict Enum
    let safeLeaveType = 'Other'; 
    if (leaveType.includes('Annual')) safeLeaveType = 'Annual';
    else if (leaveType.includes('Sick')) safeLeaveType = 'Sick';
    else if (leaveType.includes('Maternity')) safeLeaveType = 'Maternity';
    else if (leaveType.includes('Paternity')) safeLeaveType = 'Paternity';
    else if (leaveType.includes('Unpaid')) safeLeaveType = 'Unpaid';

    // 3. Create the new request
    const newLeave = new LeaveRequest({
      requester: requesterId,
      leaveType: safeLeaveType, // Using the safe, MongoDB-approved string
      startDate: startDate,
      endDate: endDate,
      reason: reason
    });

    // 4. Save it to MongoDB
    const savedLeave = await newLeave.save();

    // 5. Send success back to Flutter
    res.status(201).json({ 
      message: 'Leave request submitted successfully!', 
      leaveRequest: savedLeave 
    });

  } catch (error) {
    console.error('❌ Error saving leave request:', error.message);
    
    // If MongoDB rejected the data formatting, send a 400 Bad Request with the exact reason
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: `Database Validation Failed: ${error.message}` });
    }
    
    res.status(500).json({ message: 'Failed to save leave request', error: error.message });
  }
});

module.exports = router;