import * as caregiverDoseLogService from './caregiverDoseLog.service.js';
import { sendSuccess } from '../utils/response.utils.js';

export async function assistDose(req, res, next) {
  try {
    const log = await caregiverDoseLogService.assistDose(req.params.id, req.user._id, req.body, req.user.role);
    return sendSuccess(res, { log });
  } catch (err) {
    next(err);
  }
}

export async function confirmDose(req, res, next) {
  try {
    const log = await caregiverDoseLogService.confirmDose(req.params.id, req.user._id, req.body);
    return sendSuccess(res, { log });
  } catch (err) {
    next(err);
  }
}

export async function disputeDose(req, res, next) {
  try {
    const log = await caregiverDoseLogService.disputeDose(req.params.id, req.user._id, req.body);
    return sendSuccess(res, { log });
  } catch (err) {
    next(err);
  }
}

export async function getPendingConfirmations(req, res, next) {
  try {
    const result = await caregiverDoseLogService.getPendingConfirmations(req.user._id, req.query);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getAssistedHistory(req, res, next) {
  try {
    const result = await caregiverDoseLogService.getAssistedHistory(req.user._id, req.query);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}
