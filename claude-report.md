# MedAI Backend Code Report

## Core Application Files

### app.js
```javascript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import passport from './config/passport.js';
import { env } from './config/env.js';
import router from './routes/index.js';
import { errorMiddleware } from './middleware/error.middleware.js';
import { logger } from './src/utils/logger.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(morgan('dev', { stream: { write: (msg) => logger.http(msg.trim()) } }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(passport.initialize());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later' },
});

app.use('/api/auth', authLimiter);
app.use('/api', router);

app.use(errorMiddleware);

export default app;
```

### server.js
```javascript
import { createServer } from 'http';
import app from './app.js';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { connectRedis } from './config/redis.js';
import { initSocket } from './src/socket/index.js';
import { startReminderJob } from './src/jobs/reminderJob.js';
import { startMissedDoseJob } from './src/jobs/missedDoseJob.js';
import { startPredictionJob } from './src/jobs/predictionJob.js';
import { logger } from './src/utils/logger.js';

const httpServer = createServer(app);
initSocket(httpServer);

async function start() {
  try {
    await connectDB();
    await connectRedis();

    startReminderJob();
    startMissedDoseJob();
    startPredictionJob();

    httpServer.listen(env.PORT, () => {
      logger.info(`MedAI server running on port ${env.PORT} [${env.NODE_ENV}]`);
    });
  } catch (err) {
    logger.error('Failed to start server', { error: err.message });
    process.exit(1);
  }
}

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled rejection', { error: err.message });
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  httpServer.close(() => process.exit(0));
});

start();
```

### config/env.js
```javascript
import 'dotenv/config';

const required = ['JWT_SECRET', 'MONGODB_URI'];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: process.env.MONGODB_URI,
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '30d',
  REFRESH_TOKEN_EXPIRES_DAYS: parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || '7', 10),
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  GOOGLE_CALLBACK_URL:
    process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback',
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || '',
  FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY || '',
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || '',
  EMAIL_HOST: process.env.EMAIL_HOST || 'smtp.gmail.com',
  EMAIL_PORT: parseInt(process.env.EMAIL_PORT || '587', 10),
  EMAIL_USER: process.env.EMAIL_USER || '',
  EMAIL_PASS: process.env.EMAIL_PASS || '',
  FROM_EMAIL: process.env.FROM_EMAIL || 'alerts@medai.app',
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',
  PYTHON_AI_URL: process.env.PYTHON_AI_URL || 'http://localhost:8001',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
};
```

## Middleware

### middleware/auth.middleware.js
```javascript
import { verifyAccessToken } from '../src/utils/jwt.utils.js';
import User from '../models/User.model.js';
import DoctorPatient from '../models/DoctorPatient.model.js';
import CaregiverPatient from '../models/CaregiverPatient.model.js';
import { sendError } from '../src/utils/response.utils.js';
import { logger } from '../src/utils/logger.js';

export async function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return sendError(res, 'No token provided', 401);
    }
    const token = authHeader.slice(7);
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.userId).select('-passwordHash');
    if (!user || !user.isActive) {
      return sendError(res, 'User not found or inactive', 401);
    }
    req.user = user;
    next();
  } catch (err) {
    logger.debug('Token verification failed', { error: err.message });
    return sendError(res, 'Invalid or expired token', 401);
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return sendError(res, 'Unauthorized', 401);
    if (!roles.includes(req.user.role)) {
      return sendError(res, 'Forbidden: insufficient role', 403);
    }
    next();
  };
}

export async function requireDoctorPatientAccess(req, res, next) {
  try {
    const { id } = req.params;
    const doctorId = req.user._id;

    const link = await DoctorPatient.findOne({
      doctorId,
      patientId: id,
      status: 'active',
    });

    if (!link) {
      return sendError(res, 'Not authorized to access this patient', 403);
    }

    next();
  } catch (err) {
    logger.error('Doctor patient access check failed', { error: err.message });
    return sendError(res, 'Access check failed', 500);
  }
}

export async function requireCaregiverPatientAccess(req, res, next) {
  try {
    const { id } = req.params;
    const caregiverId = req.user._id;

    const link = await CaregiverPatient.findOne({
      caregiverId,
      patientId: id,
      status: 'active',
    });

    if (!link) {
      return sendError(res, 'Not authorized to access this patient', 403);
    }

    next();
  } catch (err) {
    logger.error('Caregiver patient access check failed', { error: err.message });
    return sendError(res, 'Access check failed', 500);
  }
}

export async function requireOwnResource(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    if (id !== userId.toString()) {
      return sendError(res, 'Not authorized to access this resource', 403);
    }

    next();
  } catch (err) {
    logger.error('Own resource access check failed', { error: err.message });
    return sendError(res, 'Access check failed', 500);
  }
}
```

