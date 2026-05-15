import { addDays, parseISO, startOfDay } from 'date-fns';
import PatientMedication from '../../models/PatientMedication.model.js';
import DoseLog from '../../models/DoseLog.model.js';
import { dayOfWeekShort } from '../utils/date.utils.js';
import { logger } from '../utils/logger.js';

const DAY_MAP = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export async function generateDoseLogs(
  medicationId,
  patientId,
  frequency,
  startDate,
  scheduleType,
  daysOfWeek,
  days = 30
) {
  const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
  const logs = [];

  for (let i = 0; i < days; i++) {
    const day = addDays(startOfDay(start), i);
    const dayName = dayOfWeekShort(day);

    let shouldSchedule = false;
    let timesToSchedule = [];

    if (scheduleType === 'weekly') {
      if (daysOfWeek && daysOfWeek.includes(dayName)) {
        shouldSchedule = true;
        timesToSchedule = frequency.times || [];
      }
    } else {
      const allDays = frequency.days.includes('all');
      if (allDays || frequency.days.includes(dayName)) {
        shouldSchedule = true;
        timesToSchedule = frequency.times;
      }
    }

    if (!shouldSchedule) continue;

    for (const timeStr of timesToSchedule) {
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

/**
 * COMPATIBILITY LAYER: List medications using NEW PatientMedication system
 * Frontend expects array of medication objects with specific shape
 */
export async function listMedications(patientId, role, isActive) {
  const query = { patientId };
  if (isActive !== undefined) {
    query.isActive = isActive;
  }

  const patientMedications = await PatientMedication.find(query)
    .populate('medicationId')
    .populate('patientId', 'fullName email')
    .sort({ startDate: -1 })
    .lean();

  // Transform to frontend-compatible shape
  const medications = patientMedications.map((pm) => ({
    id: pm._id.toString(),
    medicationId: pm.medicationId?._id?.toString() || pm.medicationId,
    patientId: pm.patientId._id?.toString() || pm.patientId,
    name: pm.medicationId?.name || 'Unknown Medication',
    genericName: pm.medicationId?.genericName,
    dosage: pm.dosage,
    times: pm.times,
    scheduleType: pm.scheduleType,
    daysOfWeek: pm.daysOfWeek,
    instructions: pm.instructions,
    startDate: pm.startDate,
    endDate: pm.endDate,
    isActive: pm.isActive,
    // Catalog details
    category: pm.medicationId?.category,
    strength: pm.medicationId?.strength,
    form: pm.medicationId?.form,
    manufacturer: pm.medicationId?.manufacturer,
    importance: pm.medicationId?.importance,
  }));

  return medications;
}

/**
 * COMPATIBILITY LAYER: Get medication by ID using NEW PatientMedication system
 */
export async function getMedicationById(id, userId) {
  const pm = await PatientMedication.findById(id)
    .populate('medicationId')
    .populate('patientId', 'fullName email')
    .populate('assignedByDoctor', 'fullName email')
    .lean();

  if (!pm) throw Object.assign(new Error('Medication not found'), { statusCode: 404 });

  // Transform to frontend-compatible shape
  return {
    id: pm._id.toString(),
    medicationId: pm.medicationId?._id?.toString() || pm.medicationId,
    patientId: pm.patientId._id?.toString() || pm.patientId,
    assignedByDoctor: pm.assignedByDoctor?._id?.toString() || pm.assignedByDoctor,
    name: pm.medicationId?.name || 'Unknown Medication',
    genericName: pm.medicationId?.genericName,
    dosage: pm.dosage,
    times: pm.times,
    scheduleType: pm.scheduleType,
    daysOfWeek: pm.daysOfWeek,
    instructions: pm.instructions,
    startDate: pm.startDate,
    endDate: pm.endDate,
    isActive: pm.isActive,
    // Catalog details
    category: pm.medicationId?.category,
    strength: pm.medicationId?.strength,
    form: pm.medicationId?.form,
    manufacturer: pm.medicationId?.manufacturer,
    description: pm.medicationId?.description,
    sideEffects: pm.medicationId?.sideEffects,
    importance: pm.medicationId?.importance,
  };
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
    .populate('medicationId')
    .populate('patientMedicationId')
    .sort({ scheduledTime: 1 })
    .lean();

  return logs;
}
