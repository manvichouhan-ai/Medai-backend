import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import DoctorPatient from '../../../models/DoctorPatient.model.js';
import User from '../../../models/User.model.js';
import Medication from '../../../models/Medication.model.js';
import PatientMedication from '../../../models/PatientMedication.model.js';
import DoseLog from '../../../models/DoseLog.model.js';
import Alert from '../../../models/Alert.model.js';
import Intervention from '../../../models/Intervention.model.js';
import CaregiverPatient from '../../../models/CaregiverPatient.model.js';
import { getAdherenceSummary, getAdherenceHistory, getTodayAdherence } from '../../adherence/adherence.service.js';
import { getRiskScore } from '../ai/ai.service.js';
import { generateInsight } from '../ai/ai.service.js';
import { generateDoseLogs } from '../../medications/medication.service.js';
import { logger } from '../../utils/logger.js';

const BCRYPT_ROUNDS = 12;

function toObjectId(id) {
  return id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id);
}

function getActiveMedicationQuery(patientId) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date(todayStart);
  todayEnd.setHours(23, 59, 59, 999);

  return {
    patientId: toObjectId(patientId),
    isActive: true,
    startDate: { $lte: todayEnd },
    $or: [
      { endDate: { $exists: false } },
      { endDate: null },
      { endDate: { $gte: todayStart } },
    ],
  };
}

function getAverageAdherence(adherence = []) {
  if (!adherence.length) return 0;

  const total = adherence.reduce((sum, med) => sum + (med.adherence ?? med.adherence7d ?? 0), 0);
  return Math.round(total / adherence.length);
}

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
      const patientObjectId = toObjectId(patient._id);

      const [adherence, activeMeds, pendingAlerts, riskData, todayAdherence] = await Promise.all([
        getAdherenceSummary(patientObjectId),
        PatientMedication.countDocuments(getActiveMedicationQuery(patientObjectId)),
        Alert.countDocuments({ patientId: patientObjectId, status: 'active' }),
        getRiskScore(patientObjectId),
        getTodayAdherence(patientObjectId),
      ]);

      const avgAdherence = getAverageAdherence(adherence);

      return {
        patientId: patientObjectId,
        patient,
        adherenceScore: avgAdherence,
        todayAdherence,
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
  const patientObjectId = toObjectId(patientId);

  const patient = await User.findById(patientObjectId).select('-passwordHash').lean();
  if (!patient) {
    throw Object.assign(new Error('Patient not found'), { statusCode: 404 });
  }

  const [adherence, medications, recentAlerts, interventions, caregivers] = await Promise.all([
    getAdherenceSummary(patientObjectId),
    PatientMedication.find(getActiveMedicationQuery(patientObjectId))
      .populate('medicationId', 'name genericName category strength form')
      .populate('assignedByDoctor', 'fullName email')
      .lean(),
    Alert.find({ patientId: patientObjectId }).sort({ createdAt: -1 }).limit(10).lean(),
    Intervention.find({ patientId: patientObjectId }).sort({ createdAt: -1 }).limit(10)
      .populate('createdBy', ' fullName email')
      .populate('assignedTo', 'fullName email')
      .lean(),
    CaregiverPatient.find({ patientId: patientObjectId, status: 'active' })
      .populate('caregiverId', 'fullName email phone')
      .lean(),
  ]);

  const avgAdherence = getAverageAdherence(adherence);

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
