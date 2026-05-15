import { Router } from 'express';
import authRoutes from '../src/auth/auth.routes.js';
import userRoutes from '../src/users/user.routes.js';
import medicationRoutes from '../src/medications/medication.routes.js'; // RE-ENABLED for /medications/today endpoint
import medicationRequestRoutes from '../src/medicationRequests/medicationRequest.routes.js';
import doseLogRoutes from '../src/doseLogs/doseLog.routes.js';
import adherenceRoutes from '../src/adherence/adherence.routes.js';
import alertRoutes from '../src/features/alerts/alert.routes.js';
import interventionRoutes from '../src/features/interventions/intervention.routes.js';
import caregiverRoutes from '../src/features/caregiver/caregiver.routes.js';
import doctorRoutes from '../src/features/doctor/doctor.routes.js';
import notificationRoutes from '../src/features/notifications/notification.routes.js';
import aiRoutes from '../src/features/ai/ai.routes.js';
import reportRoutes from '../src/features/reports/report.routes.js';
import adminRoutes from '../src/admin/admin.routes.js';
import sosRoutes from '../src/features/sos/sos.routes.js';
import { verifyToken, requireRole } from '../middleware/auth.middleware.js';
import { getPatientSOSLogs } from '../src/features/sos/sos.controller.js';

const router = Router();

router.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }));

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/medications', medicationRoutes); // RE-ENABLED - only contains /medications/today endpoint
router.use('/medication-requests', medicationRequestRoutes);
router.use('/dose-logs', doseLogRoutes);
router.use('/adherence', adherenceRoutes);
router.use('/alerts', alertRoutes);
router.use('/interventions', interventionRoutes);
router.use('/caregiver', caregiverRoutes);
router.use('/doctor', doctorRoutes);
router.use('/notifications', notificationRoutes);
router.use('/ai', aiRoutes);
router.use('/reports', reportRoutes);
router.use('/admin', adminRoutes);
router.use('/sos-medications', sosRoutes);
router.get('/patients/:patientId/sos-logs', verifyToken, requireRole('doctor', 'admin', 'caregiver'), getPatientSOSLogs);

export default router;
