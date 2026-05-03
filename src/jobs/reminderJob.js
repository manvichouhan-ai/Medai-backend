import cron from 'node-cron';
import DoseLog from '../../models/DoseLog.model.js';
import { sendUserPushNotification } from '../features/notifications/notification.service.js';
import { getIO } from '../socket/index.js';
import { logger } from '../utils/logger.js';

export function startReminderJob() {
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const windowEnd = new Date(now.getTime() + 15 * 60 * 1000);

      const upcomingLogs = await DoseLog.find({
        scheduledTime: { $gte: now, $lte: windowEnd },
        status: 'pending',
      })
        .populate('medicationId', 'name')
        .lean();

      for (const log of upcomingLogs) {
        const medName = log.medicationId?.name || 'your medication';
        await sendUserPushNotification(
          log.patientId,
          'Medication Reminder',
          `Time to take ${medName}`
        );

        try {
          const io = getIO();
          io.to(log.patientId.toString()).emit('dose_reminder', {
            logId: log._id,
            medicationName: medName,
            scheduledTime: log.scheduledTime,
          });
        } catch {
        }
      }

      if (upcomingLogs.length > 0) {
        logger.debug(`Reminder job: ${upcomingLogs.length} upcoming doses notified`);
      }
    } catch (err) {
      logger.error('Reminder job error', { error: err.message });
    }
  });

  logger.info('Reminder job started (every 60s)');
}
