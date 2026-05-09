import { subDays, parseISO } from 'date-fns';
import Intervention from '../../../models/Intervention.model.js';
import Alert from '../../../models/Alert.model.js';
import DoseLog from '../../../models/DoseLog.model.js';
import CaregiverPatient from '../../../models/CaregiverPatient.model.js';
import User from '../../../models/User.model.js';
import MedicationRequest from '../../../models/MedicationRequest.model.js';
import { dispatchAlert } from '../notifications/notification.service.js';
import { logger } from '../../utils/logger.js';

const DISPUTE_THRESHOLD_DAYS = 7;
const DISPUTE_COUNT_THRESHOLD = 3;
const MISSED_DOSE_THRESHOLD_DAYS = 7;
const MISSED_DOSE_COUNT_THRESHOLD = 5;
const AI_RISK_SCORE_THRESHOLD = 0.8;

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

export async function createIntervention(userId, userRole, data) {
  const patientId = data.patientId || (userRole === 'caregiver' ? null : userId);

  if (userRole === 'caregiver') {
    if (!data.patientId) {
      throw Object.assign(new Error('patientId is required for caregivers'), { statusCode: 400 });
    }
    await validateCaregiverPatientAccess(userId, data.patientId);
  }

  const intervention = await Intervention.create({
    patientId: patientId || data.patientId,
    createdBy: userId,
    assignedTo: data.assignedTo,
    interventionType: data.interventionType,
    priority: data.priority || 'medium',
    reason: data.reason,
    notes: data.notes,
    relatedAlertIds: data.relatedAlertIds,
    relatedDoseLogIds: data.relatedDoseLogIds,
    followUpRequired: data.followUpRequired || false,
    followUpDate: data.followUpDate ? (typeof data.followUpDate === 'string' ? parseISO(data.followUpDate) : data.followUpDate) : undefined,
  });

  if (data.relatedAlertIds && data.relatedAlertIds.length > 0) {
    await Alert.updateMany(
      { _id: { $in: data.relatedAlertIds } },
      { relatedInterventionId: intervention._id, status: 'escalated' }
    );
  }

  await dispatchAlert(
    intervention.patientId,
    'anomaly',
    `New intervention created: ${data.interventionType} - ${data.reason}`,
    'manual'
  );

  if (intervention.priority === 'urgent') {
    const caregivers = await CaregiverPatient.find({ patientId: intervention.patientId, status: 'active' })
      .populate('caregiverId', 'fullName email notificationPrefs')
      .lean();

    for (const link of caregivers) {
      await dispatchAlert(
        intervention.patientId,
        'high_risk',
        `URGENT intervention for patient: ${data.reason}`,
        'manual'
      );
    }
  }

  logger.info('Intervention created', { interventionId: intervention._id, createdBy: userId, patientId: intervention.patientId });
  return intervention;
}

