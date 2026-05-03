import CaregiverPatient from '../../../models/CaregiverPatient.model.js';
import User from '../../../models/User.model.js';
import Alert from '../../../models/Alert.model.js';
import { getAdherenceSummary } from '../../adherence/adherence.service.js';

export async function listPatients(caregiverId) {
  const links = await CaregiverPatient.find({ caregiverId, status: 'active' })
    .populate('patientId', 'fullName email phone timezone notificationPrefs')
    .lean();

  const patients = await Promise.all(
    links.map(async (link) => {
      const patient = link.patientId;
      if (!patient) return null;
      const [summary] = await Promise.all([getAdherenceSummary(patient._id)]);
      const todayAdherence =
        summary.length > 0
          ? Math.round(summary.reduce((a, m) => a + m.adherence7d, 0) / summary.length)
          : 0;
      return { link: link._id, patient, todayAdherence };
    })
  );

  return patients.filter(Boolean);
}

export async function getPatientSummary(caregiverId, patientId) {
  const link = await CaregiverPatient.findOne({ caregiverId, patientId, status: 'active' });
  if (!link) throw Object.assign(new Error('Patient not linked'), { statusCode: 403 });

  const patient = await User.findById(patientId).select('-passwordHash').lean();
  const adherence = await getAdherenceSummary(patientId);
  const recentAlerts = await Alert.find({ patientId }).sort({ createdAt: -1 }).limit(10).lean();

  return { patient, adherence, recentAlerts };
}

export async function invitePatient(caregiverId, patientEmail) {
  const patient = await User.findOne({ email: patientEmail, role: 'patient' });
  if (!patient) throw Object.assign(new Error('Patient not found'), { statusCode: 404 });

  const existing = await CaregiverPatient.findOne({ caregiverId, patientId: patient._id });
  if (existing) throw Object.assign(new Error('Already invited or linked'), { statusCode: 409 });

  const link = await CaregiverPatient.create({
    caregiverId,
    patientId: patient._id,
    status: 'pending',
  });
  return link;
}

export async function acceptInvite(linkId, patientId) {
  const link = await CaregiverPatient.findOneAndUpdate(
    { _id: linkId, patientId, status: 'pending' },
    { status: 'active' },
    { new: true }
  );
  if (!link) throw Object.assign(new Error('Invite not found'), { statusCode: 404 });
  return link;
}

export async function addNote(caregiverId, patientId, message) {
  const link = await CaregiverPatient.findOne({ caregiverId, patientId, status: 'active' });
  if (!link) throw Object.assign(new Error('Patient not linked'), { statusCode: 403 });

  const alert = await Alert.create({
    patientId,
    triggeredBy: 'manual',
    type: 'anomaly',
    message,
    sentTo: [caregiverId],
    channels: ['manual'],
  });
  return alert;
}
