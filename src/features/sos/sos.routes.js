import { Router } from 'express';
import { verifyToken, requireRole } from '../../../middleware/auth.middleware.js';
import * as sosController from './sos.controller.js';

const router = Router();

router.use(verifyToken);

// ─── Patient routes ───────────────────────────────────────────────────────────
router.get('/my', requireRole('patient'), sosController.listMySOSMedications);
router.post('/take', requireRole('patient'), sosController.takeSOSDose);

// ─── Doctor routes ────────────────────────────────────────────────────────────
router.post('/', requireRole('doctor', 'admin'), sosController.createSOSMedication);
router.get('/', requireRole('doctor', 'admin'), sosController.listSOSMedications);
router.get('/:id', requireRole('doctor', 'admin'), sosController.getSOSMedication);
router.put('/:id', requireRole('doctor', 'admin'), sosController.updateSOSMedication);
router.delete('/:id', requireRole('doctor', 'admin'), sosController.deleteSOSMedication);
router.post('/:id/assign', requireRole('doctor', 'admin'), sosController.assignPatients);
router.delete('/:id/assign/:patientId', requireRole('doctor', 'admin'), sosController.unassignPatient);

// ─── Shared routes ────────────────────────────────────────────────────────────
router.get('/:id/logs', requireRole('doctor', 'admin'), sosController.getMedicationLogs);

export default router;
