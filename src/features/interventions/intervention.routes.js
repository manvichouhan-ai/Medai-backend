import { Router } from 'express';
import { verifyToken, requireRole } from '../../../middleware/auth.middleware.js';
import { auditMiddleware } from '../../../middleware/audit.middleware.js';
import {
  validateCreateIntervention,
  validateUpdateIntervention,
  validateResolveIntervention,
} from '../../../validations/intervention.schema.js';
import * as interventionController from './intervention.controller.js';

const router = Router();

router.use(verifyToken);

router.post(
  '/',
  auditMiddleware,
  requireRole('caregiver', 'doctor', 'admin'),
  validateCreateIntervention,
  interventionController.createIntervention
);

router.get('/', requireRole('caregiver', 'doctor', 'admin'), interventionController.listInterventions);

router.get('/:id', requireRole('caregiver', 'doctor', 'admin'), interventionController.getIntervention);

router.patch(
  '/:id',
  auditMiddleware,
  requireRole('caregiver', 'doctor', 'admin'),
  validateUpdateIntervention,
  interventionController.updateIntervention
);

router.post(
  '/:id/resolve',
  auditMiddleware,
  requireRole('doctor', 'admin'),
  validateResolveIntervention,
  interventionController.resolveIntervention
);

export default router;
