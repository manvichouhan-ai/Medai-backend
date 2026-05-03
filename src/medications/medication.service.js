import { addDays, parseISO, startOfDay } from 'date-fns';
import Medication from '../../models/Medication.model.js';
import DoseLog from '../../models/DoseLog.model.js';
import { dayOfWeekShort } from '../utils/date.utils.js';
import { logger } from '../utils/logger.js';

const DAY_MAP = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export async function generateDoseLogs(medicationId, patientId, frequency, startDate, days = 30) {
  const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
  const logs = [];

  for (let i = 0; i < days; i++) {
    const day = addDays(startOfDay(start), i);
    const dayName = dayOfWeekShort(day);
    const allDays = frequency.days.includes('all');
    if (!allDays && !frequency.days.includes(dayName)) continue;

    for (const timeStr of frequency.times) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const scheduledTime = new Date(day);
      scheduledTime.setUTCHours(hours, minutes, 0, 0);
      logs.push({ medicationId, patientId, scheduledTime, status: 'pending' });
    }
  }

  if (logs.length > 0) {
    await DoseLog.insertMany(logs, { ordered: false });
  }
  logger.debug(`Generated ${logs.length} dose logs for medication ${medicationId}`);
  return logs.length;
}

export async function listMedications(userId, role, patientId) {
  const queryPatientId = (role === 'doctor' || role === 'admin') && patientId ? patientId : userId;
  return Medication.find({ patientId: queryPatientId, isActive: true }).lean();
}

export async function getTodayDoses(userId) {
  const now = new Date();
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setUTCHours(23, 59, 59, 999);

  const logs = await DoseLog.find({
    patientId: userId,
    scheduledTime: { $gte: start, $lte: end },
  })
    .populate('medicationId', 'name dosage instructions')
    .sort({ scheduledTime: 1 })
    .lean();

  return logs;
}

export async function getMedicationById(medicationId, userId) {
  const med = await Medication.findOne({ _id: medicationId, isActive: true }).lean();
  if (!med) throw Object.assign(new Error('Medication not found'), { statusCode: 404 });

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const logs = await DoseLog.find({
    medicationId,
    scheduledTime: { $gte: sevenDaysAgo },
  })
    .sort({ scheduledTime: -1 })
    .lean();

  return { ...med, recentLogs: logs };
}

export async function createMedication(patientId, data) {
  const med = await Medication.create({ ...data, patientId });
  await generateDoseLogs(med._id, patientId, med.frequency, med.startDate, 30);
  return med;
}

export async function updateMedication(medicationId, patientId, updates) {
  const med = await Medication.findOneAndUpdate(
    { _id: medicationId, patientId, isActive: true },
    updates,
    { new: true, runValidators: true }
  );
  if (!med) throw Object.assign(new Error('Medication not found'), { statusCode: 404 });

  if (updates.frequency || updates.startDate) {
    await DoseLog.deleteMany({ medicationId, status: 'pending', scheduledTime: { $gte: new Date() } });
    await generateDoseLogs(med._id, patientId, med.frequency, new Date(), 30);
  }

  return med;
}

export async function deleteMedication(medicationId, patientId) {
  const med = await Medication.findOneAndUpdate(
    { _id: medicationId, patientId },
    { isActive: false },
    { new: true }
  );
  if (!med) throw Object.assign(new Error('Medication not found'), { statusCode: 404 });
  return med;
}
