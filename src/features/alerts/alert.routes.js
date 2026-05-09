import { Router } from 'express';
import { verifyToken, requireRole } from '../../../middleware/auth.middleware.js';
import { auditMiddleware } from '../../../middleware/audit.middleware.js';
import { validateEscalateAlert, validateResolveAlert } from '../../../validations/intervention.schema.js';
import * as alertController from './alert.controller.js';

const router = Router();

router.use(verifyToken);

router.get('/', alertController.listAlerts);
router.patch('/:id/acknowledge', auditMiddleware, alertController.acknowledgeAlert);
router.post('/:id/escalate', auditMiddleware, requireRole('caregiver', 'doctor', 'admin'), validateEscalateAlert, alertController.escalateAlert);
router.post('/:id/resolve', auditMiddleware, requireRole('caregiver', 'doctor', 'admin'), validateResolveAlert, alertController.resolveAlert);

export default router;
