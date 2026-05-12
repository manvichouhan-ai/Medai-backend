import { addDays, differenceInDays, parseISO, startOfDay } from 'date-fns';
import PatientMedication from '../../../models/PatientMedication.model.js';
import MasterMedication from '../../../models/MasterMedication.model.js';
import DoseLog from '../../../models/DoseLog.model.js';
import DoctorPatient from '../../../models/DoctorPatient.model.js';
import { dayOfWeekShort } from '../../utils/date.utils.js';
import { logger } from '../../utils/logger.js';

const DAY_MAP = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

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

export async function generateDoseLogsForPatientMedication(patientMedicationId, patientId, scheduleType, times, daysOfWeek, startDate, endDate) {
  const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
  const end = endDate ? (typeof endDate === 'string' ? parseISO(endDate) : endDate) : null;
  const days = end ? differenceInDays(end, start) + 1 : 30;
  const logs = [];

  for (let i = 0; i < days; i++) {
    const day = addDays(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())), i);
    const dayName = dayOfWeekShort(day);

    let shouldSchedule = false;

    if (scheduleType === 'weekly') {
      if (daysOfWeek && daysOfWeek.includes(dayName)) {
        shouldSchedule = true;
      }
    } else if (scheduleType === 'daily') {
      shouldSchedule = true;
    }

    if (!shouldSchedule) continue;

    for (const timeStr of times) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const scheduledTime = new Date(day);
      scheduledTime.setHours(hours, minutes, 0, 0);

      // Only schedule future doses
      if (scheduledTime >= startOfDay(new Date())) {
        logs.push({
          patientMedicationId,
          medicationId: null, // Will be populated from PatientMedication
          patientId,
          scheduledTime,
          status: 'pending'
        });
      }
    }
  }

  if (logs.length > 0) {
    await DoseLog.insertMany(logs, { ordered: false });
  }

  logger.debug(`Generated ${logs.length} dose logs for patient medication ${patientMedicationId}`);
  return logs.length;
}

export async function assignMedicationToPatient(doctorId, patientId, data) {
  try {
    // Validate doctor-patient relationship
    await validateDoctorPatientAccess(doctorId, patientId);

    // Validate medication exists
    const medication = await MasterMedication.findOne({
      _id: data.medicationId,
      isActive: true
    });
    if (!medication) {
      throw Object.assign(new Error('Medication not found'), { statusCode: 404 });
    }

    // Check for existing assignment
    const existingAssignment = await PatientMedication.findOne({
      patientId,
      medicationId: data.medicationId,
      isActive: true
    });
    if (existingAssignment) {
      throw Object.assign(new Error('Medication already assigned to this patient'), { statusCode: 409 });
    }

    const patientMedication = await PatientMedication.create({
      ...data,
      patientId,
      assignedByDoctor: doctorId,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : undefined,
    });

    // Generate dose logs with medicationId
    await generateDoseLogsWithMedicationId(
      patientMedication._id,
      data.medicationId,
      patientId,
      patientMedication.scheduleType,
      patientMedication.times,
      patientMedication.daysOfWeek,
      patientMedication.startDate,
      patientMedication.endDate
    );

    logger.info('Medication assigned to patient', { 
      patientMedicationId: patientMedication._id, 
      doctorId, 
      patientId,
      medicationId: data.medicationId
    });

    return patientMedication.toObject();
  } catch (error) {
    logger.error('Failed to assign medication to patient', { 
      error: error.message, 
      doctorId, 
      patientId 
    });
    throw error;
  }
}

async function generateDoseLogsWithMedicationId(patientMedicationId, medicationId, patientId, scheduleType, times, daysOfWeek, startDate, endDate) {
  const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
  const end = endDate ? (typeof endDate === 'string' ? parseISO(endDate) : endDate) : null;
  const days = end ? differenceInDays(end, start) + 1 : 30;
  const logs = [];

  for (let i = 0; i < days; i++) {
    const day = addDays(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())), i);
    const dayName = dayOfWeekShort(day);

    let shouldSchedule = false;

    if (scheduleType === 'weekly') {
      if (daysOfWeek && daysOfWeek.includes(dayName)) {
        shouldSchedule = true;
      }
    } else if (scheduleType === 'daily') {
      shouldSchedule = true;
    }

    if (!shouldSchedule) continue;

    for (const timeStr of times) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const scheduledTime = new Date(day);
      scheduledTime.setHours(hours, minutes, 0, 0);

      // Only schedule future doses
      if (scheduledTime >= startOfDay(new Date())) {
        logs.push({
          patientMedicationId,
          medicationId,
          patientId,
          scheduledTime,
          status: 'pending'
        });
      }
    }
  }

  if (logs.length > 0) {
    await DoseLog.insertMany(logs, { ordered: false });
  }

  logger.debug(`Generated ${logs.length} dose logs for patient medication ${patientMedicationId}`);
  return logs.length;
}