### middleware/error.middleware.js
```javascript
import { logger } from '../src/utils/logger.js';

export function errorMiddleware(err, req, res, _next) {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (err.name === 'ValidationError') {
    return res.status(400).json({ success: false, error: err.message });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, error: 'Invalid ID format' });
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({ success: false, error: `Duplicate value for ${field}` });
  }

  const statusCode = err.statusCode || err.status || 500;
  const message =
    process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'Internal server error'
      : err.message;

  return res.status(statusCode).json({ success: false, error: message });
}
```

## Routes

### routes/index.js
```javascript
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

export default router;
```

## Authentication Module

### src/auth/auth.controller.js
```javascript
import * as authService from './auth.service.js';
import { sendSuccess, sendError } from '../utils/response.utils.js';
import { env } from '../../config/env.js';
import { logger } from '../utils/logger.js';

const COOKIE_OPTS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: env.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
};

export async function register(req, res, next) {
  try {
    const { user, accessToken, refreshToken } = await authService.registerUser(req.body);
    res.cookie('refreshToken', refreshToken, COOKIE_OPTS);
    return sendSuccess(res, { user, accessToken }, 201);
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { user, accessToken, refreshToken } = await authService.loginUser(req.body);
    res.cookie('refreshToken', refreshToken, COOKIE_OPTS);
    return sendSuccess(res, { user, accessToken });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req, res, next) {
  try {
    const refreshToken = req.cookies?.refreshToken;
    const { accessToken } = await authService.refreshAccessToken(refreshToken);
    return sendSuccess(res, { accessToken });
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res, next) {
  try {
    const refreshToken = req.cookies?.refreshToken;
    await authService.logoutUser(refreshToken);
    res.clearCookie('refreshToken');
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function googleCallback(req, res, next) {
  try {
    const { user, accessToken, refreshToken } = await authService.handleGoogleUser(req.user);
    res.cookie('refreshToken', refreshToken, COOKIE_OPTS);
    return sendSuccess(res, { user, accessToken });
  } catch (err) {
    next(err);
  }
}
```

### src/auth/auth.service.js
```javascript
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { addDays } from 'date-fns';
import User from '../../models/User.model.js';
import Token from '../../models/Token.model.js';
import { signAccessToken } from '../utils/jwt.utils.js';
import { redis } from '../../config/redis.js';
import { env } from '../../config/env.js';
import { logger } from '../utils/logger.js';

const BCRYPT_ROUNDS = 12;
const REFRESH_TTL_SECONDS = env.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60;

async function issueTokens(user) {
  const accessToken = signAccessToken({ userId: user._id.toString(), role: user.role });

  const refreshToken = uuidv4();
  const expiresAt = addDays(new Date(), env.REFRESH_TOKEN_EXPIRES_DAYS);

  await Promise.all([
    Token.create({ userId: user._id, token: refreshToken, type: 'refresh', expiresAt }),
    redis.set(`refresh:${refreshToken}`, user._id.toString(), 'EX', REFRESH_TTL_SECONDS),
  ]);

  return { accessToken, refreshToken };
}

export async function registerUser({ email, password, fullName, role, phone, timezone }) {
  const existing = await User.findOne({ email });
  if (existing) throw Object.assign(new Error('Email already in use'), { statusCode: 409 });

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await User.create({ email, passwordHash, fullName, role, phone, timezone });

  const { accessToken, refreshToken } = await issueTokens(user);
  return { user: user.toSafeObject(), accessToken, refreshToken };
}

export async function loginUser({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user) throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });

  if (!user.isActive) throw Object.assign(new Error('Account is deactivated'), { statusCode: 403 });

  const { accessToken, refreshToken } = await issueTokens(user);
  return { user: user.toSafeObject(), accessToken, refreshToken };
}

export async function refreshAccessToken(refreshToken) {
  if (!refreshToken) throw Object.assign(new Error('No refresh token'), { statusCode: 401 });

  const userId = await redis.get(`refresh:${refreshToken}`);
  if (!userId) throw Object.assign(new Error('Invalid or expired refresh token'), { statusCode: 401 });

  const user = await User.findById(userId);
  if (!user || !user.isActive) throw Object.assign(new Error('User not found'), { statusCode: 401 });

  const accessToken = signAccessToken({ userId: user._id.toString(), role: user.role });
  return { accessToken };
}

export async function logoutUser(refreshToken) {
  if (!refreshToken) return;
  await Promise.allSettled([
    redis.del(`refresh:${refreshToken}`),
    Token.deleteOne({ token: refreshToken, type: 'refresh' }),
  ]);
}

export async function handleGoogleUser(googleUser) {
  const { accessToken, refreshToken } = await issueTokens(googleUser);
  return { user: googleUser.toSafeObject(), accessToken, refreshToken };
}
```

### src/auth/auth.routes.js
```javascript
import { Router } from 'express';
import passport from '../../config/passport.js';
import * as authController from './auth.controller.js';
import { validate, registerSchema, loginSchema } from '../../validations/auth.schema.js';

const router = Router();

router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/logout', authController.logout);

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/api/auth/login' }),
  authController.googleCallback
);

export default router;
```

