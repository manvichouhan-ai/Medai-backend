import { createServer } from 'http';
import app from './app.js';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { connectRedis } from './config/redis.js';
import { initSocket } from './src/socket/index.js';
import { startReminderJob } from './src/jobs/reminderJob.js';
import { startMissedDoseJob } from './src/jobs/missedDoseJob.js';
import { startPredictionJob } from './src/jobs/predictionJob.js';
import { logger } from './src/utils/logger.js';

const httpServer = createServer(app);
initSocket(httpServer);

async function start() {
  try {
    await connectDB();
    await connectRedis();

    startReminderJob();
    startMissedDoseJob();
    startPredictionJob();

    httpServer.listen(env.PORT, () => {
      logger.info(`MedAI server running on port ${env.PORT} [${env.NODE_ENV}]`);
    });
  } catch (err) {
    logger.error('Failed to start server', { error: err.message });
    process.exit(1);
  }
}

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled rejection', { error: err.message });
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  httpServer.close(() => process.exit(0));
});

start();
