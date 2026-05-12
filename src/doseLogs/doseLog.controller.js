// src/doseLogs/doseLog.controller.js
import * as doseLogService from './doseLog.service.js';
import { sendSuccess } from '../utils/response.utils.js';

export async function takeDose(req, res, next) {
  try {
    const log = await doseLogService.takeDose(
      req.params.id,
      req.user._id,
      req.body.notes,
      req.user.role
    );
    return sendSuccess(res, { log });
  } catch (err) {
    next(err);
  }
}

export async function skipDose(req, res, next) {
  try {
    const log = await doseLogService.skipDose(
      req.params.id,
      req.user._id,
      req.body.notes,
      req.user.role
    );
    return sendSuccess(res, { log });
  } catch (err) {
    next(err);
  }
}

export async function listDoseLogs(req, res, next) {
  try {
    const { patientId, ...rest } = req.query;
    const targetId =
      patientId && ['doctor', 'admin', 'caregiver'].includes(req.user.role)
        ? patientId
        : req.user._id;

    const result = await doseLogService.listDoseLogs(targetId, rest);
    // Normalize: frontend expects { doseLogs, total, page, limit }
    return sendSuccess(res, {
      doseLogs: result.logs ?? result.doseLogs ?? [],
      total: result.total ?? 0,
      page: result.page ?? 1,
      limit: result.limit ?? 20,
    });
  } catch (err) {
    next(err);
  }
}