## Utilities

### src/utils/response.utils.js
```javascript
export function sendSuccess(res, data, statusCode = 200) {
  const processedData = normalizeIds(data);
  return res.status(statusCode).json({ success: true, data: processedData });
}

export function sendError(res, message, statusCode = 400) {
  return res.status(statusCode).json({ success: false, error: message });
}

/**
 * Recursively converts MongoDB _id to id in objects and arrays
 * This ensures frontend always receives 'id' field instead of '_id'
 */
function normalizeIds(data, visited = new WeakSet()) {
  if (!data) return data;

  if (Array.isArray(data)) {
    return data.map(item => normalizeIds(item, visited));
  }

  if (typeof data === 'object' && data !== null) {
    // Handle circular references
    if (visited.has(data)) {
      return data;
    }
    visited.add(data);

    const normalized = { ...data };
    
    // Convert _id to id
    if (normalized._id) {
      normalized.id = normalized._id.toString();
      delete normalized._id;
    }
    
    // Convert nested _id fields
    for (const key in normalized) {
      if (normalized[key] && typeof normalized[key] === 'object') {
        normalized[key] = normalizeIds(normalized[key], visited);
      }
    }
    
    return normalized;
  }

  return data;
}
```

### src/utils/jwt.utils.js
```javascript
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';

export function signAccessToken(payload) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}
```

## Doctor Module

### src/features/doctor/doctor.routes.js
```javascript
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
import { validateCreateMedication, validateUpdateMedication } from '../../../validations/medication.schema.js';
import { validateCreateMasterMedication, validateUpdateMasterMedication } from '../../../validations/masterMedication.schema.js';
import { validateAssignMedication, validateUpdatePatientMedication } from '../../../validations/patientMedication.schema.js';
import * as doctorController from './doctor.controller.js';
import * as masterMedicationController from './masterMedication.controller.js';
import * as patientMedicationController from './patientMedication.controller.js';

const router = Router();

router.use(verifyToken);

router.get('/dashboard', requireRole('doctor', 'admin'), doctorController.getDashboard);

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
// MASTER MEDICATION ENDPOINTS
router.get('/medications', requireRole('doctor', 'admin'), masterMedicationController.listMasterMedications);
router.get('/medications/categories', requireRole('doctor', 'admin'), masterMedicationController.listMedicationCategories);
router.get('/medications/:id', requireRole('doctor', 'admin'), masterMedicationController.getMasterMedication);
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

// PATIENT MEDICATION ASSIGNMENT ENDPOINTS
router.post(
  '/patients/:id/medications',
  auditMiddleware,
  requireRole('doctor', 'admin'),
  validateAssignMedication,
  patientMedicationController.assignMedication
);
router.get('/patients/:id/medications', requireRole('doctor', 'admin'), patientMedicationController.listPatientMedications);
router.get('/patient-medications/:id', requireRole('doctor', 'admin'), patientMedicationController.getPatientMedication);
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
router.get('/patients/:id/dose-logs', requireRole('doctor', 'admin'), doctorController.listPatientDoseLogs);
router.get('/patients/:id/adherence', requireRole('doctor', 'admin'), doctorController.getPatientAdherenceData);

router.post(
  '/caregivers',
  auditMiddleware,
  requireRole('doctor', 'admin'),
  validateCreateCaregiver,
  doctorController.createCaregiverAccount
);
router.get('/caregivers', requireRole('doctor', 'admin'), doctorController.listCaregivers);


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
```

