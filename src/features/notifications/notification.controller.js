import { sendEmail } from '../../services/email.service.js';
import { sendSMS } from '../../services/twilio.service.js';

function formatTimeIST(date) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export async function sendTestNotification(req, res, next) {
  try {
    const { email, phone, fullName } = req.user;
    const timeIST = formatTimeIST(new Date());
    const message = `Dear ${fullName}, you missed your Metformin 500mg dose scheduled at ${timeIST}. Please take it as soon as possible or contact your caregiver.`;
    const tasks = [];

    if (email) tasks.push({ channel: 'email', promise: sendEmail(email, 'MedAI Missed Dose Alert', `<p>${message}</p>`) });
    if (phone) tasks.push({ channel: 'sms', promise: sendSMS(phone, message) });

    const settled = await Promise.allSettled(tasks.map((t) => t.promise));
    const results = tasks.map((t, i) => ({
      channel: t.channel,
      status: settled[i].status === 'fulfilled' ? 'sent' : 'failed',
      ...(settled[i].status === 'rejected' ? { error: settled[i].reason?.message } : {}),
    }));

    const anyFailed = results.some((r) => r.status === 'failed');
    const anySucceeded = results.some((r) => r.status === 'sent');
    const statusCode = anyFailed && anySucceeded ? 207 : anyFailed ? 500 : 200;

    return res.status(statusCode).json({ success: statusCode < 300, results });
  } catch (err) {
    next(err);
  }
}
