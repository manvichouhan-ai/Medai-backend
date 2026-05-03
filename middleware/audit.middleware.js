import AuditLog from '../models/AuditLog.model.js';
import { logger } from '../src/utils/logger.js';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

export function auditMiddleware(req, res, next) {
  if (!MUTATING_METHODS.has(req.method)) return next();

  const segments = req.path.split('/').filter(Boolean);
  const resource = segments[0] || 'unknown';
  const resourceId = segments[1] || null;

  AuditLog.create({
    userId: req.user?._id,
    action: req.method,
    resource,
    resourceId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  }).catch((err) => logger.error('Audit log write failed', { error: err.message }));

  next();
}
