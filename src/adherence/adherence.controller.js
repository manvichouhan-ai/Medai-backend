import * as adherenceService from './adherence.service.js';
import { sendSuccess } from '../utils/response.utils.js';

export async function getAdherenceSummary(req, res, next) {
  try {
    const summary = await adherenceService.getAdherenceSummary(req.user._id);
    return sendSuccess(res, { medications: summary });
  } catch (err) {
    next(err);
  }
}

export async function getAdherenceHistory(req, res, next) {
  try {
    const history = await adherenceService.getAdherenceHistory(req.user._id, req.query);
    return sendSuccess(res, { history });
  } catch (err) {
    next(err);
  }
}
