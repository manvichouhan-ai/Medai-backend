import Alert from '../../../models/Alert.model.js';

export async function listAlerts(userId, { unread, page = 1, limit = 20 }) {
  const query = { patientId: userId };
  if (unread === 'true') query.isRead = false;

  const skip = (page - 1) * limit;
  const [alerts, total] = await Promise.all([
    Alert.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
    Alert.countDocuments(query),
  ]);

  return { alerts, total, page: Number(page), limit: Number(limit) };
}

export async function acknowledgeAlert(alertId, userId) {
  const alert = await Alert.findOneAndUpdate(
    { _id: alertId, patientId: userId },
    { isRead: true },
    { new: true }
  );
  if (!alert) throw Object.assign(new Error('Alert not found'), { statusCode: 404 });
  return alert;
}
