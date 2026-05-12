// src/features/doctor/doctor.routes.js
import { Router } from 'express';
import { verifyToken, requireRole } from '../../../middleware/auth.middleware.js';
import { auditMiddleware } from '../../../middleware/audit.middleware.js';
import {
  validateResolveAlert,
  validateEscalateAlert,
  validateCreateIntervention,
  validateCreatePatient,
  validateCreateCaregiver,
  validateAssignCaregiver,
} from '../../../validations/doctor.schema.js';
import {
  validateCreateMasterMedication,
  validateUpdateMasterMedication,
} from '../../../validations/masterMedication.schema.js';
import {
  validateAssignMedication,
  validateUpdatePatientMedication,
} from '../../../validations/patientMedication.schema.js';
import * as doctorController from './doctor.controller.js';
import * as masterMedicationController from './masterMedication.controller.js';
import * as patientMedicationController from './patientMedication.controller.js';

const router = Router();
router.use(verifyToken);

// Dashboard
router.get('/dashboard', requireRole('doctor', 'admin'), doctorController.getDashboard);

// Patients
router.post(
  '/patients',
  auditMiddleware,
  requireRole('doctor', 'admin'),
  validateCreatePatient,
  doctorController.createPatientAccount
);
router.get('/patients', requireRole('doctor', 'admin'), doctorController.listPatients);
router.get('/patients/:id', requireRole('doctor', 'admin'), doctorController.getPatientById);
router.post(
  '/patients/:id/assign-caregiver',
  auditMiddleware,
  requireRole('doctor', 'admin'),
  validateAssignCaregiver,
  doctorController.assignCaregiver
);

// Patient sub-resources
router.get(
  '/patients/:id/dose-logs',
  requireRole('doctor', 'admin'),
  doctorController.listPatientDoseLogs
);
router.get(
  '/patients/:id/adherence',
  requireRole('doctor', 'admin'),
  doctorController.getPatientAdherenceData
);
router.get(
  '/patients/:id/risk',
  requireRole('doctor', 'admin'),
  doctorController.getPatientRiskData
);
router.get(
  '/patients/:id/insights',
  requireRole('doctor', 'admin'),
  doctorController.getPatientInsightsData
);

// Patient medication assignments
router.post(
  '/patients/:id/medications',
  auditMiddleware,
  requireRole('doctor', 'admin'),
  validateAssignMedication,
  patientMedicationController.assignMedication
);
router.get(
  '/patients/:id/medications',
  requireRole('doctor', 'admin'),
  patientMedicationController.listPatientMedications
);

// Patient medication CRUD
router.get(
  '/patient-medications/:id',
  requireRole('doctor', 'admin'),
  patientMedicationController.getPatientMedication
);
router.patch(
  '/patient-medications/:id',
  auditMiddleware,
  requireRole('doctor', 'admin'),
  validateUpdatePatientMedication,
  patientMedicationController.updatePatientMedicationController
);
router.delete(
  '/patient-medications/:id',
  auditMiddleware,
  requireRole('doctor', 'admin'),
  patientMedicationController.deletePatientMedicationController
);

// Master medication catalog
router.get(
  '/medications',
  requireRole('doctor', 'admin'),
  masterMedicationController.listMasterMedications
);
router.get(
  '/medications/categories',
  requireRole('doctor', 'admin'),
  masterMedicationController.listMedicationCategories
);
router.get(
  '/medications/:id',
  requireRole('doctor', 'admin'),
  masterMedicationController.getMasterMedication
);
router.post(
  '/medications',
  auditMiddleware,
  requireRole('doctor', 'admin'),
  validateCreateMasterMedication,
  masterMedicationController.createMasterMedicationController
);
router.patch(
  '/medications/:id',
  auditMiddleware,
  requireRole('doctor', 'admin'),
  validateUpdateMasterMedication,
  masterMedicationController.updateMasterMedicationController
);
router.delete(
  '/medications/:id',
  auditMiddleware,
  requireRole('doctor', 'admin'),
  masterMedicationController.deleteMasterMedicationController
);

// Caregivers
router.post(
  '/caregivers',
  auditMiddleware,
  requireRole('doctor', 'admin'),
  validateCreateCaregiver,
  doctorController.createCaregiverAccount
);
router.get('/caregivers', requireRole('doctor', 'admin'), doctorController.listCaregivers);

// Alerts — support both POST and PATCH for frontend compatibility
router.get('/alerts', requireRole('doctor', 'admin'), doctorController.listAlerts);
router.post(
  '/alerts/:id/resolve',
  auditMiddleware,
  requireRole('doctor', 'admin'),
  validateResolveAlert,
  doctorController.resolveAlertById
);
router.patch(
  '/alerts/:id/resolve',
  auditMiddleware,
  requireRole('doctor', 'admin'),
  doctorController.resolveAlertById
);
router.post(
  '/alerts/:id/escalate',
  auditMiddleware,
  requireRole('doctor', 'admin'),
  validateEscalateAlert,
  doctorController.escalateAlertById
);
router.patch(
  '/alerts/:id/escalate',
  auditMiddleware,
  requireRole('doctor', 'admin'),
  doctorController.escalateAlertById
);

// Interventions — FIX TYPO: intatentions → interventions
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
