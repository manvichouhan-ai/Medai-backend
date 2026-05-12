import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';
import { logger } from '../utils/logger.js';

const transporter = nodemailer.createTransport({
  host: env.EMAIL_HOST,
  port: env.EMAIL_PORT,
  secure: false, // TLS via STARTTLS on port 587
  auth: {
    user: env.EMAIL_USER,
    pass: env.EMAIL_PASS,
  },
});

export async function sendEmail(to, subject, html) {
  if (!env.EMAIL_USER || !env.EMAIL_PASS) {
    logger.info('Email stub: SMTP credentials not configured', { to, subject });
    return;
  }
  try {
    await transporter.verify();
    logger.debug('SMTP connection verified');
  } catch (err) {
    logger.error('SMTP verify failed', { error: err.message });
    return;
  }
  const from = env.FROM_EMAIL;
  logger.debug('Sending email', { from, to, subject });
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const info = await transporter.sendMail({ from, to, subject, html });
      logger.info('Email sent', {
        from,
        to,
        subject,
        messageId: info.messageId,
        response: info.response,
      });
      return;
    } catch (err) {
      if (err.code === 'ECONNRESET' && attempt === 1) {
        logger.warn('Email ECONNRESET, retrying in 2s', { to, subject });
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }
      logger.error('Email send error', { error: err.message });
      throw err;
    }
  }
}