### src/features/doctor/doctor.controller.js
```javascript
import {
  getAssignedPatients,
  getPatientProfile,
  getPatientDoseLogs,
  getPatientAdherence,
  getPatientRisk,
  getPatientInsights,
  getDoctorAlerts,
  resolveAlert,
  escalateAlert,
  createIntervention,
  getPatientInterventions,
  createPatient,
  createCaregiver,
  getAssignedCaregivers,
  assignCaregiverToPatient,
} from './doctor.service.js';
import { getDoctorDashboard } from './doctor.dashboard.service.js';
import { sendSuccess, sendError } from '../../utils/response.utils.js';

export async function listPatients(req, res) {
  try {
    const { search, riskLevel, adherenceFilter, page, limit } = req.query;
    const result = await getAssignedPatients(req.user._id, {
      search,
      riskLevel,
      adherenceFilter,
      page,
      limit,
    });
    return sendSuccess(res, result);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}

export async function getPatientById(req, res) {
  try {
    const { id } = req.params;
    const result = await getPatientProfile(req.user._id, id);
    return sendSuccess(res, result);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}


export async function listPatientDoseLogs(req, res) {
  try {
    const { id } = req.params;
    const { status, fromDate, toDate, page, limit } = req.query;
    const result = await getPatientDoseLogs(req.user._id, id, {
      status,
      fromDate,
      toDate,
      page,
      limit,
    });
    return sendSuccess(res, result);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}

export async function getPatientAdherenceData(req, res) {
  try {
    const { id } = req.params;
    const result = await getPatientAdherence(req.user._id, id);
    return sendSuccess(res, result);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}

export async function getPatientRiskData(req, res) {
  try {
    const { id } = req.params;
    const result = await getPatientRisk(req.user._id, id);
    return sendSuccess(res, result);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}

export async function getPatientInsightsData(req, res) {
  try {
    const { id } = req.params;
    const result = await getPatientInsights(req.user._id, id);
    return sendSuccess(res, result);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}

export async function listAlerts(req, res) {
  try {
    const { unresolved, severity, patientId, page, limit } = req.query;
    const result = await getDoctorAlerts(req.user._id, {
      unresolved,
      severity,
      patientId,
      page,
      limit,
    });
    return sendSuccess(res, result);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}

export async function resolveAlertById(req, res) {
  try {
    const { id } = req.params;
    const { resolutionNotes } = req.body;
    const result = await resolveAlert(id, req.user._id, { resolutionNotes });
    return sendSuccess(res, result);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}

export async function escalateAlertById(req, res) {
  try {
    const { id } = req.params;
    const { escalationNotes } = req.body;
    const result = await escalateAlert(id, req.user._id, { escalationNotes });
    return sendSuccess(res, result);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}

export async function createDoctorIntervention(req, res) {
  try {
    const data = req.body;
    const result = await createIntervention(req.user._id, data);
    return sendSuccess(res, result, 201);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}

export async function listPatientInterventions(req, res) {
  try {
    const { patientId } = req.params;
    const { status, page, limit } = req.query;
    const result = await getPatientInterventions(req.user._id, patientId, {
      status,
      page,
      limit,
    });
    return sendSuccess(res, result);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}

export async function createPatientAccount(req, res) {
  try {
    const data = req.body;
    const result = await createPatient(req.user._id, data);
    return sendSuccess(res, result, 201);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}

export async function createCaregiverAccount(req, res) {
  try {
    const data = req.body;
    const result = await createCaregiver(req.user._id, data);
    return sendSuccess(res, result, 201);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}

export async function listCaregivers(req, res) {
  try {
    const result = await getAssignedCaregivers(req.user._id);
    return sendSuccess(res, result);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}

export async function assignCaregiver(req, res) {
  try {
    const { id } = req.params;
    const data = req.body;
    const result = await assignCaregiverToPatient(req.user._id, id, data);
    return sendSuccess(res, result, 201);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}


export async function getDashboard(req, res) {
  try {
    const data = await getDoctorDashboard(req.user._id);
    return sendSuccess(res, data);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}
```

