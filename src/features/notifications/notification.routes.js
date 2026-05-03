import { Router } from 'express';
import { verifyToken } from '../../../middleware/auth.middleware.js';
import * as notificationController from './notification.controller.js';

const router = Router();

router.use(verifyToken);

router.post('/test', notificationController.sendTestNotification);

export default router;
