import { logger } from '../utils/logger.js';

export async function sendSMS(to, message) {
  // Stub implementation - Twilio credentials not configured
  logger.info('SMS stub: Twilio credentials not configured', { to, message });
  return;
}