### src/features/doctor/doctor.service.js
```javascript
import bcrypt from 'bcrypt';
import DoctorPatient from '../../../models/DoctorPatient.model.js';
import User from '../../../models/User.model.js';
import Medication from '../../../models/Medication.model.js';
import PatientMedication from '../../../models/PatientMedication.model.js';
import DoseLog from '../../../models/DoseLog.model.js';
import Alert from '../../../models/Alert.model.js';
import Intervention from '../../../models/Intervention.model.js';
import CaregiverPatient from '../../../models/CaregiverPatient.model.js';
import { getAdherenceSummary, getAdherenceHistory } from '../../adherence/adherence.service.js';
import { getRiskScore } from '../ai/ai.service.js';
import { generateInsight } from '../ai/ai.service.js';
import { generateDoseLogs } from '../../medications/medication.service.js';
import { logger } from '../../utils/logger.js';

const BCRYPT_ROUNDS = 12;

async function validateDoctorPatientAccess(doctorId, patientId) {
  const link = await DoctorPatient.findOne({
    doctorId,
    patientId,
    status: 'active',
  });
  if (!link) {
    throw Object.assign(new Error('Not authorized to access this patient'), { statusCode: 403 });
  }
  return link;
}

export async function getAssignedPatients(doctorId, filters = {}) {
  const { search, riskLevel, adherenceFilter, page = 1, limit = 20 } = filters;

  const query = { doctorId, status: 'active' };

  const skip = (page - 1) * limit;

  let links = await DoctorPatient.find(query)
    .populate('patientId', 'fullName email phone timezone notificationPrefs age')
    .skip(skip)
    .limit(Number(limit))
    .lean();

  let patients = await Promise.all(
    links.map(async (link) => {
      const patient = link.patientId;
      if (!patient) return null;

      const [adherence, activeMeds, pendingAlerts, riskData] = await Promise.all([
        getAdherenceSummary(patient._id),
        Medication.countDocuments({ patientId: patient._id, isActive: true }),
        Alert.countDocuments({ patientId: patient._id, status: 'active' }),
        getRiskScore(patient._id),
      ]);

      const avgAdherence =
        adherence.length > 0
          ? Math.round(adherence.reduce((a, m) => a + m.adherence7d, 0) / adherence.length)
          : 0;

      return {
        patientId: patient._id,
        patient,
        adherenceScore: avgAdherence,
        activeMedications: activeMeds,
        latestRiskLevel: riskData.riskLevel || 'medium',
        pendingAlerts,
      };
    })
  );

  patients = patients.filter(Boolean);

  if (search) {
    const searchLower = search.toLowerCase();
    patients = patients.filter((p) =>
      p.patient.fullName.toLowerCase().includes(searchLower) ||
      p.patient.email.toLowerCase().includes(searchLower)
    );
  }

  if (riskLevel) {
    patients = patients.filter((p) => p.latestRiskLevel === riskLevel);
  }

  if (adherenceFilter) {
    const minAdherence = parseInt(adherenceFilter);
    patients = patients.filter((p) => p.adherenceScore >= minAdherence);
  }

  const total = await DoctorPatient.countDocuments(query);

  return {
    patients,
    total,
    page: Number(page),
    limit: Number(limit),
  };
}

export async function getPatientProfile(doctorId, patientId) {
  await validateDoctorPatientAccess(doctorId, patientId);

  const patient = await User.findById(patientId).select('-passwordHash').lean();
  if (!patient) {
    throw Object.assign(new Error('Patient not found'), { statusCode: 404 });
  }

  const [adherence, medications, recentAlerts, interventions, caregivers] = await Promise.all([
    getAdherenceSummary(patientId),
    PatientMedication.find({ patientId, isActive: true })
      .populate('medicationId', 'name genericName category strength form')
      .populate('assignedByDoctor', 'fullName email')
      .lean(),
    Alert.find({ patientId }).sort({ createdAt: -1 }).limit(10).lean(),
    Intervention.find({ patientId }).sort({ createdAt: -1 }).limit(10)
      .populate('createdBy', ' fullName email')
      .populate('assignedTo', 'fullName email')
      .lean(),
    CaregiverPatient.find({ patientId, status: 'active' })
      .populate('caregiverId', 'fullName email phone')
      .lean(),
  ]);

  const avgAdherence =
    adherence.length > 0
      ? Math.round(adherence.reduce((a, m) => a + m.adherence7d, 0) / adherence.length)
      : 0;

  return {
    patient,
    adherenceSummary: adherence,
    overallAdherence: avgAdherence,
    medications,
    recentAlerts,
    interventions,
    caregivers,
  };
}

export async function getPatientMedications(doctorId, patientId, filters = {}) {
  await validateDoctorPatientAccess(doctorId, patientId);

  const { active = 'true', page = 1, limit = 20 } = filters;

  const query = { patientId };
  if (active === 'true') {
    query.isActive = true;
  }

  const skip = (page - 1) * limit;

  const [medications, total] = await Promise.all([
    Medication.find(query)
      .populate('prescribedBy', 'fullName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Medication.countDocuments(query),
  ]);

  return {
    medications,
    total,
    page: Number(page),
    limit: Number(limit),
  };
}

export async function getPatientDoseLogs(doctorId, patientId, filters = {}) {
  await validateDoctorPatientAccess(doctorId, patientId);

  const { status, fromDate, toDate, page = 1, limit = 20 } = filters;

  const query = { patientId };

  if (status) {
    query.status = status;
  }

  if (fromDate || toDate) {
    query.scheduledTime = {};
    if (fromDate) {
      query.scheduledTime.$gte = new Date(fromDate);
    }
    if (toDate) {
      query.scheduledTime.$lte = new Date(toDate);
    }
  }

  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    DoseLog.find(query)
      .populate('medicationId', 'name dosage')
      .populate('takenBy', 'fullName email')
      .populate('assistedBy', 'fullName email')
      .sort({ scheduledTime: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    DoseLog.countDocuments(query),
  ]);

  return {
    logs,
    total,
    page: Number(page),
    limit: Number(limit),
  };
}

export async function getPatientAdherence(doctorId, patientId) {
  await validateDoctorPatientAccess(doctorId, patientId);

  const [daily, weekly, monthly, missedDoseTrends] = await Promise.all([
    getAdherenceHistory(patientId, { from: null, to: null }),
    getAdherenceHistory(patientId, { from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), to: new Date() }),
    getAdherenceHistory(patientId, { from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), to: new Date() }),
    getMissedDoseTrends(patientId),
  ]);

  return {
    daily,
    weekly,
    monthly,
    missedDoseTrends,
  };
}

async function getMissedDoseTrends(patientId) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const missedLogs = await DoseLog.find({
    patientId,
    status: 'missed',
    scheduledTime: { $gte: thirtyDaysAgo },
  })
    .populate('medicationId', 'name')
    .lean();

  const byMedication = {};
  missedLogs.forEach((log) => {
    const medName = log.medicationId?.name || 'Unknown';
    byMedication[medName] = (byMedication[medName] || 0) + 1;
  });

  const byDayOfWeek = Array(7).fill(0);
  missedLogs.forEach((log) => {
    const day = new Date(log.scheduledTime).getDay();
    byDayOfWeek[day]++;
  });

  return {
    totalMissed: missedLogs.length,
    byMedication,
    byDayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(
      (day, idx) => ({ day, count: byDayOfWeek[idx] })
    ),
  };
}

export async function getPatientRisk(doctorId, patientId) {
  await validateDoctorPatientAccess(doctorId, patientId);

  const riskData = await getRiskScore(patientId);

  return {
    patientId,
    riskScore: riskData.riskScore,
    riskLevel: riskData.riskLevel,
    contributingFactors: riskData.topFactors || [],
    generatedAt: new Date(),
  };
}

export async function getPatientInsights(doctorId, patientId) {
  await validateDoctorPatientAccess(doctorId, patientId);

  const { insight } = await generateInsight(patientId);

  const missedDoseTrends = await getMissedDoseTrends(patientId);

  const recommendations = [];
  if (missedDoseTrends.totalMissed > 5) {
    recommendations.push('Consider reviewing medication schedule with patient');
  }
  if (missedDoseTrends.byDayOfWeek.some((d) => d.count > 2)) {
    const highRiskDay = missedDoseTrends.byDayOfWeek.find((d) => d.count > 2);
    recommendations.push(`Higher missed doses on ${highRiskDay.day}s - consider additional reminders`);
  }

  return {
    patientId,
    insight,
    behavioralPatterns: missedDoseTrends,
    missedDosePatterns: missedDoseTrends.byMedication,
    recommendations,
    generatedAt: new Date(),
  };
}

export async function getDoctorAlerts(doctorId, filters = {}) {
  const { unresolved, severity, patientId, page = 1, limit = 20 } = filters;

  const assignedPatientIds = await DoctorPatient.find({ doctorId, status: 'active' }).distinct('patientId');

  const query = { patientId: { $in: assignedPatientIds } };

  if (unresolved === 'true') {
    query.status = 'active';
  }

  if (severity) {
    query.type = severity;
  }

  if (patientId) {
    query.patientId = patientId;
  }

  const skip = (page - 1) * limit;

  const [alerts, total] = await Promise.all([
    Alert.find(query)
      .populate('patientId', 'fullName email')
      .populate('sentTo', 'fullName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Alert.countDocuments(query),
  ]);

  return {
    alerts,
    total,
    page: Number(page),
    limit: Number(limit),
  };
}

export async function resolveAlert(alertId, doctorId, data) {
  const alert = await Alert.findById(alertId);
  if (!alert) {
    throw Object.assign(new Error('Alert not found'), { statusCode: 404 });
  }

  const assignedPatientIds = await DoctorPatient.find({ doctorId, status: 'active' }).distinct('patientId');
  if (!assignedPatientIds.includes(alert.patientId.toString())) {
    throw Object.assign(new Error('Not authorized to resolve this alert'), { statusCode: 403 });
  }

  alert.status = 'resolved';
  alert.resolvedBy = doctorId;
  alert.resolvedAt = new Date();
  alert.resolutionNotes = data.resolutionNotes;
  await alert.save();

  logger.info('Alert resolved by doctor', { alertId, doctorId, patientId: alert.patientId });

  return alert;
}

export async function escalateAlert(alertId, doctorId, data) {
  const alert = await Alert.findById(alertId);
  if (!alert) {
    throw Object.assign(new Error('Alert not found'), { statusCode: 404 });
  }

  const assignedPatientIds = await DoctorPatient.find({ doctorId, status: 'active' }).distinct('patientId');
  if (!assignedPatientIds.includes(alert.patientId.toString())) {
    throw Object.assign(new Error('Not authorized to escalate this alert'), { statusCode: 403 });
  }

  alert.escalationLevel = (alert.escalationLevel || 0) + 1;
  alert.status = 'escalated';
  await alert.save();

  if (alert.escalationLevel >= 2 || alert.type === 'high_risk') {
    const intervention = await Intervention.create({
      patientId: alert.patientId,
      createdBy: doctorId,
      interventionType: 'high_risk_prediction',
      priority: 'high',
      reason: `Alert escalated: ${alert.message}`,
      notes: data.escalationNotes,
      relatedAlertIds: [alert._id],
    });

    alert.relatedInterventionId = intervention._id;
    await alert.save();

    logger.info('Intervention created from escalated alert', { alertId, interventionId: intervention._id, doctorId });

    return { alert, intervention };
  }

  logger.info('Alert escalated by doctor', { alertId, doctorId, escalationLevel: alert.escalationLevel });

  return { alert };
}

export async function createIntervention(doctorId, data) {
  const { patientId, interventionType, priority, reason, notes, followUpRequired, followUpDate } = data;

  if (patientId) {
    await validateDoctorPatientAccess(doctorId, patientId);
  }

  const intervention = await Intervention.create({
    patientId,
    createdBy: doctorId,
    assignedTo: data.assignedTo,
    interventionType,
    priority: priority || 'medium',
    reason,
    notes,
    followUpRequired: followUpRequired || false,
    followUpDate: followUpDate ? new Date(followUpDate) : undefined,
  });

  if (data.relatedAlertIds && data.relatedAlertIds.length > 0) {
    await Alert.updateMany(
      { _id: { $in: data.relatedAlertIds } },
      { relatedInterventionId: intervention._id, status: 'escalated' }
    );
  }

  logger.info('Intervention created by doctor', { interventionId: intervention._id, doctorId, patientId });

  return intervention;
}

export async function getPatientInterventions(doctorId, patientId, filters = {}) {
  await validateDoctorPatientAccess(doctorId, patientId);

  const { status, page = 1, limit = 20 } = filters;

  const query = { patientId };

  if (status) {
    query.status = status;
  }

  const skip = (page - 1) * limit;

  const [interventions, total] = await Promise.all([
    Intervention.find(query)
      .populate('createdBy', 'fullName email')
      .populate('assignedTo', 'fullName email')
      .populate('resolvedBy', 'fullName email')
      .populate('relatedAlertIds')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Intervention.countDocuments(query),
  ]);

  return {
    interventions,
    total,
    page: Number(page),
    limit: Number(limit),
  };
}

export async function createPatient(doctorId, data) {
  const { email, password, fullName, age, gender, phone, conditions, emergencyContact } = data;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw Object.assign(new Error('Email already in use'), { statusCode: 409 });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const patient = await User.create({
    email,
    passwordHash,
    fullName,
    role: 'patient',
    age,
    gender,
    phone,
    conditions,
    emergencyContact,
    createdByDoctor: doctorId,
  });

  await DoctorPatient.create({
    doctorId,
    patientId: patient._id,
    status: 'active',
  });

  logger.info('Patient created by doctor', { patientId: patient._id, doctorId });

  return patient.toSafeObject();
}

export async function createCaregiver(doctorId, data) {
  const { email, password, fullName, phone, relationship, address } = data;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw Object.assign(new Error('Email already in use'), { statusCode: 409 });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const caregiver = await User.create({
    email,
    passwordHash,
    fullName,
    role: 'caregiver',
    phone,
    address,
    relationship,
    createdByDoctor: doctorId,
  });

  logger.info('Caregiver created by doctor', { caregiverId: caregiver._id, doctorId });

  return caregiver.toSafeObject();
}

export async function getAssignedCaregivers(doctorId) {
  const caregivers = await User.find({
    role: 'caregiver',
    createdByDoctor: doctorId,
  })
    .select('_id fullName email relationship')
    .lean();

  const caregiversWithCounts = await Promise.all(
    caregivers.map(async (caregiver) => {
      const patientCount = await CaregiverPatient.countDocuments({
        caregiverId: caregiver._id,
        doctorId,
        status: 'active',
      });

      return {
        id: caregiver._id,
        fullName: caregiver.fullName,
        email: caregiver.email,
        relationship: caregiver.relationship,
        patientCount,
      };
    })
  );

  return caregiversWithCounts;
}

export async function assignCaregiverToPatient(doctorId, patientId, data) {
  const { caregiverId, relationship } = data;

  await validateDoctorPatientAccess(doctorId, patientId);

  const caregiver = await User.findOne({ _id: caregiverId, role: 'caregiver', createdByDoctor: doctorId });
  if (!caregiver) {
    throw Object.assign(new Error('Caregiver not found or not created by this doctor'), { statusCode: 404 });
  }

  const existingAssignment = await CaregiverPatient.findOne({
    caregiverId,
    patientId,
    status: 'active',
  });
  if (existingAssignment) {
    throw Object.assign(new Error('Caregiver already assigned to this patient'), { statusCode: 400 });
  }

  const activePatientCount = await CaregiverPatient.countDocuments({
    caregiverId,
    status: 'active',
  });
  if (activePatientCount >= 3) {
    throw Object.assign(new Error('Caregiver can manage maximum 3 active patients'), { statusCode: 400 });
  }

  const assignment = await CaregiverPatient.create({
    caregiverId,
    patientId,
    doctorId,
    relationship: relationship || caregiver.relationship || 'caregiver',
    assignedAt: new Date(),
    status: 'active',
  });

  logger.info('Caregiver assigned to patient', { caregiverId, patientId, doctorId });

  return assignment;
}
```

