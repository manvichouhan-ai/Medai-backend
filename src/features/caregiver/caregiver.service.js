import CaregiverPatient from '../../../models/CaregiverPatient.model.js';
import User from '../../../models/User.model.js';
import Alert from '../../../models/Alert.model.js';
import { getAdherenceSummary, getTodayAdherence } from '../../adherence/adherence.service.js';

function getAverageAdherence(adherence = []) {
  if (!adherence.length) return 0;

  const total = adherence.reduce((sum, med) => sum + (med.adherence ?? med.adherence7d ?? 0), 0);
  return Math.round(total / adherence.length);
}

export async function listPatients(caregiverId) {
  const links = await CaregiverPatient.find({ caregiverId, status: 'active' })
    .populate('patientId', 'fullName email phone timezone notificationPrefs isActive')
    .lean();

  const patients = await Promise.all(
    links.map(async (link) => {
      const patient = link.patientId;
      if (!patient) return null;

      const [todayAdherence, adherence] = await Promise.all([
        getTodayAdherence(patient._id),
        getAdherenceSummary(patient._id),
      ]);

      return {
        link: link._id,
        patient,
        todayAdherence,
        adherenceScore: getAverageAdherence(adherence),
      };
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

export async function getPatientNotes(caregiverId, patientId) {
  const link = await CaregiverPatient.findOne({ caregiverId, patientId, status: 'active' });
  if (!link) throw Object.assign(new Error('Patient not linked'), { statusCode: 403 });

  const notes = await Alert.find({
    patientId,
    triggeredBy: 'manual',
    type: 'anomaly',
  })
    .sort({ createdAt: -1 })
    .lean();

  return notes;
}
