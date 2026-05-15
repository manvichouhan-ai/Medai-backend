import * as sosService from './sos.service.js';
import { sendSuccess, sendError } from '../../utils/response.utils.js';

// ─── Doctor controllers ───────────────────────────────────────────────────────

export async function createSOSMedication(req, res, next) {
  try {
    const med = await sosService.createSOSMedication(req.user._id, req.body);
    return sendSuccess(res, med, 201);
  } catch (err) {
    next(err);
  }
}

export async function listSOSMedications(req, res, next) {
  try {
    const meds = await sosService.listSOSMedications(req.user._id);
    return sendSuccess(res, meds);
  } catch (err) {
    next(err);
  }
}

export async function getSOSMedication(req, res, next) {
  try {
    const med = await sosService.getSOSMedicationById(req.params.id, req.user._id);
    return sendSuccess(res, med);
  } catch (err) {
    next(err);
  }
}

export async function updateSOSMedication(req, res, next) {
  try {
    const med = await sosService.updateSOSMedication(req.params.id, req.user._id, req.body);
    return sendSuccess(res, med);
  } catch (err) {
    next(err);
  }
}

export async function deleteSOSMedication(req, res, next) {
  try {
    await sosService.deleteSOSMedication(req.params.id, req.user._id);
    return sendSuccess(res, { message: 'SOS medication deactivated' });
  } catch (err) {
    next(err);
  }
}

export async function assignPatients(req, res, next) {
  try {
    const { patientIds } = req.body;
    if (!Array.isArray(patientIds) || patientIds.length === 0) {
      return sendError(res, 'patientIds must be a non-empty array', 400);
    }
    const med = await sosService.assignPatients(req.params.id, req.user._id, patientIds);
    return sendSuccess(res, med);
  } catch (err) {
    next(err);
  }
}

export async function unassignPatient(req, res, next) {
  try {
    const med = await sosService.unassignPatient(req.params.id, req.user._id, req.params.patientId);
    return sendSuccess(res, med);
  } catch (err) {
    next(err);
  }
}

// ─── Patient controllers ──────────────────────────────────────────────────────

export async function listMySOSMedications(req, res, next) {
  try {
    const meds = await sosService.listPatientSOSMedications(req.user._id);
    return sendSuccess(res, meds);
  } catch (err) {
    next(err);
  }
}

export async function takeSOSDose(req, res, next) {
  try {
    const log = await sosService.takeSOSDose(req.user._id, req.body);
    return sendSuccess(res, log, 201);
  } catch (err) {
    if (err.statusCode === 429) {
      return res.status(429).json({
        success: false,
        error: err.message,
        ...(err.timeRemaining != null && { timeRemaining: err.timeRemaining }),
      });
    }
    next(err);
  }
}

// ─── Shared controllers ───────────────────────────────────────────────────────

export async function getMedicationLogs(req, res, next) {
  try {
    const logs = await sosService.getLogsForMedication(req.params.id, req.user._id);
    return sendSuccess(res, logs);
  } catch (err) {
    next(err);
  }
}

export async function getPatientSOSLogs(req, res, next) {
  try {
    const logs = await sosService.getPatientSOSLogs(req.params.patientId);
    return sendSuccess(res, logs);
  } catch (err) {
    next(err);
  }
}