## Adherence Module

### src/adherence/adherence.routes.js
```javascript
import { Router } from 'express';
import { verifyToken } from '../../middleware/auth.middleware.js';
import * as adherenceController from './adherence.controller.js';

const router = Router();

router.use(verifyToken);

router.get('/summary', adherenceController.getAdherenceSummary);
router.get('/history', adherenceController.getAdherenceHistory);

export default router;
```

### src/adherence/adherence.controller.js
```javascript
import * as adherenceService from './adherence.service.js';
import { sendSuccess } from '../utils/response.utils.js';

export async function getAdherenceSummary(req, res, next) {
  try {
    const summary = await adherenceService.getAdherenceSummary(req.user._id);
    return sendSuccess(res, { medications: summary });
  } catch (err) {
    next(err);
  }
}

export async function getAdherenceHistory(req, res, next) {
  try {
    const history = await adherenceService.getAdherenceHistory(req.user._id, req.query);
    return sendSuccess(res, { history });
  } catch (err) {
    next(err);
  }
}
```

## Dose Logs Module

### src/doseLogs/doseLog.routes.js
```javascript
import { Router } from 'express';
import { verifyToken, requireRole } from '../../middleware/auth.middleware.js';
import { auditMiddleware } from '../../middleware/audit.middleware.js';
import { validateTakeDose, validateSkipDose, validateAssistDose, validateConfirmDose, validateDisputeDose } from '../../validations/doseLog.schema.js';
import * as doseLogController from './doseLog.controller.js';
import * as caregiverDoseLogController from './caregiverDoseLog.controller.js';

const router = Router();

router.use(verifyToken);

router.get('/', doseLogController.listDoseLogs);
router.post('/:id/take', auditMiddleware, validateTakeDose, doseLogController.takeDose);
router.post('/:id/skip', auditMiddleware, validateSkipDose, doseLogController.skipDose);

router.post('/:id/assist', auditMiddleware, requireRole('caregiver', 'doctor', 'admin'), validateAssistDose, caregiverDoseLogController.assistDose);
router.post('/:id/confirm', auditMiddleware, requireRole('caregiver', 'doctor', 'admin'), validateConfirmDose, caregiverDoseLogController.confirmDose);
router.post('/:id/dispute', auditMiddleware, requireRole('caregiver', 'doctor', 'admin'), validateDisputeDose, caregiverDoseLogController.disputeDose);
router.get('/pending-confirmation', requireRole('caregiver', 'doctor', 'admin'), caregiverDoseLogController.getPendingConfirmations);
router.get('/assisted-history', requireRole('caregiver', 'doctor', 'admin'), caregiverDoseLogController.getAssistedHistory);

export default router;
```

