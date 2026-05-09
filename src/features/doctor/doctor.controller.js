import {
  getAssignedPatients,
  getPatientProfile,
  getPatientMedications,
  getPatientDoseLogs,
  getPatientAdherence,
  getPatientRisk,
  getPatientInsights,
  getDoctorAlerts,
  resolveAlert,
  escalateAlert,
  createIntervention,
  getPatientInterventions,
} from './doctor.service.js';
import { sendSuccess, sendError } from '../../utils/response.utils.js';

export async function listPatients(req, res) {
  try {
    const { search, riskLevel, adherenceFilter, page, limit } = req.query;
    const result = await getAssignedPatients(req.user._id, {
      search,
      riskLevel,
      adherenceFilter,
      page,
      limit,
    });
    return sendSuccess(res, result);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}

export async function getPatientById(req, res) {
  try {
    const { id } = req.params;
    const result = await getPatientProfile(req.user._id, id);
    return sendSuccess(res, result);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}

export async function listPatientMedications(req, res) {
  try {
    const { id } = req.params;
    const { active, page, limit } = req.query;
    const result = await getPatientMedications(req.user._id, id, {
      active,
      page,
      limit,
    });
    return sendSuccess(res, result);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}

export async function listPatientDoseLogs(req, res) {
  try {
    const { id } = req.params;
    const { status, fromDate, toDate, page, limit } = req.query;
    const result = await getPatientDoseLogs(req.user._id, id, {
      status,
      fromDate,
      toDate,
      page,
      limit,
    });
    return sendSuccess(res, result);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}

export async function getPatientAdherenceData(req, res) {
  try {
    const { id } = req.params;
    const result = await getPatientAdherence(req.user._id, id);
    return sendSuccess(res, result);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}

export async function getPatientRiskData(req, res) {
  try {
    const { id } = req.params;
    const result = await getPatientRisk(req.user._id, id);
    return sendSuccess(res, result);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}

export async function getPatientInsightsData(req, res) {
  try {
    const { id } = req.params;
    const result = await getPatientInsights(req.user._id, id);
    return sendSuccess(res, result);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}

export async function listAlerts(req, res) {
  try {
    const { unresolved, severity, patientId, page, limit } = req.query;
    const result = await getDoctorAlerts(req.user._id, {
      unresolved,
      severity,
      patientId,
      page,
      limit,
    });
    return sendSuccess(res, result);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}

export async function resolveAlertById(req, res) {
  try {
    const { id } = req.params;
    const { resolutionNotes } = req.body;
    const result = await resolveAlert(id, req.user._id, { resolutionNotes });
    return sendSuccess(res, result);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}

export async function escalateAlertById(req, res) {
  try {
    const { id } = req.params;
    const { escalationNotes } = req.body;
    const result = await escalateAlert(id, req.user._id, { escalationNotes });
    return sendSuccess(res, result);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}

export async function createDoctorIntervention(req, res) {
  try {
    const data = req.body;
    const result = await createIntervention(req.user._id, data);
    return sendSuccess(res, result, 201);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}

export async function listPatientInterventions(req, res) {
  try {
    const { patientId } = req.params;
    const { status, page, limit } = req.query;
    const result = await getPatientInterventions(req.user._id, patientId, {
      status,
      page,
      limit,
    });
    return sendSuccess(res, result);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}