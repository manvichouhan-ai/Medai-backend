import { Router } from 'express';
import { verifyToken } from '../../middleware/auth.middleware.js';
import * as adherenceController from './adherence.controller.js';

const router = Router();

router.use(verifyToken);

router.get('/summary', adherenceController.getAdherenceSummary);
router.get('/history', adherenceController.getAdherenceHistory);

export default router;
