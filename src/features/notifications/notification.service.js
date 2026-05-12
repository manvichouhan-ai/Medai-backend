import User from '../../../models/User.model.js';
import Alert from '../../../models/Alert.model.js';
import CaregiverPatient from '../../../models/CaregiverPatient.model.js';
import { sendPushNotification } from '../../services/firebase.service.js';
import { sendSMS } from '../../services/twilio.service.js';
import { sendEmail } from '../../services/email.service.js';
import { logger } from '../../utils/logger.js';
import { getIO } from '../../socket/index.js';

export async function sendUserPushNotification(userId, title, body) {
  const user = await User.findById(userId).select('fcmToken notificationPrefs').lean();
  if (!user?.notificationPrefs?.push) return;
  await sendPushNotification(user.fcmToken, title, body);
}

export async function dispatchAlert(patientId, alertType, message, triggeredBy = 'system') {
  const patient = await User.findById(patientId)
    .select('fullName email phone notificationPrefs')
    .lean();

  // Debug log at TOP of dispatchAlert
  logger.info('dispatchAlert called', { 
    patientId, 
    patientEmail: patient?.email, 
    notificationPrefs: patient?.notificationPrefs,
    alertType 
  });

  const sendMessage =
    alertType === 'missed_dose' && patient?.fullName
      ? `Dear ${patient.fullName}, you missed your ${message}. Please take it as soon as possible or contact your caregiver.`
      : message;

  const alert = await Alert.create({
    patientId,
    triggeredBy,
    type: alertType,
    message: sendMessage,
    channels: [],
    sentTo: [],
  });

  const caregiverLinks = await CaregiverPatient.find({ patientId, status: 'active' })
    .populate('caregiverId', 'fullName phone email fcmToken notificationPrefs')
    .lean();

  // Debug log - raw result of CaregiverPatient.find()
  logger.info('Raw CaregiverPatient query result', { 
    patientId, 
    rawResult: JSON.stringify(caregiverLinks, null, 2)
  });

  // Debug log for each caregiver details
  caregiverLinks.forEach((link, index) => {
    const cg = link.caregiverId;
    logger.info(`Caregiver ${index + 1} details`, {
      caregiverId: cg?._id,
      fullName: cg?.fullName,
      email: cg?.email,
      phone: cg?.phone,
      notificationPrefs: cg?.notificationPrefs,
      alertPreferences: link.alertPreferences,
      hasFcmToken: !!cg?.fcmToken
    });
  });

  const sentTo = [];
  const channels = new Set();

  for (const link of caregiverLinks) {
    const cg = link.caregiverId;
    if (!cg) continue;

    if (link.alertPreferences?.push && cg.fcmToken) {
      await sendPushNotification(cg.fcmToken, 'MedAI Alert', sendMessage);
      channels.add('push');
    }
    // Fix: treat undefined alertPreferences as true for SMS (default to sending)
    if ((link.alertPreferences?.sms !== false) && cg.phone) {
      logger.info('Sending SMS to caregiver', { caregiverPhone: cg.phone, caregiverName: cg.fullName, alertPrefs: link.alertPreferences });
      await sendSMS(cg.phone, sendMessage);
      channels.add('sms');
    }
    // Fix: treat undefined alertPreferences as true for email (default to sending)
    if ((link.alertPreferences?.email !== false) && cg.email) {
      logger.info('Sending email to caregiver', { caregiverEmail: cg.email, caregiverName: cg.fullName, alertPrefs: link.alertPreferences });
      await sendEmail(cg.email, 'MedAI Missed Dose Alert', `<p>${sendMessage}</p>`);
      channels.add('email');
    }
    sentTo.push(cg._id);
  }

  if (patient) {
    const patientTasks = [];
    // Fix: treat undefined notificationPrefs as true for email (default to sending)
    if ((patient.notificationPrefs?.email !== false) && patient.email) {
      logger.info('Sending email to patient', { patientEmail: patient.email, patientName: patient.fullName, notificationPrefs: patient.notificationPrefs });
      patientTasks.push(sendEmail(patient.email, 'MedAI Missed Dose Alert', `<p>${sendMessage}</p>`));
      channels.add('email');
    }
    // Fix: treat undefined notificationPrefs as true for SMS (default to sending)
    if ((patient.notificationPrefs?.sms !== false) && patient.phone) {
      logger.info('Sending SMS to patient', { patientPhone: patient.phone, patientName: patient.fullName, notificationPrefs: patient.notificationPrefs });
      patientTasks.push(sendSMS(patient.phone, sendMessage));
      channels.add('sms');
    }
    const settled = await Promise.allSettled(patientTasks);
    settled.forEach((r) => {
      if (r.status === 'rejected') logger.error('Patient notification failed', { error: r.reason?.message });
    });
  }

  await Alert.findByIdAndUpdate(alert._id, {
    sentTo,
    channels: Array.from(channels),
  });

  try {
    const io = getIO();
    io.to(patientId.toString()).emit('new_alert', {
      alertId: alert._id,
      type: alertType,
      message: sendMessage,
      timestamp: alert.createdAt,
    });
  } catch (err) {
    logger.debug('Socket emit skipped (IO not ready)', { error: err.message });
  }

  logger.info('Alert dispatched', { patientId, alertType, caregivers: sentTo.length });
  return alert;
}
