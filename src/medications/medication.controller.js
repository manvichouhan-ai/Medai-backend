import * as medicationService from './medication.service.js';
import { sendSuccess } from '../utils/response.utils.js';

export async function listMedications(req, res, next) {
  try {
    const patientId = req.query.patientId || req.user._id;
    const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;
    const meds = await medicationService.listMedications(patientId, req.user.role, isActive);
    return sendSuccess(res, meds);
  } catch (err) {
    next(err);
  }
}

export async function getTodayDoses(req, res, next) {
  try {
    const patientId = req.query.patientId || req.user._id;
    const logs = await medicationService.getTodayDoses(patientId);
    return sendSuccess(res, { doses: logs });
  } catch (err) {
    next(err);
  }
}

export async function getMedicationById(req, res, next) {
  try {
    const med = await medicationService.getMedicationById(req.params.id, req.user._id);
    return sendSuccess(res, med);
  } catch (err) {
    next(err);
  }
}
