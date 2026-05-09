import DoctorPatient from '../../../models/DoctorPatient.model.js';
import User from '../../../models/User.model.js';
import Medication from '../../../models/Medication.model.js';
import DoseLog from '../../../models/DoseLog.model.js';
import Alert from '../../../models/Alert.model.js';
import Intervention from '../../../models/Intervention.model.js';
import CaregiverPatient from '../../../models/CaregiverPatient.model.js';
import { getAdherenceSummary, getAdherenceHistory } from '../../adherence/adherence.service.js';
import { getRiskScore } from '../ai/ai.service.js';
import { generateInsight } from '../ai/ai.service.js';
import { logger } from '../../utils/logger.js';

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
    .populate('patientId', 'fullName email phone timezone notificationPrefs')
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
    Medication.find({ patientId, isActive: true })
      .populate('prescribedBy', 'fullName email')
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