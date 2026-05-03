import { subDays, eachDayOfInterval, startOfDay, endOfDay, format } from 'date-fns';
import DoseLog from '../../models/DoseLog.model.js';
import Medication from '../../models/Medication.model.js';
import { computeAdherenceRate, computeStreak, computeDelayMean } from '../utils/adherence.utils.js';

export async function computeAdherence(patientId, medicationId, days) {
  const from = subDays(new Date(), days);
  const query = { patientId, scheduledTime: { $gte: from } };
  if (medicationId) query.medicationId = medicationId;
  const logs = await DoseLog.find(query).lean();
  return computeAdherenceRate(logs);
}

export async function getAdherenceSummary(patientId) {
  const meds = await Medication.find({ patientId, isActive: true }).lean();

  const summaries = await Promise.all(
    meds.map(async (med) => {
      const [a7, a30] = await Promise.all([
        computeAdherence(patientId, med._id, 7),
        computeAdherence(patientId, med._id, 30),
      ]);
      return { medicationId: med._id, name: med.name, adherence7d: a7, adherence30d: a30 };
    })
  );

  return summaries;
}

export async function getAdherenceHistory(patientId, { from, to, medicationId }) {
  const start = from ? new Date(from) : subDays(new Date(), 30);
  const end = to ? new Date(to) : new Date();

  const query = { patientId, scheduledTime: { $gte: start, $lte: end } };
  if (medicationId) query.medicationId = medicationId;

  const logs = await DoseLog.find(query).lean();

  const days = eachDayOfInterval({ start, end });
  const history = days.map((day) => {
    const dayLogs = logs.filter((l) => {
      const t = new Date(l.scheduledTime);
      return t >= startOfDay(day) && t <= endOfDay(day);
    });
    return { date: format(day, 'yyyy-MM-dd'), adherence: computeAdherenceRate(dayLogs), total: dayLogs.length };
  });

  return history;
}

export async function computePatientFeatures(patientId) {
  const now = new Date();
  const logs7 = await DoseLog.find({ patientId, scheduledTime: { $gte: subDays(now, 7) } }).lean();
  const logs30 = await DoseLog.find({ patientId, scheduledTime: { $gte: subDays(now, 30) } }).lean();

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