export async function getInterventions(userId, userRole, filters = {}) {
  const { status, priority, patientId, assignedTo, page = 1, limit = 20 } = filters;

  let query = {};

  if (userRole === 'caregiver') {
    const patientIds = await CaregiverPatient.find({ caregiverId: userId, status: 'active' }).distinct('patientId');
    query.patientId = { $in: patientIds };
  } else if (userRole === 'doctor' || userRole === 'admin') {
    if (patientId) query.patientId = patientId;
    if (assignedTo) query.assignedTo = assignedTo;
  }

  if (status) query.status = status;
  if (priority) query.priority = priority;

  const skip = (page - 1) * limit;

  const [interventions, total] = await Promise.all([
    Intervention.find(query)
      .populate('patientId', 'fullName email')
      .populate('createdBy', 'fullName email')
      .populate('assignedTo', 'fullName email')
      .populate('resolvedBy', 'fullName email')
      .sort({ priority: -1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Intervention.countDocuments(query),
  ]);

  return { interventions, total, page: Number(page), limit: Number(limit) };
}

export async function getInterventionById(interventionId, userId, userRole) {
  const intervention = await Intervention.findById(interventionId)
    .populate('patientId', 'fullName email')
    .populate('createdBy', 'fullName email')
    .populate('assignedTo', 'fullName email')
    .populate('resolvedBy', 'fullName email')
    .populate('relatedAlertIds')
    .populate('relatedDoseLogIds')
    .lean();

  if (!intervention) {
    throw Object.assign(new Error('Intervention not found'), { statusCode: 404 });
  }

  if (userRole === 'caregiver') {
    const link = await CaregiverPatient.findOne({
      caregiverId: userId,
      patientId: intervention.patientId._id,
      status: 'active',
    });
    if (!link) {
      throw Object.assign(new Error('Not authorized to view this intervention'), { statusCode: 403 });
    }
  }

  return intervention;
}

export async function updateIntervention(interventionId, userId, userRole, data) {
  const intervention = await Intervention.findById(interventionId);
  if (!intervention) {
    throw Object.assign(new Error('Intervention not found'), { statusCode: 404 });
  }

  if (userRole === 'caregiver') {
    await validateCaregiverPatientAccess(userId, intervention.patientId);
  }

  if (data.status === 'resolved' && intervention.priority === 'urgent' && userRole !== 'doctor' && userRole !== 'admin') {
    throw Object.assign(new Error('Only doctors and admins can resolve urgent interventions'), { statusCode: 403 });
  }

  if (data.status) intervention.status = data.status;
  if (data.assignedTo) intervention.assignedTo = data.assignedTo;
  if (data.priority) intervention.priority = data.priority;
  if (data.notes) intervention.notes = data.notes;
  if (data.followUpRequired !== undefined) intervention.followUpRequired = data.followUpRequired;
  if (data.followUpDate) {
    intervention.followUpDate = typeof data.followUpDate === 'string' ? parseISO(data.followUpDate) : data.followUpDate;
  }

  await intervention.save();

  logger.info('Intervention updated', { interventionId, updatedBy: userId });
  const populated = await Intervention.findById(interventionId)
    .populate('patientId', 'fullName email')
    .populate('createdBy', 'fullName email')
    .populate('assignedTo', 'fullName email')
    .populate('resolvedBy', 'fullName email')
    .lean();

  return populated;
}

export async function resolveIntervention(interventionId, userId, data) {
  const intervention = await Intervention.findById(interventionId);
  if (!intervention) {
    throw Object.assign(new Error('Intervention not found'), { statusCode: 404 });
  }

  if (intervention.priority === 'urgent') {
    const user = await User.findById(userId);
    if (user.role !== 'doctor' && user.role !== 'admin') {
      throw Object.assign(new Error('Only doctors and admins can resolve urgent interventions'), { statusCode: 403 });
    }
  }

  intervention.status = 'resolved';
  intervention.resolvedAt = new Date();
  intervention.resolvedBy = userId;
  intervention.notes = data.resolutionNotes;
  await intervention.save();

  if (intervention.relatedAlertIds && intervention.relatedAlertIds.length > 0) {
    await Alert.updateMany(
      { _id: { $in: intervention.relatedAlertIds } },
      {
        status: 'resolved',
        resolvedBy: userId,
        resolvedAt: new Date(),
        resolutionNotes: data.resolutionNotes,
      }
    );
  }

  await dispatchAlert(
    intervention.patientId,
    'anomaly',
    `Intervention resolved: ${intervention.interventionType}`,
    'manual'
  );

  logger.info('Intervention resolved', { interventionId, resolvedBy: userId });
  const populated = await Intervention.findById(interventionId)
    .populate('patientId', 'fullName email')
    .populate('createdBy', 'fullName email')
    .populate('assignedTo', 'fullName email')
    .populate('resolvedBy', 'fullName email')
    .lean();

  return populated;
}

export async function escalateAlert(alertId, userId, data) {
  const alert = await Alert.findById(alertId);
  if (!alert) {
    throw Object.assign(new Error('Alert not found'), { statusCode: 404 });
  }

  const escalateToUser = await User.findById(data.escalateTo);
  if (!escalateToUser) {
    throw Object.assign(new Error('Target user not found'), { statusCode: 404 });
  }

  alert.escalationLevel = (alert.escalationLevel || 0) + 1;
  alert.escalatedTo = data.escalateTo;
  alert.status = 'escalated';

  const intervention = await Intervention.create({
    patientId: alert.patientId,
    createdBy: userId,
    assignedTo: data.escalateTo,
    interventionType: 'emergency',
    priority: alert.escalationLevel >= 2 ? 'urgent' : 'high',
    reason: data.escalationReason,
    notes: data.notes,
    relatedAlertIds: [alert._id],
    escalationLevel: alert.escalationLevel,
  });

  alert.relatedInterventionId = intervention._id;
  await alert.save();

  await dispatchAlert(
    alert.patientId,
    'high_risk',
    `Alert escalated to level ${alert.escalationLevel}: ${data.escalationReason}`,
    'manual'
  );

  logger.info('Alert escalated', { alertId, escalatedBy: userId, escalationLevel: alert.escalationLevel });
  return { alert, intervention };
}

export async function resolveAlert(alertId, userId, data) {
  const alert = await Alert.findById(alertId);
  if (!alert) {
    throw Object.assign(new Error('Alert not found'), { statusCode: 404 });
  }

  alert.status = 'resolved';
  alert.resolvedBy = userId;
  alert.resolvedAt = new Date();
  alert.resolutionNotes = data.resolutionNotes;
  await alert.save();

  if (alert.relatedInterventionId) {
    const intervention = await Intervention.findById(alert.relatedInterventionId);
    if (intervention && intervention.status === 'pending') {
      intervention.status = 'resolved';
      intervention.resolvedAt = new Date();
      intervention.resolvedBy = userId;
      intervention.notes = data.resolutionNotes;
      await intervention.save();
    }
  }

  logger.info('Alert resolved', { alertId, resolvedBy: userId });
  return alert;
}

export async function checkForRepeatedDisputes(patientId) {
  const sevenDaysAgo = subDays(new Date(), DISPUTE_THRESHOLD_DAYS);
  const disputedCount = await DoseLog.countDocuments({
    patientId,
    confirmationStatus: 'disputed',
    confirmedAt: { $gte: sevenDaysAgo },
  });

  if (disputedCount >= DISPUTE_COUNT_THRESHOLD) {
    const existingIntervention = await Intervention.findOne({
      patientId,
      interventionType: 'repeated_disputes',
      status: { $in: ['pending', 'in_progress'] },
    });

    if (!existingIntervention) {
      const intervention = await Intervention.create({
        patientId,
        createdBy: null,
        interventionType: 'repeated_disputes',
        priority: 'high',
        reason: `${disputedCount} disputed doses in ${DISPUTE_THRESHOLD_DAYS} days`,
        escalationLevel: 1,
      });

      await dispatchAlert(
        patientId,
        'high_risk',
        `Intervention required: ${disputedCount} disputed doses in ${DISPUTE_THRESHOLD_DAYS} days`,
        'system'
      );

      logger.warn('Auto-intervention triggered for repeated disputes', { patientId, disputedCount });
      return intervention;
    }
  }
  return null;
}

export async function checkForChronicMissedDoses(patientId) {
  const sevenDaysAgo = subDays(new Date(), MISSED_DOSE_THRESHOLD_DAYS);
  const missedCount = await DoseLog.countDocuments({
    patientId,
    status: 'missed',
    scheduledTime: { $gte: sevenDaysAgo },
  });

  if (missedCount >= MISSED_DOSE_COUNT_THRESHOLD) {
    const existingIntervention = await Intervention.findOne({
      patientId,
      interventionType: 'medication_non_adherence',
      status: { $in: ['pending', 'in_progress'] },
    });

    if (!existingIntervention) {
      const intervention = await Intervention.create({
        patientId,
        createdBy: null,
        interventionType: 'medication_non_adherence',
        priority: 'high',
        reason: `${missedCount} missed doses in ${MISSED_DOSE_THRESHOLD_DAYS} days`,
        escalationLevel: 1,
      });

      await dispatchAlert(
        patientId,
        'high_risk',
        `Intervention required: ${missedCount} missed doses in ${MISSED_DOSE_THRESHOLD_DAYS} days`,
        'system'
      );

      logger.warn('Auto-intervention triggered for chronic missed doses', { patientId, missedCount });
      return intervention;
    }
  }
  return null;
}

export async function checkForHighRiskPrediction(patientId, riskScore) {
  if (riskScore >= AI_RISK_SCORE_THRESHOLD) {
    const existingIntervention = await Intervention.findOne({
      patientId,
      interventionType: 'high_risk_prediction',
      status: { $in: ['pending', 'in_progress'] },
    });

    if (!existingIntervention) {
      const intervention = await Intervention.create({
        patientId,
        createdBy: null,
        interventionType: 'high_risk_prediction',
        priority: riskScore >= 0.9 ? 'urgent' : 'high',
        reason: `AI risk score ${riskScore} exceeds threshold`,
        escalationLevel: riskScore >= 0.9 ? 2 : 1,
      });

      await dispatchAlert(
        patientId,
        'high_risk',
        `High risk prediction detected: score ${riskScore}`,
        'ai_prediction'
      );

      logger.warn('Auto-intervention triggered for high risk prediction', { patientId, riskScore });
      return intervention;
    }
  }
  return null;
}

export async function checkForRepeatedRejections(patientId) {
  const sevenDaysAgo = subDays(new Date(), 7);
  const rejectedCount = await MedicationRequest.countDocuments({
    patientId,
    status: 'rejected',
    reviewedAt: { $gte: sevenDaysAgo },
  });

  if (rejectedCount >= 3) {
    const existingIntervention = await Intervention.findOne({
      patientId,
      interventionType: 'medication_adjustment',
      status: { $in: ['pending', 'in_progress'] },
    });

    if (!existingIntervention) {
      const intervention = await Intervention.create({
        patientId,
        createdBy: null,
        interventionType: 'medication_adjustment',
        priority: 'medium',
        reason: `${rejectedCount} medication requests rejected in 7 days`,
        escalationLevel: 1,
      });

      await dispatchAlert(
        patientId,
        'anomaly',
        `Medication adjustment review needed: ${rejectedCount} requests rejected`,
        'system'
      );

      logger.warn('Auto-intervention triggered for repeated rejections', { patientId, rejectedCount });
      return intervention;
    }
  }
  return null;
}
