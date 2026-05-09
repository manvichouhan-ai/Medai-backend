import * as interventionService from './intervention.service.js';
import { sendSuccess } from '../../utils/response.utils.js';

export async function createIntervention(req, res, next) {
  try {
    const intervention = await interventionService.createIntervention(
      req.user._id,
      req.user.role,
      req.body
    );
    return sendSuccess(res, { intervention }, 201);
  } catch (err) {
    next(err);
  }
}

export async function listInterventions(req, res, next) {
  try {
    const result = await interventionService.getInterventions(
      req.user._id,
      req.user.role,
      req.query
    );
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getIntervention(req, res, next) {
  try {
    const intervention = await interventionService.getInterventionById(
      req.params.id,
      req.user._id,
      req.user.role
    );
    return sendSuccess(res, { intervention });
  } catch (err) {
    next(err);
  }
}

export async function updateIntervention(req, res, next) {
  try {
    const intervention = await interventionService.updateIntervention(
      req.params.id,
      req.user._id,
      req.user.role,
      req.body
    );
    return sendSuccess(res, { intervention });
  } catch (err) {
    next(err);
  }
}

export async function resolveIntervention(req, res, next) {
  try {
    const intervention = await interventionService.resolveIntervention(
      req.params.id,
      req.user._id,
      req.body
    );
    return sendSuccess(res, { intervention });
  } catch (err) {
    next(err);
  }
}
