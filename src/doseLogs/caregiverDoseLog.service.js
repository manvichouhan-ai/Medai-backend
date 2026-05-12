import { subDays } from 'date-fns';
import DoseLog from '../../models/DoseLog.model.js';
import CaregiverPatient from '../../models/CaregiverPatient.model.js';
import { dispatchAlert } from '../features/notifications/notification.service.js';
import { logger } from '../utils/logger.js';

const DELAY_THRESHOLD_MINUTES = 30;
const DISPUTE_THRESHOLD_DAYS = 7;
const DISPUTE_COUNT_THRESHOLD = 3;

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

export async function assistDose(logId, caregiverId, data, callerRole) {
  const log = await DoseLog.findById(logId).populate('medicationId', 'name');
  if (!log) {
    throw Object.assign(new Error('Dose log not found'), { statusCode: 404 });
  }

  if (callerRole !== 'caregiver') {
    throw Object.assign(new Error('Missed doses must be assisted by your caregiver'), { statusCode: 403 });
  }

  if (log.status !== 'pending' && log.status !== 'missed') {
    throw Object.assign(new Error('Dose has already been actioned'), { statusCode: 400 });
  }

  await validateCaregiverPatientAccess(caregiverId, log.patientId);

  const takenAt = new Date();
  const delayMinutes = Math.round((takenAt - log.scheduledTime) / 60000);
  const status = delayMinutes > DELAY_THRESHOLD_MINUTES ? 'delayed' : 'taken';

  log.takenAt = takenAt;
  log.delayMinutes = Math.max(0, delayMinutes);
  log.status = status;
  log.takenBy = caregiverId;
  log.takenByRole = 'caregiver';
  log.assistedBy = caregiverId;
  log.confirmationStatus = 'confirmed';
  log.confirmedBy = caregiverId;
  log.confirmedAt = takenAt;
  if (data.assistanceNotes) log.assistanceNotes = data.assistanceNotes;
  await log.save();

  await dispatchAlert(
    log.patientId,
    'manual',
    `Caregiver assisted dose for ${log.medicationId.name} at ${takenAt.toLocaleTimeString()}`,
    'manual'
  );

  logger.info('Caregiver assisted dose', { logId, caregiverId, patientId: log.patientId });
  return log;
}

export async function confirmDose(logId, caregiverId, data) {
  const log = await DoseLog.findById(logId).populate('medicationId', 'name');
  if (!log) {
    throw Object.assign(new Error('Dose log not found'), { statusCode: 404 });
  }

  if (log.status === 'pending') {
    throw Object.assign(new Error('Cannot confirm a pending dose'), { statusCode: 400 });
  }

  await validateCaregiverPatientAccess(caregiverId, log.patientId);

  if (log.confirmationStatus === 'confirmed') {
    throw Object.assign(new Error('Dose already confirmed'), { statusCode: 400 });
  }

  log.confirmationStatus = 'confirmed';
  log.confirmedBy = caregiverId;
  log.confirmedAt = new Date();
  if (data.notes) log.notes = data.notes;
  await log.save();

  await dispatchAlert(
    log.patientId,
    'manual',
    `Caregiver confirmed dose for ${log.medicationId.name}`,
    'manual'
  );

  logger.info('Caregiver confirmed dose', { logId, caregiverId, patientId: log.patientId });
  return log;
}

export async function disputeDose(logId, caregiverId, data) {
  const log = await DoseLog.findById(logId).populate('medicationId', 'name');
  if (!log) {
    throw Object.assign(new Error('Dose log not found'), { statusCode: 404 });
  }

  if (log.status === 'pending') {
    throw Object.assign(new Error('Cannot dispute a pending dose'), { statusCode: 400 });
  }

  await validateCaregiverPatientAccess(caregiverId, log.patientId);

  log.confirmationStatus = 'disputed';
  if (data.notes) log.notes = data.notes;
  await log.save();

  await dispatchAlert(
    log.patientId,
    'high_risk',
    `Caregiver disputed dose for ${log.medicationId.name}. Reason: ${data.disputeReason}`,
    'manual'
  );

  const sevenDaysAgo = subDays(new Date(), DISPUTE_THRESHOLD_DAYS);
  const disputedCount = await DoseLog.countDocuments({
    patientId: log.patientId,
    confirmationStatus: 'disputed',
    confirmedAt: { $gte: sevenDaysAgo },
  });

  if (disputedCount >= DISPUTE_COUNT_THRESHOLD) {
    log.interventionRequired = true;
    log.interventionReason = `Repeated disputes (${disputedCount} in ${DISPUTE_THRESHOLD_DAYS} days)`;
    await log.save();

    await dispatchAlert(
      log.patientId,
      'high_risk',
      `Intervention required: ${disputedCount} disputed doses in ${DISPUTE_THRESHOLD_DAYS} days`,
      'manual'
    );

    logger.warn('Intervention triggered due to repeated disputes', {
      patientId: log.patientId,
      disputedCount,
    });
  }

  logger.info('Caregiver disputed dose', { logId, caregiverId, patientId: log.patientId });
  return log;
}

export async function getPendingConfirmations(caregiverId, filters = {}) {
  const { patientId, page = 1, limit = 20 } = filters;

  const patientIds = await CaregiverPatient.find({
    caregiverId,
    status: 'active',
  }).distinct('patientId');

  const query = {
    patientId: { $in: patientIds },
    status: { $in: ['taken', 'delayed'] },
    confirmationStatus: 'pending',
  };

  if (patientId) {
    if (!patientIds.includes(patientId.toString())) {
      throw Object.assign(new Error('Not authorized to access this patient'), { statusCode: 403 });
    }
    query.patientId = patientId;
  }

  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    DoseLog.find(query)
      .populate('medicationId', 'name dosage')
      .populate('patientId', 'fullName email')
      .populate('takenBy', 'fullName email')
      .sort({ scheduledTime: 1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    DoseLog.countDocuments(query),
  ]);

  return { logs, total, page: Number(page), limit: Number(limit) };
}

export async function getAssistedHistory(caregiverId, filters = {}) {
  const { patientId, status, page = 1, limit = 20 } = filters;

  const patientIds = await CaregiverPatient.find({
    caregiverId,
    status: 'active',
  }).distinct('patientId');

  const query = {
    assistedBy: caregiverId,
  };

  if (patientId) {
    if (!patientIds.includes(patientId.toString())) {
      throw Object.assign(new Error('Not authorized to access this patient'), { statusCode: 403 });
    }
    query.patientId = patientId;
  } else {
    query.patientId = { $in: patientIds };
  }

  if (status) query.status = status;

  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    DoseLog.find(query)
      .populate('medicationId', 'name dosage')
      .populate('patientId', 'fullName email')
      .sort({ takenAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    DoseLog.countDocuments(query),
  ]);

  return { logs, total, page: Number(page), limit: Number(limit) };
}
