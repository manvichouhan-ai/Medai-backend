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
    await transporter.sendMail({ from: env.FROM_EMAIL, to, subject, html });
    logger.debug('Email sent', { to, subject });
  } catch (err) {
    logger.error('Email send error', { error: err.message });
  }
}
