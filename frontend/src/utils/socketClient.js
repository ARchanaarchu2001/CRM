import { io } from 'socket.io-client';

// Construct the URL directly based on the Vite environment variable structure
// If APIs run on /api locally through proxies, socket usually connects direct to port
const SOCKET_URL = import.meta.env.VITE_API_URL 
  ? import.meta.env.VITE_API_URL.replace('/api', '') 
  : 'http://localhost:5000';

export const socket = io(SOCKET_URL, {
  autoConnect: true,
  withCredentials: true,
});

let registeredPresence = null;

socket.on('connect', () => {
  if (registeredPresence?.userId) {
    socket.emit('presence:register', registeredPresence);
  }
});

export const connectSocket = () => {
  if (!socket.connected) {
    socket.connect();
  }
};

export const registerSocketPresence = (user) => {
  if (!user?._id) {
    return;
  }

  registeredPresence = {
    userId: user._id,
    role: user.role || '',
  };

  if (socket.connected) {
    socket.emit('presence:register', registeredPresence);
  }
};

export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect();
  }
};
