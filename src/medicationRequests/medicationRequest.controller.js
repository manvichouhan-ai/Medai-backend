import * as medicationRequestService from './medicationRequest.service.js';
import { sendSuccess } from '../utils/response.utils.js';

export async function createRequest(req, res, next) {
  try {
    const request = await medicationRequestService.createMedicationRequest(
      req.user._id,
      req.user.role,
      req.body
    );
    return sendSuccess(res, { request }, 201);
  } catch (err) {
    next(err);
  }
}

export async function listRequests(req, res, next) {
  try {
    const result = await medicationRequestService.getMedicationRequests(
      req.user._id,
      req.user.role,
      req.query
    );
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getRequest(req, res, next) {
  try {
    const request = await medicationRequestService.getMedicationRequestById(
      req.params.id,
      req.user._id,
      req.user.role
    );
    return sendSuccess(res, { request });
  } catch (err) {
    next(err);
  }
}

export async function approveRequest(req, res, next) {
  try {
    const request = await medicationRequestService.approveMedicationRequest(
      req.params.id,
      req.user._id,
      req.body
    );
    return sendSuccess(res, { request });
  } catch (err) {
    next(err);
  }
}

export async function rejectRequest(req, res, next) {
  try {
    const request = await medicationRequestService.rejectMedicationRequest(
      req.params.id,
      req.user._id,
      req.body
    );
    return sendSuccess(res, { request });
  } catch (err) {
    next(err);
  }
}
