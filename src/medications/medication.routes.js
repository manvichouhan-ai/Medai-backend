import { Router } from 'express';
import { verifyToken, requireRole } from '../../middleware/auth.middleware.js';
import { auditMiddleware } from '../../middleware/audit.middleware.js';
import { validateCreateMedication, validateUpdateMedication } from '../../validations/medication.schema.js';
import * as medicationController from './medication.controller.js';

const router = Router();

router.use(verifyToken);

router.get('/', medicationController.listMedications);
router.get('/today', medicationController.getTodayDoses);
router.get('/:id', medicationController.getMedicationById);
router.post('/', auditMiddleware, requireRole('doctor', 'admin'), validateCreateMedication, medicationController.createMedication);
router.patch('/:id', auditMiddleware, validateUpdateMedication, medicationController.updateMedication);
router.delete('/:id', auditMiddleware, medicationController.deleteMedication);

export default router;
