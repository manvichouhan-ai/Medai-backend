import * as doseLogService from './doseLog.service.js';
import { sendSuccess } from '../utils/response.utils.js';

export async function takeDose(req, res, next) {
  try {
    const log = await doseLogService.takeDose(req.params.id, req.user._id, req.body.notes);
    return sendSuccess(res, { log });
  } catch (err) {
    next(err);
  }
}

export async function skipDose(req, res, next) {
  try {
    const log = await doseLogService.skipDose(req.params.id, req.user._id, req.body.notes);
    return sendSuccess(res, { log });
  } catch (err) {
    next(err);
  }
}

export async function listDoseLogs(req, res, next) {
  try {
    const result = await doseLogService.listDoseLogs(req.user._id, req.query);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}
