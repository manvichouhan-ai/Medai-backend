// src/features/doctor/doctor.controller.js
import {
  getAssignedPatients,
  getPatientProfile,
  getPatientDoseLogs,
  getPatientAdherence,
  getPatientRisk,
  getPatientInsights,
  getDoctorAlerts,
  resolveAlert,
  escalateAlert,
  createIntervention,
  getPatientInterventions,
  createPatient,
  createCaregiver,
  getAssignedCaregivers,
  assignCaregiverToPatient,
} from './doctor.service.js';
import { getDoctorDashboard } from './doctor.dashboard.service.js';
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
    // Frontend maps flat array — expose patients array at top level
    return sendSuccess(res, {
      patients: result.patients,
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}

export async function getPatientById(req, res) {
  try {
    const result = await getPatientProfile(req.user._id, req.params.id);
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
    return sendSuccess(res, {
      doseLogs: result.logs ?? result.doseLogs ?? [],
      total: result.total ?? 0,
      page: result.page ?? 1,
      limit: result.limit ?? 20,
    });
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}

export async function getPatientAdherenceData(req, res) {
  try {
    const result = await getPatientAdherence(req.user._id, req.params.id);
    return sendSuccess(res, result);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}

export async function getPatientRiskData(req, res) {
  try {
    const result = await getPatientRisk(req.user._id, req.params.id);
    return sendSuccess(res, result);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}

export async function getPatientInsightsData(req, res) {
  try {
    const result = await getPatientInsights(req.user._id, req.params.id);
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
    return sendSuccess(res, {
      alerts: result.alerts ?? [],
      total: result.total ?? 0,
      page: result.page ?? 1,
      limit: result.limit ?? 20,
    });
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}

export async function resolveAlertById(req, res) {
  try {
    const result = await resolveAlert(req.params.id, req.user._id, req.body);
    return sendSuccess(res, { alert: result });
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}

export async function escalateAlertById(req, res) {
  try {
    const result = await escalateAlert(req.params.id, req.user._id, req.body);
    return sendSuccess(res, result);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}

export async function createDoctorIntervention(req, res) {
  try {
    const result = await createIntervention(req.user._id, req.body);
    return sendSuccess(res, { intervention: result }, 201);
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
    return sendSuccess(res, {
      interventions: result.interventions ?? [],
      total: result.total ?? 0,
      page: result.page ?? 1,
      limit: result.limit ?? 20,
    });
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}

export async function createPatientAccount(req, res) {
  try {
    const result = await createPatient(req.user._id, req.body);
    return sendSuccess(res, { patient: result }, 201);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}

export async function createCaregiverAccount(req, res) {
  try {
    const result = await createCaregiver(req.user._id, req.body);
    return sendSuccess(res, { caregiver: result }, 201);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}

export async function listCaregivers(req, res) {
  try {
    const result = await getAssignedCaregivers(req.user._id);
    return sendSuccess(res, { caregivers: result });
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}

export async function assignCaregiver(req, res) {
  try {
    const result = await assignCaregiverToPatient(req.user._id, req.params.id, req.body);
    return sendSuccess(res, { assignment: result }, 201);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}

export async function getDashboard(req, res) {
  try {
    const data = await getDoctorDashboard(req.user._id);
    return sendSuccess(res, { dashboard: data });
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}
