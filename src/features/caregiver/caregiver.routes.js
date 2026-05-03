import { Router } from 'express';
import { verifyToken, requireRole } from '../../../middleware/auth.middleware.js';
import { auditMiddleware } from '../../../middleware/audit.middleware.js';
import { validateNote } from '../../../validations/caregiver.schema.js';
import * as caregiverController from './caregiver.controller.js';

const router = Router();

router.use(verifyToken);

router.get('/patients', requireRole('caregiver', 'doctor', 'admin'), caregiverController.listPatients);
router.get('/patients/:id/summary', requireRole('caregiver', 'doctor', 'admin'), caregiverController.getPatientSummary);
router.post('/invite/:patientEmail', auditMiddleware, requireRole('caregiver', 'doctor'), caregiverController.invitePatient);
router.patch('/invite/:id/accept', auditMiddleware, requireRole('patient'), caregiverController.acceptInvite);
router.post('/patients/:id/notes', auditMiddleware, requireRole('caregiver', 'doctor'), validateNote, caregiverController.addNote);

export default router;
