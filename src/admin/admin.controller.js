import { startOfDay } from 'date-fns';
import User from '../../models/User.model.js';
import Medication from '../../models/Medication.model.js';
import DoseLog from '../../models/DoseLog.model.js';
import Alert from '../../models/Alert.model.js';
import { sendSuccess } from '../utils/response.utils.js';
import { computeAdherenceRate } from '../utils/adherence.utils.js';

export async function getMetrics(req, res, next) {
  try {
    const todayStart = startOfDay(new Date());

    const [
      totalUsers,
      totalPatients,
      activeMedications,
      alertsToday,
      recentLogs,
    ] = await Promise.all([
      User.countDocuments({ isActive: true }),
      User.countDocuments({ role: 'patient', isActive: true }),
      Medication.countDocuments({ isActive: true }),
      Alert.countDocuments({ createdAt: { $gte: todayStart } }),
      DoseLog.find({ scheduledTime: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } })
        .select('status')
        .lean(),
    ]);

    const avgAdherence = computeAdherenceRate(recentLogs);

    return sendSuccess(res, {
      totalUsers,
      totalPatients,
      avgAdherence,
      alertsToday,
      activeMedications,
    });
  } catch (err) {
    next(err);
  }
}
