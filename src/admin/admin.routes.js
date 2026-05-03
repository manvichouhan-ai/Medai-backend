import { Router } from 'express';
import { verifyToken, requireRole } from '../../middleware/auth.middleware.js';
import * as adminController from './admin.controller.js';

const router = Router();

router.use(verifyToken, requireRole('admin'));

router.get('/metrics', adminController.getMetrics);

export default router;
