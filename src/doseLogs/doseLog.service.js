import DoseLog from '../../models/DoseLog.model.js';
import { dispatchAlert } from '../features/notifications/notification.service.js';
import { logger } from '../utils/logger.js';

const DELAY_THRESHOLD_MINUTES = 30;

export async function takeDose(logId, patientId, notes) {
  const log = await DoseLog.findOne({ _id: logId, patientId, status: 'pending' });
  if (!log) throw Object.assign(new Error('Dose log not found or already actioned'), { statusCode: 404 });

  const takenAt = new Date();
  const delayMinutes = Math.round((takenAt - log.scheduledTime) / 60000);
  const status = delayMinutes > DELAY_THRESHOLD_MINUTES ? 'delayed' : 'taken';

  log.takenAt = takenAt;
  log.delayMinutes = Math.max(0, delayMinutes);
  log.status = status;
  if (notes) log.notes = notes;
  await log.save();

  if (status === 'delayed') {
    await dispatchAlert(
      patientId,
      'delay',
      `Medication was taken ${delayMinutes} minutes late`,
      'system'
    );
  }

  return log;
}

export async function skipDose(logId, patientId, notes) {
  const log = await DoseLog.findOne({ _id: logId, patientId, status: 'pending' });
  if (!log) throw Object.assign(new Error('Dose log not found or already actioned'), { statusCode: 404 });

  log.status = 'missed';
  log.notes = notes;
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
