import { Router } from 'express';
import { verifyToken, requireRole } from '../../middleware/auth.middleware.js';
import * as medicationController from './medication.controller.js';

const router = Router();

router.use(verifyToken);

// COMPATIBILITY LAYER: Frontend Caregiver Medication page depends on these endpoints
// Internally uses NEW PatientMedication + MasterMedication system
router.get('/', medicationController.listMedications);

// Today page endpoint - must come before /:id to avoid route conflict
router.get('/today', medicationController.getTodayDoses);

router.get('/:id', medicationController.getMedicationById);

export default router;
