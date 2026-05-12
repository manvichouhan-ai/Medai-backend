// src/adherence/adherence.controller.js
import * as adherenceService from './adherence.service.js';
import { sendSuccess } from '../utils/response.utils.js';

export async function getAdherenceSummary(req, res, next) {
  try {
    const { period = 'month', patientId } = req.query;
    const targetId =
      patientId && ['doctor', 'admin', 'caregiver'].includes(req.user.role)
        ? patientId
        : req.user._id;

    const summary = await adherenceService.getAdherenceSummary(targetId, period);
    return sendSuccess(res, summary);
  } catch (err) {
    next(err);
  }
}

export async function getAdherenceHistory(req, res, next) {
  try {
    const { patientId, ...rest } = req.query;
    const targetId =
      patientId && ['doctor', 'admin', 'caregiver'].includes(req.user.role)
        ? patientId
        : req.user._id;

    const history = await adherenceService.getAdherenceHistory(targetId, rest);
    return sendSuccess(res, { history });
  } catch (err) {
    next(err);
  }
}
