import { Router } from 'express';
import { verifyToken, requireRole } from '../../middleware/auth.middleware.js';
import { auditMiddleware } from '../../middleware/audit.middleware.js';
import { validateTakeDose, validateSkipDose, validateAssistDose, validateConfirmDose, validateDisputeDose } from '../../validations/doseLog.schema.js';
import * as doseLogController from './doseLog.controller.js';
import * as caregiverDoseLogController from './caregiverDoseLog.controller.js';

const router = Router();

router.use(verifyToken);

router.get('/', doseLogController.listDoseLogs);
router.post('/:id/take', auditMiddleware, validateTakeDose, doseLogController.takeDose);
router.post('/:id/skip', auditMiddleware, validateSkipDose, doseLogController.skipDose);

router.post('/:id/assist', auditMiddleware, requireRole('caregiver', 'doctor', 'admin'), validateAssistDose, caregiverDoseLogController.assistDose);
router.post('/:id/confirm', auditMiddleware, requireRole('caregiver', 'doctor', 'admin'), validateConfirmDose, caregiverDoseLogController.confirmDose);
router.post('/:id/dispute', auditMiddleware, requireRole('caregiver', 'doctor', 'admin'), validateDisputeDose, caregiverDoseLogController.disputeDose);
router.get('/pending-confirmation', requireRole('caregiver', 'doctor', 'admin'), caregiverDoseLogController.getPendingConfirmations);
router.get('/assisted-history', requireRole('caregiver', 'doctor', 'admin'), caregiverDoseLogController.getAssistedHistory);

export default router;
