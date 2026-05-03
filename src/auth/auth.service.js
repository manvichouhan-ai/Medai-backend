import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { addDays } from 'date-fns';
import User from '../../models/User.model.js';
import Token from '../../models/Token.model.js';
import { signAccessToken } from '../utils/jwt.utils.js';
import { redis } from '../../config/redis.js';
import { env } from '../../config/env.js';
import { logger } from '../utils/logger.js';

const BCRYPT_ROUNDS = 12;
const REFRESH_TTL_SECONDS = env.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60;

async function issueTokens(user) {
  const accessToken = signAccessToken({ userId: user._id.toString(), role: user.role });

  const refreshToken = uuidv4();
  const expiresAt = addDays(new Date(), env.REFRESH_TOKEN_EXPIRES_DAYS);

  await Promise.all([
    Token.create({ userId: user._id, token: refreshToken, type: 'refresh', expiresAt }),
    redis.set(`refresh:${refreshToken}`, user._id.toString(), 'EX', REFRESH_TTL_SECONDS),
  ]);

  return { accessToken, refreshToken };
}

export async function registerUser({ email, password, fullName, role, phone, timezone }) {
  const existing = await User.findOne({ email });
  if (existing) throw Object.assign(new Error('Email already in use'), { statusCode: 409 });

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await User.create({ email, passwordHash, fullName, role, phone, timezone });

  const { accessToken, refreshToken } = await issueTokens(user);
  return { user: user.toSafeObject(), accessToken, refreshToken };
}

export async function loginUser({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user) throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });

  if (!user.isActive) throw Object.assign(new Error('Account is deactivated'), { statusCode: 403 });

  const { accessToken, refreshToken } = await issueTokens(user);
  return { user: user.toSafeObject(), accessToken, refreshToken };
}

export async function refreshAccessToken(refreshToken) {
  if (!refreshToken) throw Object.assign(new Error('No refresh token'), { statusCode: 401 });

  const userId = await redis.get(`refresh:${refreshToken}`);
  if (!userId) throw Object.assign(new Error('Invalid or expired refresh token'), { statusCode: 401 });

  const user = await User.findById(userId);
  if (!user || !user.isActive) throw Object.assign(new Error('User not found'), { statusCode: 401 });

  const accessToken = signAccessToken({ userId: user._id.toString(), role: user.role });
  return { accessToken };
}

export async function logoutUser(refreshToken) {
  if (!refreshToken) return;
  await Promise.allSettled([
    redis.del(`refresh:${refreshToken}`),
    Token.deleteOne({ token: refreshToken, type: 'refresh' }),
  ]);
}

export async function handleGoogleUser(googleUser) {
  const { accessToken, refreshToken } = await issueTokens(googleUser);
  return { user: googleUser.toSafeObject(), accessToken, refreshToken };
}
