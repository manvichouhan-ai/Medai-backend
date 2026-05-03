import * as aiService from './ai.service.js';
import { sendSuccess } from '../../utils/response.utils.js';

export async function getRiskScore(req, res, next) {
  try {
    const result = await aiService.getRiskScore(req.params.patientId);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getInsights(req, res, next) {
  try {
    const result = await aiService.generateInsight(req.params.patientId);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function runPredictions(req, res, next) {
  try {
    const result = await aiService.runBatchPredictions();
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}
