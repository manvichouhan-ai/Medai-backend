import { Router } from 'express';
import passport from '../../config/passport.js';
import * as authController from './auth.controller.js';
import { validate, registerSchema, loginSchema } from '../../validations/auth.schema.js';

const router = Router();

router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/logout', authController.logout);

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/api/auth/login' }),
  authController.googleCallback
);

export default router;
