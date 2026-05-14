import { subDays, eachDayOfInterval, startOfDay, endOfDay, format } from 'date-fns';
import mongoose from 'mongoose';
import DoseLog from '../../models/DoseLog.model.js';
import PatientMedication from '../../models/PatientMedication.model.js';
import DoctorPatient from '../../models/DoctorPatient.model.js';
import { computeAdherenceRate, computeStreak, computeDelayMean } from '../utils/adherence.utils.js';

function toObjectId(id) {
  return id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id);
}

function getActiveMedicationQuery(patientId) {
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());

  return {
    patientId: toObjectId(patientId),
    isActive: true,
    startDate: { $lte: todayEnd },
    $or: [{ endDate: { $exists: false } }, { endDate: null }, { endDate: { $gte: todayStart } }],
  };
}

async function getPatientIds(callerId, callerRole, patientId) {
  // If a specific patientId is passed by doctor/admin/caregiver, use that only
  if (patientId && ['doctor', 'admin', 'caregiver'].includes(callerRole)) {
    return [toObjectId(patientId)];
  }

  // If doctor with no patientId, aggregate across all assigned patients
  if (callerRole === 'doctor') {
    const assignments = await DoctorPatient.find({
      doctorId: toObjectId(callerId),
    }).lean();
    return assignments.map((a) => toObjectId(a.patientId));
  }

  // Patient accessing their own data
  return [toObjectId(callerId)];
}

export async function computeAdherence(patientId, medicationId, days) {
  const from = subDays(new Date(), days);

  const meds = await PatientMedication.find({
    patientId: toObjectId(patientId),
    ...(medicationId && { medicationId: toObjectId(medicationId) }),
  }).lean();

  const medIds = meds.map((m) => m._id);

  const query = {
    patientMedicationId: { $in: medIds },
    scheduledTime: { $gte: from },
  };

  const logs = await DoseLog.find(query).lean();
  return computeAdherenceRate(logs);
}

export async function getAdherenceSummary(patientId, period = 'month') {
  const periodDays = { week: 7, month: 30, quarter: 90, year: 365 };
  const days = periodDays[period] ?? 30;
  const from = subDays(new Date(), days);

  const meds = await PatientMedication.find(getActiveMedicationQuery(patientId))
    .populate('medicationId', 'name')
    .lean();

  const summaries = await Promise.all(
    meds.map(async (med) => {
      const logs = await DoseLog.find({
        patientMedicationId: med._id,
        scheduledTime: { $gte: from },
      }).lean();
      return {
        medicationId: med._id,
        name: med.medicationId?.name || 'Unknown',
        adherence: computeAdherenceRate(logs),
      };
    })
  );

  return summaries;
}

export async function getTodayAdherence(patientId) {
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());

  const logs = await DoseLog.find({
    patientId: toObjectId(patientId),
    scheduledTime: { $gte: todayStart, $lte: todayEnd },
  }).lean();

  return computeAdherenceRate(logs);
}

export async function getAdherenceHistory(
  callerId,
  callerRole,
  { from, to, medicationId, patientId }
) {
  const start = from ? new Date(from) : subDays(new Date(), 30);
  const end = to ? new Date(to) : new Date();

  const patientIds = await getPatientIds(callerId, callerRole, patientId);

  if (patientIds.length === 0) {
    const days = eachDayOfInterval({ start, end });
    return days.map((day) => ({
      date: format(day, 'yyyy-MM-dd'),
      adherence: 0,
      total: 0,
    }));
  }

  const meds = await PatientMedication.find({
    patientId: { $in: patientIds },
    ...(medicationId && { medicationId: toObjectId(medicationId) }),
  }).lean();

  const medIds = meds.map((m) => m._id);

  const logs = await DoseLog.find({
    patientMedicationId: { $in: medIds },
    scheduledTime: { $gte: start, $lte: end },
  }).lean();

  const days = eachDayOfInterval({ start, end });
  const history = days.map((day) => {
    const dayLogs = logs.filter((l) => {
      const t = new Date(l.scheduledTime);
      return t >= startOfDay(day) && t <= endOfDay(day);
    });
    return {
      date: format(day, 'yyyy-MM-dd'),
      adherence: computeAdherenceRate(dayLogs),
      total: dayLogs.length,
    };
  });

  return history;
}

export async function computePatientFeatures(patientId) {
  const now = new Date();
  const patientObjectId = toObjectId(patientId);

  const meds = await PatientMedication.find({
    patientId: patientObjectId,
  }).lean();
  const medIds = meds.map((m) => m._id);

  const logs7 = await DoseLog.find({
    patientMedicationId: { $in: medIds },
    scheduledTime: { $gte: subDays(now, 7) },
  }).lean();

  const logs30 = await DoseLog.find({
    patientMedicationId: { $in: medIds },
    scheduledTime: { $gte: subDays(now, 30) },
  }).lean();

  const missRate7d = logs7.filter((l) => l.status === 'missed').length / (logs7.length || 1);
  const missRate30d = logs30.filter((l) => l.status === 'missed').length / (logs30.length || 1);
  const delayMean = computeDelayMean(logs30);
  const streakCurrent = computeStreak(logs30);

  const hourCounts = Array(24).fill(0);
  for (const log of logs30) {
    if (log.takenAt) hourCounts[new Date(log.takenAt).getUTCHours()]++;
  }
  const peakHour = hourCounts.indexOf(Math.max(...hourCounts));

  return {
    patientId: patientId.toString(),
    missRate7d: parseFloat(missRate7d.toFixed(3)),
    missRate30d: parseFloat(missRate30d.toFixed(3)),
    delayMean,
    streakCurrent,
    timeOfDayPattern: peakHour,
    totalLogs30d: logs30.length,
    adherence30d: 100 - Math.round(missRate30d * 100),
  };
}
