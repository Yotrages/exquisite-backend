const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('./Models/User');

let io;

const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: [
        'http://localhost:5173',
        'https://vite-project-omega-seven.vercel.app',
        'https://exquisitewears.vercel.app'
      ],
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Authentication middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET_TOKEN);
      const user = await User.findById(decoded.id).select('_id name email isAdmin');
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`✅ Socket connected: ${socket.user.name} (${socket.user._id})`);

    // Join user's personal room for direct notifications
    socket.join(`user:${socket.user._id}`);

    // Join admin room if user is admin
    if (socket.user.isAdmin) {
      socket.join('admin');
      console.log(`👑 Admin joined admin room: ${socket.user.name}`);
    }

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`❌ Socket disconnected: ${socket.user.name} (${socket.user._id})`);
    });

    // Handle mark as read (optional: sync across tabs)
    socket.on('notification:read', async (notificationId) => {
      try {
        const Notification = require('./Models/Notification');
        await Notification.findOneAndUpdate(
          { _id: notificationId, user: socket.user._id },
          { read: true }
        );
        // Emit to user's other tabs
        socket.to(`user:${socket.user._id}`).emit('notification:read', notificationId);
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    });

    // Handle mark all as read
    socket.on('notification:readAll', async () => {
      try {
        const Notification = require('./Models/Notification');
        await Notification.updateMany(
          { user: socket.user._id, read: false },
          { read: true }
        );
        socket.to(`user:${socket.user._id}`).emit('notification:readAll');
      } catch (error) {
        console.error('Error marking all notifications as read:', error);
      }
    });
  });

  return io;
};

// Helper functions to emit notifications
const emitNotification = (userId, notification) => {
  if (io) {
    io.to(`user:${userId}`).emit('notification:new', notification);
  }
};

const emitNotificationToAll = (notification) => {
  if (io) {
    io.emit('notification:broadcast', notification);
  }
};

const emitAdminNotification = (notification) => {
  if (io) {
    io.to('admin').emit('admin:notification', notification);
  }
};

const getConnectedUsersCount = () => {
  if (io) {
    return io.sockets.sockets.size;
  }
  return 0;
};

const getIO = () => io;

module.exports = {
  initializeSocket,
  emitNotification,
  emitNotificationToAll,
  emitAdminNotification,
  getConnectedUsersCount,
  getIO
};