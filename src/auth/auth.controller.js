import * as authService from './auth.service.js';
import { sendSuccess, sendError } from '../utils/response.utils.js';
import { env } from '../../config/env.js';
import { logger } from '../utils/logger.js';

const COOKIE_OPTS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: env.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
};

export async function register(req, res, next) {
  try {
    const { user, accessToken, refreshToken } = await authService.registerUser(req.body);
    res.cookie('refreshToken', refreshToken, COOKIE_OPTS);
    return sendSuccess(res, { user, accessToken }, 201);
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { user, accessToken, refreshToken } = await authService.loginUser(req.body);
    res.cookie('refreshToken', refreshToken, COOKIE_OPTS);
    return sendSuccess(res, { user, accessToken });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req, res, next) {
  try {
    const refreshToken = req.cookies?.refreshToken;
    const { accessToken } = await authService.refreshAccessToken(refreshToken);
    return sendSuccess(res, { accessToken });
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res, next) {
  try {
    const refreshToken = req.cookies?.refreshToken;
    await authService.logoutUser(refreshToken);
    res.clearCookie('refreshToken');
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function googleCallback(req, res, next) {
  try {
    const { user, accessToken, refreshToken } = await authService.handleGoogleUser(req.user);
    res.cookie('refreshToken', refreshToken, COOKIE_OPTS);
    return sendSuccess(res, { user, accessToken });
  } catch (err) {
    next(err);
  }
}
