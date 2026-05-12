import {
  assignMedicationToPatient,
  getPatientMedications,
  getPatientMedicationById,
  updatePatientMedication,
  deletePatientMedication,
} from './patientMedication.service.js';
import { sendSuccess, sendError } from '../../utils/response.utils.js';

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

export async function getPatientMedication(req, res) {
  try {
    const { id } = req.params;
    
    const result = await getPatientMedicationById(req.user._id, id);
    return sendSuccess(res, { patientMedication: result });
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}

export async function assignMedication(req, res) {
  try {
    const { id } = req.params;
    const data = req.body;
    
    const result = await assignMedicationToPatient(req.user._id, id, data);
    return sendSuccess(res, { patientMedication: result }, 201);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}

export async function updatePatientMedicationController(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const result = await updatePatientMedication(req.user._id, id, updates);
    return sendSuccess(res, { patientMedication: result });
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}

export async function deletePatientMedicationController(req, res) {
  try {
    const { id } = req.params;
    
    await deletePatientMedication(req.user._id, id);
    return res.status(204).send();
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}
