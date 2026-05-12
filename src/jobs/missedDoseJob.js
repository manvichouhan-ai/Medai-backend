import cron from 'node-cron';
import DoseLog from '../../models/DoseLog.model.js';
import { dispatchAlert } from '../features/notifications/notification.service.js';
import { logger } from '../utils/logger.js';

function formatTimeIST(date) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export function startMissedDoseJob() {
  cron.schedule('*/5 * * * *', async () => {
    try {
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
        if (!patientGroups[pid]) patientGroups[pid] = { medNames: [], scheduledTime: log.scheduledTime };
        patientGroups[pid].medNames.push(log.medicationId?.name || 'medication');
      }

      for (const [patientId, { medNames, scheduledTime }] of Object.entries(patientGroups)) {
        const uniqueMeds = [...new Set(medNames)];
        const timeIST = formatTimeIST(scheduledTime);
        await dispatchAlert(
          patientId,
          'missed_dose',
          `${uniqueMeds.join(', ')} dose scheduled at ${timeIST}`,
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
