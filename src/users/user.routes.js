import { Router } from 'express';
import { verifyToken } from '../../middleware/auth.middleware.js';
import { auditMiddleware } from '../../middleware/audit.middleware.js';
import * as userController from './user.controller.js';

const router = Router();

router.use(verifyToken);

router.get('/me', userController.getMe);
router.patch('/me', auditMiddleware, userController.updateMe);

export default router;
