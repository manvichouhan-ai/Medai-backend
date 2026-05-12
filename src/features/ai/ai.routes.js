import { Router } from 'express';
import { verifyToken, requireRole } from '../../../middleware/auth.middleware.js';
import * as aiController from './ai.controller.js';

const router = Router();

router.use(verifyToken);

router.get('/risk/:patientId', aiController.getRiskScore);
router.get('/insights/:patientId', aiController.getInsights);

export default router;
