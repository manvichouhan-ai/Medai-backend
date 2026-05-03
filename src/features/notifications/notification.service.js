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
  const alert = await Alert.create({
    patientId,
    triggeredBy,
    type: alertType,
    message,
    channels: [],
    sentTo: [],
  });

  const caregiverLinks = await CaregiverPatient.find({ patientId, status: 'active' })
    .populate('caregiverId', 'fullName phone email fcmToken notificationPrefs')
    .lean();

  const sentTo = [];
  const channels = new Set();

  for (const link of caregiverLinks) {
    const cg = link.caregiverId;
    if (!cg) continue;

    if (link.alertPreferences?.push && cg.fcmToken) {
      await sendPushNotification(cg.fcmToken, 'MedAI Alert', message);
      channels.add('push');
    }
    if (link.alertPreferences?.sms && cg.phone) {
      await sendSMS(cg.phone, `MedAI: ${message}`);
      channels.add('sms');
    }
    if (link.alertPreferences?.email && cg.email) {
      await sendEmail(cg.email, 'MedAI Alert', `<p>${message}</p>`);
      channels.add('email');
    }
    sentTo.push(cg._id);
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
      message,
      timestamp: alert.createdAt,
    });
  } catch (err) {
    logger.debug('Socket emit skipped (IO not ready)', { error: err.message });
  }

  logger.info('Alert dispatched', { patientId, alertType, caregivers: sentTo.length });
  return alert;
}
