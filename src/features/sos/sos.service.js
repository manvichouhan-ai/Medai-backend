import mongoose from 'mongoose';
import SOSMedication from '../../../models/SOSMedication.model.js';
import SOSDoseLog from '../../../models/SOSDoseLog.model.js';
import { dispatchAlert } from '../notifications/notification.service.js';
import { logger } from '../../utils/logger.js';

// ─── Doctor operations ────────────────────────────────────────────────────────

export async function createSOSMedication(doctorId, data) {
  const med = await SOSMedication.create({ ...data, createdBy: doctorId });
  return med;
}

export async function listSOSMedications(doctorId) {
  return SOSMedication.find({ createdBy: doctorId, isActive: true }).lean();
}

export async function getSOSMedicationById(id, doctorId) {
  const med = await SOSMedication.findOne({ _id: id, createdBy: doctorId }).lean();
  if (!med) {
    const err = new Error('SOS medication not found');
    err.statusCode = 404;
    throw err;
  }
  return med;
}

export async function updateSOSMedication(id, doctorId, data) {
  const med = await SOSMedication.findOneAndUpdate(
    { _id: id, createdBy: doctorId, isActive: true },
    data,
    { new: true, runValidators: true }
  ).lean();
  if (!med) {
    const err = new Error('SOS medication not found');
    err.statusCode = 404;
    throw err;
  }
  return med;
}

export async function deleteSOSMedication(id, doctorId) {
  const med = await SOSMedication.findOneAndUpdate(
    { _id: id, createdBy: doctorId },
    { isActive: false },
    { new: true }
  ).lean();
  if (!med) {
    const err = new Error('SOS medication not found');
    err.statusCode = 404;
    throw err;
  }
  return med;
}

export async function assignPatients(id, doctorId, patientIds) {
  const objectIds = patientIds.map((p) => new mongoose.Types.ObjectId(p));
  const med = await SOSMedication.findOneAndUpdate(
    { _id: id, createdBy: doctorId, isActive: true },
    { $addToSet: { assignedPatients: { $each: objectIds } } },
    { new: true }
  ).lean();
  if (!med) {
    const err = new Error('SOS medication not found');
    err.statusCode = 404;
    throw err;
  }
  return med;
}

export async function unassignPatient(id, doctorId, patientId) {
  const med = await SOSMedication.findOneAndUpdate(
    { _id: id, createdBy: doctorId, isActive: true },
    { $pull: { assignedPatients: new mongoose.Types.ObjectId(patientId) } },
    { new: true }
  ).lean();
  if (!med) {
    const err = new Error('SOS medication not found');
    err.statusCode = 404;
    throw err;
  }
  return med;
}

// ─── Patient operations ───────────────────────────────────────────────────────

export async function listPatientSOSMedications(patientId) {
  return SOSMedication.find({
    assignedPatients: patientId,
    isActive: true,
  })
    .populate('createdBy', 'fullName email')
    .lean();
}

export async function takeSOSDose(patientId, body) {
  const { sosMedicationId, reason, painLevel, notes } = body;

  const med = await SOSMedication.findOne({
    _id: sosMedicationId,
    assignedPatients: patientId,
    isActive: true,
  }).lean();

  if (!med) {
    const err = new Error('SOS medication not found or not assigned to you');
    err.statusCode = 404;
    throw err;
  }

  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);

  const [lastDose, dosesToday] = await Promise.all([
    SOSDoseLog.findOne({ patient: patientId, sosMedication: sosMedicationId })
      .sort({ takenAt: -1 })
      .lean(),
    SOSDoseLog.countDocuments({
      patient: patientId,
      sosMedication: sosMedicationId,
      takenAt: { $gte: dayStart },
    }),
  ]);

  if (lastDose) {
    const cooldownMs = med.cooldownMinutes * 60 * 1000;
    const elapsed = now - new Date(lastDose.takenAt);
    if (elapsed < cooldownMs) {
      const timeRemaining = Math.ceil((cooldownMs - elapsed) / 60000);
      const err = new Error(`Cooldown active. You can take this medication again in ${timeRemaining} minute(s).`);
      err.statusCode = 429;
      err.timeRemaining = timeRemaining;
      throw err;
    }
  }

  if (dosesToday >= med.maxDosesPerDay) {
    const err = new Error(`Daily limit of ${med.maxDosesPerDay} dose(s) reached for today.`);
    err.statusCode = 429;
    throw err;
  }

  const log = await SOSDoseLog.create({
    patient: patientId,
    sosMedication: sosMedicationId,
    takenAt: now,
    reason,
    painLevel,
    notes,
  });

  const alertMessage = `SOS medication "${med.name}" taken by patient. Reason: ${reason || 'Not provided'}. Pain level: ${painLevel ?? 'Not reported'}.`;

  dispatchAlert(patientId, 'sos_taken', alertMessage, 'manual').then(async (alert) => {
    await SOSDoseLog.findByIdAndUpdate(log._id, {
      notifiedDoctor: true,
      notifiedCaregiver: true,
    });
  }).catch((err) => {
    logger.error('SOS alert dispatch failed', { error: err.message, patientId, sosMedicationId });
  });

  return SOSDoseLog.findById(log._id).populate('sosMedication', 'name dosage unit').lean();
}

// ─── Shared log queries ───────────────────────────────────────────────────────

export async function getLogsForMedication(medicationId, doctorId) {
  const med = await SOSMedication.findOne({ _id: medicationId, createdBy: doctorId }).lean();
  if (!med) {
    const err = new Error('SOS medication not found');
    err.statusCode = 404;
    throw err;
  }
  return SOSDoseLog.find({ sosMedication: medicationId })
    .populate('patient', 'fullName email')
    .sort({ takenAt: -1 })
    .lean();
}

export async function getPatientSOSLogs(patientId) {
  return SOSDoseLog.find({ patient: patientId })
    .populate('sosMedication', 'name dosage unit importance')
    .sort({ takenAt: -1 })
    .lean();
}
