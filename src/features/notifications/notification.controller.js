import { sendSuccess } from '../../utils/response.utils.js';
import { dispatchAlert } from './notification.service.js';

export async function sendTestNotification(req, res, next) {
  try {
    const { message = 'Test notification from MedAI' } = req.body;
    await dispatchAlert(req.user._id, 'anomaly', message, 'manual');
    return sendSuccess(res, { sent: true });
  } catch (err) {
    next(err);
  }
}
