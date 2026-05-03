import Redis from 'ioredis';
import { env } from './env.js';
import { logger } from '../src/utils/logger.js';

export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  enableOfflineQueue: false,
});

redis.on('connect', () => logger.info('Redis connected'));
redis.on('error', (err) => logger.error('Redis error', { error: err.message }));

export async function connectRedis() {
  await redis.connect();
}
