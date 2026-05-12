import axios from 'axios';
import { logger } from '../utils/logger.js';

export async function sendSMS(to, message) {
  if (!process.env.FAST2SMS_API_KEY) {
    logger.info('SMS stub: FAST2SMS_API_KEY not configured', { to });
    return;
  }
  const url = 'https://www.fast2sms.com/dev/bulkV2';
  const headers = { Authorization: process.env.FAST2SMS_API_KEY, 'Content-Type': 'application/json' };
  const body = { route: 'q', message, language: 'english', flash: 0, numbers: to };
  logger.info('Fast2SMS request', { url, headers, body });
  try {
    const response = await axios.post(url, body, { headers });
    logger.info('Fast2SMS response', { status: response.status, data: response.data });
  } catch (err) {
    logger.error('Fast2SMS send error', { error: err.response?.data ?? err.message });
  }
}
