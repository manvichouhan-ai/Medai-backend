import * as caregiverService from './caregiver.service.js';
import { sendSuccess } from '../../utils/response.utils.js';

export async function listPatients(req, res, next) {
  try {
    const patients = await caregiverService.listPatients(req.user._id);
    return sendSuccess(res, { patients });
  } catch (err) {
    next(err);
  }
}

export async function getPatientSummary(req, res, next) {
  try {
    const summary = await caregiverService.getPatientSummary(req.user._id, req.params.id);
    return sendSuccess(res, summary);
  } catch (err) {
    next(err);
  }
}

export async function invitePatient(req, res, next) {
  try {
    const link = await caregiverService.invitePatient(req.user._id, req.params.patientEmail);
    return sendSuccess(res, { link }, 201);
  } catch (err) {
    next(err);
  }
}

export async function acceptInvite(req, res, next) {
  try {
    const link = await caregiverService.acceptInvite(req.params.id, req.user._id);
    return sendSuccess(res, { link });
  } catch (err) {
    next(err);
  }
}

export async function addNote(req, res, next) {
  try {
    const alert = await caregiverService.addNote(req.user._id, req.params.id, req.body.content);
    return sendSuccess(res, { alert }, 201);
  } catch (err) {
    next(err);
  }
}

export async function getPatientNotes(req, res, next) {
  try {
    const notes = await caregiverService.getPatientNotes(req.user._id, req.params.patientId);
    return sendSuccess(res, { notes });
  } catch (err) {
    next(err);
  }
}
