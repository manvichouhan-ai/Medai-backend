import { Router } from 'express';
import { verifyToken, requireRole } from '../../../middleware/auth.middleware.js';
import { auditMiddleware } from '../../../middleware/audit.middleware.js';
import {
  validateResolveAlert,
  validateEscalateAlert,
  validateCreateIntervention,
} from '../../../validations/doctor.schema.js';
import * as doctorController from './doctor.controller.js';

const router = Router();

router.use(verifyToken);

router.get('/patients', requireRole('doctor', 'admin'), doctorController.listPatients);
router.get('/patients/:id', requireRole('doctor', 'admin'), doctorController.getPatientById);
router.get('/patients/:id/medications', requireRole('doctor', 'admin'), doctorController.listPatientMedications);
router.get('/patients/:id/dose-logs', requireRole('doctor', 'admin'), doctorController.listPatientDoseLogs);
router.get('/patients/:id/adherence', requireRole('doctor', 'admin'), doctorController.getPatientAdherenceData);
router.get('/patients/:id/risk', requireRole('doctor', 'admin'), doctorController.getPatientRiskData);
router.get('/patients/:id/insights', requireRole('doctor', 'admin'), doctorController.getPatientInsightsData);

router.get('/alerts', requireRole('doctor', 'admin'), doctorController.listAlerts);
router.post(
  '/alerts/:id/resolve',
  auditMiddleware,
  requireRole('doctor', 'admin'),
  validateResolveAlert,
  doctorController.resolveAlertById
);
router.post(
  '/alerts/:id/escalate',
  auditMiddleware,
  requireRole('doctor', 'admin'),
  validateEscalateAlert,
  doctorController.escalateAlertById
);

router.post(
  '/interventions',
  auditMiddleware,
  requireRole('doctor', 'admin'),
  validateCreateIntervention,
  doctorController.createDoctorIntervention
);
router.get(
  '/interventions/:patientId',
  requireRole('doctor', 'admin'),
  doctorController.listPatientInterventions
);

export default router;