import * as medicationService from './medication.service.js';
import { sendSuccess } from '../utils/response.utils.js';

export async function listMedications(req, res, next) {
  try {
    const meds = await medicationService.listMedications(
      req.user._id,
      req.user.role,
      req.query.patientId
    );
    return sendSuccess(res, { medications: meds });
  } catch (err) {
    next(err);
  }
}

export async function getTodayDoses(req, res, next) {
  try {
    const logs = await medicationService.getTodayDoses(req.user._id);
    return sendSuccess(res, { doses: logs });
  } catch (err) {
    next(err);
  }
}

export async function getMedicationById(req, res, next) {
  try {
    const med = await medicationService.getMedicationById(req.params.id, req.user._id);
    return sendSuccess(res, { medication: med });
  } catch (err) {
    next(err);
  }
}

export async function createMedication(req, res, next) {
  try {
    const patientId = req.body.patientId || req.user._id;
    const med = await medicationService.createMedication(patientId, req.body);
    return sendSuccess(res, { medication: med }, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateMedication(req, res, next) {
  try {
    const med = await medicationService.updateMedication(req.params.id, req.user._id, req.body);
    return sendSuccess(res, { medication: med });
  } catch (err) {
    next(err);
  }
}

export async function deleteMedication(req, res, next) {
  try {
    await medicationService.deleteMedication(req.params.id, req.user._id);
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
}
