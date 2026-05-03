import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../src/utils/logger.js';

export async function connectDB() {
  try {
    await mongoose.connect(env.MONGODB_URI);
    logger.info('MongoDB connected');
  } catch (err) {
    logger.error('MongoDB connection error', { error: err.message });
    process.exit(1);
  }
}
