import cron from 'node-cron';
import DoseLog from '../../models/DoseLog.model.js';
import { dispatchAlert } from '../features/notifications/notification.service.js';
import { logger } from '../utils/logger.js';

export function startMissedDoseJob() {
  cron.schedule('*/5 * * * *', async () => {
    try {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const graceCutoff = new Date(Date.now() - 10 * 60 * 1000);

      const overdueLogs = await DoseLog.find({
        scheduledTime: { $lt: graceCutoff },
        status: 'pending',
      })
        .populate('medicationId', 'name')
        .lean();

      if (!overdueLogs.length) return;

      const ids = overdueLogs.map((l) => l._id);
      await DoseLog.updateMany({ _id: { $in: ids } }, { status: 'missed' });

      const patientGroups = {};
      for (const log of overdueLogs) {
        const pid = log.patientId.toString();
        if (!patientGroups[pid]) patientGroups[pid] = [];
        patientGroups[pid].push(log.medicationId?.name || 'medication');
      }

      for (const [patientId, medNames] of Object.entries(patientGroups)) {
        const uniqueMeds = [...new Set(medNames)];
        await dispatchAlert(
          patientId,
          'missed_dose',
          `Missed dose of ${uniqueMeds.join(', ')}`,
          'system'
        );
      }

      logger.info(`Missed dose job: marked ${overdueLogs.length} doses as missed`);
    } catch (err) {
      logger.error('Missed dose job error', { error: err.message });
    }
  });

  logger.info('Missed dose job started (every 5min)');
}
