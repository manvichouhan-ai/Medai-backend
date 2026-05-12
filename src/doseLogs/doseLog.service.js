import DoseLog from '../../models/DoseLog.model.js';
import CaregiverPatient from '../../models/CaregiverPatient.model.js';
import { dispatchAlert } from '../features/notifications/notification.service.js';
import { logger } from '../utils/logger.js';

const DELAY_THRESHOLD_MINUTES = 30;

async function validateCaregiverPatientAccess(caregiverId, patientId) {
  const link = await CaregiverPatient.findOne({
    caregiverId,
    patientId,
    status: 'active',
  });
  if (!link) {
    throw Object.assign(new Error('Not authorized to access this patient'), { statusCode: 403 });
  }
  return link;
}

export async function takeDose(logId, userId, notes, role = 'patient') {
  const log = await DoseLog.findById(logId);
  if (!log) throw Object.assign(new Error('Dose log not found'), { statusCode: 404 });

  if (log.status === 'missed') {
    throw Object.assign(new Error('This dose was missed. Please contact your caregiver to assist.'), { statusCode: 403 });
  }

  if (log.status !== 'pending') {
    throw Object.assign(new Error('Dose has already been actioned'), { statusCode: 400 });
  }

  if (role === 'caregiver') {
    await validateCaregiverPatientAccess(userId, log.patientId);
  } else if (role === 'patient' && log.patientId.toString() !== userId.toString()) {
    throw Object.assign(new Error('Not authorized to mark this dose'), { statusCode: 403 });
  }

  const takenAt = new Date();
  const delayMinutes = Math.round((takenAt - log.scheduledTime) / 60000);
  const status = delayMinutes > DELAY_THRESHOLD_MINUTES ? 'delayed' : 'taken';

  log.takenAt = takenAt;
  log.delayMinutes = Math.max(0, delayMinutes);
  log.status = status;
  log.takenBy = userId;
  log.takenByRole = role;
  if (notes) log.notes = notes;
  await log.save();

  if (status === 'delayed') {
    await dispatchAlert(
      log.patientId,
      'delay',
      `Medication was taken ${delayMinutes} minutes late`,
      'system'
    );
  }

  return log;
}

export async function skipDose(logId, userId, notes, role = 'patient') {
  const log = await DoseLog.findById(logId);
  if (!log) throw Object.assign(new Error('Dose log not found'), { statusCode: 404 });

  if (log.status !== 'pending') {
    throw Object.assign(new Error('Dose has already been actioned'), { statusCode: 400 });
  }

  if (role === 'caregiver') {
    await validateCaregiverPatientAccess(userId, log.patientId);
  } else if (role === 'patient' && log.patientId.toString() !== userId.toString()) {
    throw Object.assign(new Error('Not authorized to mark this dose'), { statusCode: 403 });
  }

  log.status = 'missed';
  log.takenBy = userId;
  log.takenByRole = role;
  if (notes) log.notes = notes;
  await log.save();

  return log;
}

export async function listDoseLogs(patientId, { medicationId, status, from, to, page = 1, limit = 20 }) {
  const query = { patientId };
  if (medicationId) query.medicationId = medicationId;
  if (status) query.status = status;
  if (from || to) {
    query.scheduledTime = {};
    if (from) query.scheduledTime.$gte = new Date(from);
    if (to) query.scheduledTime.$lte = new Date(to);
  }

  const skip = (page - 1) * limit;
  const [logs, total] = await Promise.all([
    DoseLog.find(query)
      .populate('medicationId', 'name dosage')
      .sort({ scheduledTime: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    DoseLog.countDocuments(query),
  ]);

  return { logs, total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) };
}
