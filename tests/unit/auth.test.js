import { describe, it, expect, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import User from '../../models/User.model.js';
import * as authService from '../../src/auth/auth.service.js';

jest.mock('../../config/redis.js', () => ({
  redis: {
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
  },
}));

describe('Auth Service', () => {
  describe('registerUser', () => {
    it('creates a user with hashed password', async () => {
      const result = await authService.registerUser({
        email: 'test@example.com',
        password: 'password123',
        fullName: 'Test User',
        role: 'patient',
      });

      expect(result.user.email).toBe('test@example.com');
      expect(result.user.passwordHash).toBeUndefined();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('throws 409 on duplicate email', async () => {
      await authService.registerUser({
        email: 'dup@example.com',
        password: 'password123',
        fullName: 'First',
      });

      await expect(
        authService.registerUser({ email: 'dup@example.com', password: 'password123', fullName: 'Second' })
      ).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  describe('loginUser', () => {
    beforeEach(async () => {
      const passwordHash = await bcrypt.hash('password123', 12);
      await User.create({ email: 'login@example.com', passwordHash, fullName: 'Login User' });
    });

    it('returns tokens on valid credentials', async () => {
      const result = await authService.loginUser({ email: 'login@example.com', password: 'password123' });
      expect(result.accessToken).toBeDefined();
      expect(result.user.email).toBe('login@example.com');
    });

    it('throws 401 on wrong password', async () => {
      await expect(
        authService.loginUser({ email: 'login@example.com', password: 'wrongpassword' })
      ).rejects.toMatchObject({ statusCode: 401 });
    });

    it('throws 401 on unknown email', async () => {
      await expect(
        authService.loginUser({ email: 'nobody@example.com', password: 'password123' })
      ).rejects.toMatchObject({ statusCode: 401 });
    });
  });
});
