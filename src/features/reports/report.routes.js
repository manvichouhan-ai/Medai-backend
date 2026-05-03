import { Router } from 'express';
import { verifyToken, requireRole } from '../../../middleware/auth.middleware.js';
import * as reportController from './report.controller.js';

const router = Router();

router.use(verifyToken);

router.get('/patient/:id', reportController.getReport);
router.get('/export/:id', reportController.exportReport);

export default router;