export async function getPatientMedications(doctorId, patientId, filters = {}) {
  try {
    // Validate doctor-patient relationship
    await validateDoctorPatientAccess(doctorId, patientId);

    const { active = 'true', page = 1, limit = 20 } = filters;

    const query = { patientId };
    if (active === 'true') {
      query.isActive = true;
    }

    const skip = (page - 1) * limit;

    const [medications, total] = await Promise.all([
      PatientMedication.find(query)
        .populate('medicationId', 'name genericName category strength form manufacturer')
        .populate('assignedByDoctor', 'fullName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      PatientMedication.countDocuments(query)
    ]);

    return {
      medications,
      total,
      page: Number(page),
      limit: Number(limit),
    };
  } catch (error) {
    logger.error('Failed to get patient medications', { 
      error: error.message, 
      doctorId, 
      patientId 
    });
    throw error;
  }
}

export async function getPatientMedicationById(doctorId, patientMedicationId) {
  try {
    const patientMedication = await PatientMedication.findOne({
      _id: patientMedicationId,
      isActive: true
    })
      .populate('medicationId', 'name genericName category strength form manufacturer description sideEffects')
      .populate('assignedByDoctor', 'fullName email')
      .populate('patientId', 'fullName email')
      .lean();

    if (!patientMedication) {
      throw Object.assign(new Error('Patient medication not found'), { statusCode: 404 });
    }

    // Validate doctor-patient relationship
    await validateDoctorPatientAccess(doctorId, patientMedication.patientId._id);

    // Get recent dose logs
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentLogs = await DoseLog.find({
      patientMedicationId,
      scheduledTime: { $gte: sevenDaysAgo }
    })
      .sort({ scheduledTime: -1 })
      .lean();

    return {
      ...patientMedication,
      recentLogs
    };
  } catch (error) {
    logger.error('Failed to get patient medication by ID', { 
      error: error.message, 
      doctorId, 
      patientMedicationId 
    });
    throw error;
  }
}

export async function updatePatientMedication(doctorId, patientMedicationId, updates) {
  try {
    const patientMedication = await PatientMedication.findOne({
      _id: patientMedicationId,
      isActive: true
    }).populate('patientId');

    if (!patientMedication) {
      throw Object.assign(new Error('Patient medication not found'), { statusCode: 404 });
    }

    // Validate doctor-patient relationship
    await validateDoctorPatientAccess(doctorId, patientMedication.patientId._id);

    // Validate doctor ownership
    if (patientMedication.assignedByDoctor.toString() !== doctorId.toString()) {
      throw Object.assign(new Error('Not authorized to update this medication assignment'), { statusCode: 403 });
    }

    // Prepare update data
    const updateData = { ...updates };
    if (updateData.startDate) {
      updateData.startDate = new Date(updateData.startDate);
    }
    if (updateData.endDate) {
      updateData.endDate = new Date(updateData.endDate);
    }

    const updated = await PatientMedication.findByIdAndUpdate(
      patientMedicationId,
      updateData,
      { new: true, runValidators: true }
    ).populate('medicationId', 'name genericName category strength form manufacturer')
     .populate('assignedByDoctor', 'fullName email');

    // Regenerate dose logs if schedule changed
    if (updates.times || updates.startDate || updates.scheduleType || updates.daysOfWeek) {
      await DoseLog.deleteMany({ 
        patientMedicationId, 
        status: 'pending', 
        scheduledTime: { $gte: new Date() } 
      });
      
      await generateDoseLogsWithMedicationId(
        patientMedicationId,
        patientMedication.medicationId,
        patientMedication.patientId._id,
        updated.scheduleType,
        updated.times,
        updated.daysOfWeek,
        updated.startDate,
        updated.endDate
      );
    }

    logger.info('Patient medication updated', { 
      patientMedicationId, 
      doctorId,
      updates: Object.keys(updates)
    });

    return updated;
  } catch (error) {
    logger.error('Failed to update patient medication', { 
      error: error.message, 
      doctorId, 
      patientMedicationId 
    });
    throw error;
  }
}

export async function deletePatientMedication(doctorId, patientMedicationId) {
  try {
    const patientMedication = await PatientMedication.findOne({
      _id: patientMedicationId,
      isActive: true
    }).populate('patientId');

    if (!patientMedication) {
      throw Object.assign(new Error('Patient medication not found'), { statusCode: 404 });
    }

    // Validate doctor-patient relationship
    await validateDoctorPatientAccess(doctorId, patientMedication.patientId._id);

    // Validate doctor ownership
    if (patientMedication.assignedByDoctor.toString() !== doctorId.toString()) {
      throw Object.assign(new Error('Not authorized to delete this medication assignment'), { statusCode: 403 });
    }

    // Soft delete
    patientMedication.isActive = false;
    await patientMedication.save();

    // Delete future pending doses
    await DoseLog.deleteMany({ 
      patientMedicationId, 
      status: 'pending', 
      scheduledTime: { $gte: new Date() } 
    });

    logger.info('Patient medication deleted', { 
      patientMedicationId, 
      doctorId,
      patientId: patientMedication.patientId._id
    });

    return patientMedication;
  } catch (error) {
    logger.error('Failed to delete patient medication', { 
      error: error.message, 
      doctorId, 
      patientMedicationId 
    });
    throw error;
  }
}
