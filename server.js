const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');


const leaveRequestRoutes = require('./routes/leaverequests');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const requestRoutes = require('./routes/requests');
const notificationRoutes = require('./routes/notifications');
const reportsRoutes = require('./routes/reports');
const emailService = require('./services/emailService');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 30001;

// Socket.IO configuration
const io = socketIo(server, {
  path: '/socket.io',
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: false
  },
  transports: ['websocket', 'polling']
});

// CORS configuration for Express
const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false
};

app.use(cors(corsOptions));
app.use(express.json());

// Make io available to routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Connected to MongoDB');
    // Initialize email service
    emailService.initialize();
  })
  .catch(err => console.error('MongoDB connection error:', err));

// Socket.IO authentication middleware
const socketAuth = (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch (error) {
    next(new Error('Authentication error'));
  }
};

// Socket.IO connection handling
io.use(socketAuth);

io.on('connection', (socket) => {
  console.log(`User ${socket.userId} connected`);
  
  // Handle user disconnection
  socket.on('disconnect', () => {
    console.log(`User ${socket.userId} disconnected`);
  });
  
  // Optional: Handle marking notifications as read
  socket.on('markNotificationRead', (notificationId) => {
    // You can implement this to mark notifications as read
    console.log(`Notification ${notificationId} marked as read by user ${socket.userId}`);
  });
});

// Routes
app.use('/api/leave-requests', leaveRequestRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportsRoutes);

app.get('/', (req, res) => {
  res.json({ message: "Welcome To Approval System with Real-time Notifications" });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ message: 'Internal server error' });
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Socket.IO server ready for real-time notifications`);
});