import * as alertService from './alert.service.js';
import * as interventionService from '../interventions/intervention.service.js';
import { sendSuccess } from '../../utils/response.utils.js';

export async function listAlerts(req, res, next) {
  try {
    const result = await alertService.listAlerts(req.user._id, req.query);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function acknowledgeAlert(req, res, next) {
  try {
    const alert = await alertService.acknowledgeAlert(req.params.id, req.user._id);
    return sendSuccess(res, { alert });
  } catch (err) {
    next(err);
  }
}

export async function escalateAlert(req, res, next) {
  try {
    const result = await interventionService.escalateAlert(req.params.id, req.user._id, req.body);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function resolveAlert(req, res, next) {
  try {
    const alert = await interventionService.resolveAlert(req.params.id, req.user._id, req.body);
    return sendSuccess(res, { alert });
  } catch (err) {
    next(err);
  }
}
