import { Router } from 'express';
import { verifyToken } from '../../middleware/auth.middleware.js';
import { auditMiddleware } from '../../middleware/audit.middleware.js';
import { validateTakeDose, validateSkipDose } from '../../validations/doseLog.schema.js';
import * as doseLogController from './doseLog.controller.js';

const router = Router();

router.use(verifyToken);

router.get('/', doseLogController.listDoseLogs);
router.post('/:id/take', auditMiddleware, validateTakeDose, doseLogController.takeDose);
router.post('/:id/skip', auditMiddleware, validateSkipDose, doseLogController.skipDose);

export default router;
