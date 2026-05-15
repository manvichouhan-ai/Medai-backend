import {
  createMasterMedication,
  getMasterMedications,
  getMasterMedicationById,
  updateMasterMedication,
  deleteMasterMedication,
  getMedicationCategories,
} from './masterMedication.service.js';
import { sendSuccess, sendError } from '../../utils/response.utils.js';

export async function listMasterMedications(req, res) {
  try {
    const { search, category, importance, page, limit, sortBy, sortOrder } = req.query;
    const doctorId = req.user.role === 'admin' ? null : req.user._id;
    
    const result = await getMasterMedications(doctorId, {
      search,
      category,
      importance,
      page,
      limit,
      sortBy,
      sortOrder,
    });
    
    return sendSuccess(res, result);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}

export async function listMedicationsByImportance(req, res) {
  try {
    const { level } = req.query;
    if (!level) {
      return sendError(res, 'Query param `level` is required (critical | important | routine)', 400);
    }
    const doctorId = req.user.role === 'admin' ? null : req.user._id;
    const result = await getMedicationsByImportance(doctorId, level);
    return sendSuccess(res, result);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}

export async function getMasterMedication(req, res) {
  try {
    const { id } = req.params;
    const doctorId = req.user.role === 'admin' ? null : req.user._id;
    
    const result = await getMasterMedicationById(id, doctorId);
    return sendSuccess(res, { medication: result });
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}

export async function createMasterMedicationController(req, res) {
  try {
    const data = req.body;
    const result = await createMasterMedication(req.user._id, data);
    return sendSuccess(res, { medication: result }, 201);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}

export async function updateMasterMedicationController(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;
    const doctorId = req.user.role === 'admin' ? null : req.user._id;
    
    const result = await updateMasterMedication(id, doctorId, updates);
    return sendSuccess(res, { medication: result });
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}

export async function deleteMasterMedicationController(req, res) {
  try {
    const { id } = req.params;
    const doctorId = req.user.role === 'admin' ? null : req.user._id;
    
    await deleteMasterMedication(id, doctorId);
    return res.status(204).send();
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}

export async function listMedicationCategories(req, res) {
  try {
    const doctorId = req.user.role === 'admin' ? null : req.user._id;
    const categories = await getMedicationCategories(doctorId);
    return sendSuccess(res, { categories });
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500);
  }
}
