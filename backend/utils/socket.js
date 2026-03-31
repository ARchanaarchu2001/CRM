import { Server } from 'socket.io';

let io;
const socketPresence = new Map();

export const getOnlineUserIds = () => {
  const userIds = new Set();

  socketPresence.forEach((presence) => {
    if (presence?.userId) {
      userIds.add(String(presence.userId));
    }
  });

  return userIds;
};

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    socket.on('presence:register', (payload = {}) => {
      if (!payload.userId) {
        return;
      }

      socketPresence.set(socket.id, {
        userId: String(payload.userId),
        role: payload.role || '',
      });
    });

    socket.on('disconnect', () => {
      socketPresence.delete(socket.id);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not fully initialized!');
  }
  return io;
};
