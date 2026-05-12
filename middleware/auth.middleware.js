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
