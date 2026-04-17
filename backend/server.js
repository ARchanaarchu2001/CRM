import 'dotenv/config';

import http from 'http';
import app from './app.js';
import connectDB from './config/db.js';
import { initSocket } from './utils/socket.js';

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to database
    await connectDB();
    
    // Create native HTTP server required for Socket.io
    const server = http.createServer(app);

    // Bind WebSockets globally
    initSocket(server);
    
    // Start Express + WebSocket server
    server.listen(PORT, () => {
      console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });
  } catch (error) {
    console.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

startServer();
