import { Server } from 'socket.io';

let io;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    // We can emit live data here, or join specific rooms. 
    // For admin analytics, a simple global broadcast handles agent metrics perfectly.
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not fully initialized!');
  }
  return io;
};
