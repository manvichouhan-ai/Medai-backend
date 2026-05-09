import { Router } from 'express';
import { verifyToken, requireRole } from '../../middleware/auth.middleware.js';
import { auditMiddleware } from '../../middleware/audit.middleware.js';
import {
  validateCreateMedicationRequest,
  validateApproveMedicationRequest,
  validateRejectMedicationRequest,
} from '../../validations/medicationRequest.schema.js';
import * as medicationRequestController from './medicationRequest.controller.js';

const router = Router();

router.use(verifyToken);

router.post(
  '/',
  auditMiddleware,
  requireRole('patient', 'caregiver'),
  validateCreateMedicationRequest,
  medicationRequestController.createRequest
);

router.get('/', requireRole('doctor', 'admin'), medicationRequestController.listRequests);

router.get(
  '/my-requests',
  requireRole('patient', 'caregiver'),
  medicationRequestController.listRequests
);

router.get('/:id', medicationRequestController.getRequest);

router.post(
  '/:id/approve',
  auditMiddleware,
  requireRole('doctor'),
  validateApproveMedicationRequest,
  medicationRequestController.approveRequest
);

router.post(
  '/:id/reject',
  auditMiddleware,
  requireRole('doctor'),
  validateRejectMedicationRequest,
  medicationRequestController.rejectRequest
);

export default router;
