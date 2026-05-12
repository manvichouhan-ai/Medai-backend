import axios from 'axios';
import { logger } from '../utils/logger.js';

export async function sendSMS(to, message) {
  if (!process.env.FAST2SMS_API_KEY) {
    logger.info('SMS stub: FAST2SMS_API_KEY not configured', { to });
    return;
  }
  try {
    const response = await axios.post(
      'https://www.fast2sms.com/dev/bulkV2',
      { route: 'q', message, language: 'english', numbers: to },
      {
        headers: {
          Authorization: process.env.FAST2SMS_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );
    logger.debug('SMS sent via Fast2SMS', { to, requestId: response.data?.request_id });
  } catch (err) {
    logger.error('Fast2SMS send error', { error: err.message });
  }
}