### src/doseLogs/doseLog.controller.js
```javascript
import * as doseLogService from './doseLog.service.js';
import { sendSuccess } from '../utils/response.utils.js';

export async function takeDose(req, res, next) {
  try {
    const log = await doseLogService.takeDose(req.params.id, req.user._id, req.body.notes, req.user.role);
    return sendSuccess(res, { log });
  } catch (err) {
    next(err);
  }
}

export async function skipDose(req, res, next) {
  try {
    const log = await doseLogService.skipDose(req.params.id, req.user._id, req.body.notes, req.user.role);
    return sendSuccess(res, { log });
  } catch (err) {
    next(err);
  }
}

export async function listDoseLogs(req, res, next) {
  try {
    const result = await doseLogService.listDoseLogs(req.user._id, req.query);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}
```

## Alerts Module

### src/features/alerts/alert.routes.js
```javascript
import { Router } from 'express';
import { verifyToken, requireRole } from '../../../middleware/auth.middleware.js';
import { auditMiddleware } from '../../../middleware/audit.middleware.js';
import { validateEscalateAlert, validateResolveAlert } from '../../../validations/intervention.schema.js';
import * as alertController from './alert.controller.js';

const router = Router();

router.use(verifyToken);

router.get('/', alertController.listAlerts);
router.patch('/:id/acknowledge', auditMiddleware, alertController.acknowledgeAlert);
router.post('/:id/escalate', auditMiddleware, requireRole('caregiver', 'doctor', 'admin'), validateEscalateAlert, alertController.escalateAlert);
router.post('/:id/resolve', auditMiddleware, requireRole('caregiver', 'doctor', 'admin'), validateResolveAlert, alertController.resolveAlert);

export default router;
```

### src/features/alerts/alert.controller.js
```javascript
import * as alertService from './alert.service.js';
import * as interventionService from '../interventions/intervention.service.js';
import { sendSuccess } from '../../utils/response.utils.js';

export async function listAlerts(req, res, next) {
  try {
    const result = await alertService.listAlerts(req.user._id, req.query);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function acknowledgeAlert(req, res, next) {
  try {
    const alert = await alertService.acknowledgeAlert(req.params.id, req.user._id);
    return sendSuccess(res, { alert });
  } catch (err) {
    next(err);
  }
}

export async function escalateAlert(req, res, next) {
  try {
    const result = await interventionService.escalateAlert(req.params.id, req.user._id, req.body);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function resolveAlert(req, res, next) {
  try {
    const alert = await interventionService.resolveAlert(req.params.id, req.user._id, req.body);
    return sendSuccess(res, { alert });
  } catch (err) {
    next(err);
  }
}
```

---

*Report generated on: $(date)*
*Total files included: 20*
