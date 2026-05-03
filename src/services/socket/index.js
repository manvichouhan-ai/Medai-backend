import { Server } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt.utils.js';
import { env } from '../../config/env.js';
import { logger } from '../utils/logger.js';

let io = null;

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const payload = verifyAccessToken(token);
      socket.userId = payload.userId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(socket.userId);
    logger.debug('Socket connected', { userId: socket.userId, socketId: socket.id });

    socket.on('disconnect', () => {
      logger.debug('Socket disconnected', { userId: socket.userId });
    });
  });

  logger.info('Socket.io initialized');
  return io;
}

export function getIO() {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}
