import { Router } from 'express';
import { verifyToken } from '../../../middleware/auth.middleware.js';
import { auditMiddleware } from '../../../middleware/audit.middleware.js';
import * as alertController from './alert.controller.js';

const router = Router();

router.use(verifyToken);

router.get('/', alertController.listAlerts);
router.patch('/:id/acknowledge', auditMiddleware, alertController.acknowledgeAlert);

export default router;
