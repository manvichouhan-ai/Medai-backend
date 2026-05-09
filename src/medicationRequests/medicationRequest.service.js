import { parseISO } from 'date-fns';
import MedicationRequest from '../../models/MedicationRequest.model.js';
import Medication from '../../models/Medication.model.js';
import CaregiverPatient from '../../models/CaregiverPatient.model.js';
import User from '../../models/User.model.js';
import { dispatchAlert } from '../features/notifications/notification.service.js';
import { generateDoseLogs } from '../medications/medication.service.js';
import { logger } from '../utils/logger.js';

export async function createMedicationRequest(userId, userRole, data) {
  const patientId = data.patientId || userId;

  if (userRole === 'caregiver') {
    const link = await CaregiverPatient.findOne({
      caregiverId: userId,
      patientId,
      status: 'active',
    });
    if (!link) {
      throw Object.assign(new Error('Not authorized to create request for this patient'), { statusCode: 403 });
    }
  }

  const request = await MedicationRequest.create({
    patientId,
    requestedBy: userId,
    requestedByRole: userRole,
    type: data.type,
    medicationData: data.medicationData,
    notes: data.notes,
    priority: data.priority || 'medium',
  });

  const doctors = await User.find({ role: 'doctor', isActive: true }).lean();
  const doctorIds = doctors.map((d) => d._id);

  await dispatchAlert(
    patientId,
    'anomaly',
    `New medication request from ${userRole}: ${data.medicationData.name}`,
    'manual'
  );

  logger.info('Medication request created', { requestId: request._id, patientId, requestedBy: userId });
  return request;
}

export async function getMedicationRequests(userId, userRole, filters = {}) {
  const { status, priority, patientId, page = 1, limit = 20 } = filters;

  let query = {};

  if (userRole === 'patient') {
    query.patientId = userId;
  } else if (userRole === 'caregiver') {
    const patientIds = await CaregiverPatient.find({ caregiverId: userId, status: 'active' })
      .distinct('patientId');
    query.patientId = { $in: patientIds };
  } else if (userRole === 'doctor' || userRole === 'admin') {
    if (patientId) {
      query.patientId = patientId;
    }
  }

  if (status) query.status = status;
  if (priority) query.priority = priority;

  const skip = (page - 1) * limit;

  const [requests, total] = await Promise.all([
    MedicationRequest.find(query)
      .populate('patientId', 'fullName email')
      .populate('requestedBy', 'fullName email')
      .populate('reviewedBy', 'fullName email')
      .sort({ priority: -1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    MedicationRequest.countDocuments(query),
  ]);

  return { requests, total, page: Number(page), limit: Number(limit) };
}

export async function getMedicationRequestById(requestId, userId, userRole) {
  const request = await MedicationRequest.findById(requestId)
    .populate('patientId', 'fullName email')
    .populate('requestedBy', 'fullName email')
    .populate('reviewedBy', 'fullName email')
    .lean();

  if (!request) {
    throw Object.assign(new Error('Medication request not found'), { statusCode: 404 });
  }

  if (userRole === 'patient') {
    if (request.patientId._id.toString() !== userId.toString()) {
      throw Object.assign(new Error('Not authorized to view this request'), { statusCode: 403 });
    }
  } else if (userRole === 'caregiver') {
    const link = await CaregiverPatient.findOne({
      caregiverId: userId,
      patientId: request.patientId._id,
      status: 'active',
    });
    if (!link) {
      throw Object.assign(new Error('Not authorized to view this request'), { statusCode: 403 });
    }
  }

  return request;
}

export async function approveMedicationRequest(requestId, doctorId, data) {
  const request = await MedicationRequest.findById(requestId);
  if (!request) {
    throw Object.assign(new Error('Medication request not found'), { statusCode: 404 });
  }

  if (request.status !== 'pending') {
    throw Object.assign(new Error('Request has already been processed'), { statusCode: 400 });
  }

  if (request.type === 'discontinue') {
    await Medication.findOneAndUpdate(
      { name: request.medicationData.name, patientId: request.patientId, isActive: true },
      { isActive: false }
    );
  } else {
    const medicationData = {
      ...request.medicationData,
      startDate: typeof request.medicationData.startDate === 'string'
        ? parseISO(request.medicationData.startDate)
        : request.medicationData.startDate,
      endDate: request.medicationData.endDate
        ? (typeof request.medicationData.endDate === 'string'
          ? parseISO(request.medicationData.endDate)
          : request.medicationData.endDate)
        : undefined,
    };

    const medication = await Medication.create({
      ...medicationData,
      patientId: request.patientId,
      prescribedBy: doctorId,
    });

    await generateDoseLogs(medication._id, request.patientId, medication.frequency, medication.startDate, 30);
  }

  request.status = 'approved';
  request.reviewedBy = doctorId;
  request.reviewedAt = new Date();
  request.notes = data.notes || request.notes;
  await request.save();

  await dispatchAlert(
    request.patientId,
    'anomaly',
    `Your medication request for ${request.medicationData.name} has been approved`,
    'manual'
  );

  logger.info('Medication request approved', { requestId, doctorId, patientId: request.patientId });

  const populatedRequest = await MedicationRequest.findById(requestId)
    .populate('patientId', 'fullName email')
    .populate('requestedBy', 'fullName email')
    .populate('reviewedBy', 'fullName email')
    .lean();

  return populatedRequest;
}

export async function rejectMedicationRequest(requestId, doctorId, data) {
  const request = await MedicationRequest.findById(requestId);
  if (!request) {
    throw Object.assign(new Error('Medication request not found'), { statusCode: 404 });
  }

  if (request.status !== 'pending') {
    throw Object.assign(new Error('Request has already been processed'), { statusCode: 400 });
  }

  request.status = 'rejected';
  request.reviewedBy = doctorId;
  request.reviewedAt = new Date();
  request.rejectionReason = data.rejectionReason;
  request.notes = data.notes || request.notes;
  await request.save();

  await dispatchAlert(
    request.patientId,
    'anomaly',
    `Your medication request for ${request.medicationData.name} has been rejected. Reason: ${data.rejectionReason}`,
    'manual'
  );

  logger.info('Medication request rejected', { requestId, doctorId, patientId: request.patientId });

  const populatedRequest = await MedicationRequest.findById(requestId)
    .populate('patientId', 'fullName email')
    .populate('requestedBy', 'fullName email')
    .populate('reviewedBy', 'fullName email')
    .lean();

  return populatedRequest;
}
