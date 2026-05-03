import { env } from '../../config/env.js';
import { logger } from '../utils/logger.js';

let firebaseApp = null;

async function getFirebaseApp() {
  if (firebaseApp) return firebaseApp;
  if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_PRIVATE_KEY || !env.FIREBASE_CLIENT_EMAIL) {
    return null;
  }
  try {
    const { default: admin } = await import('firebase-admin');
    if (!admin.apps.length) {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: env.FIREBASE_PROJECT_ID,
          privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          clientEmail: env.FIREBASE_CLIENT_EMAIL,
        }),
      });
    } else {
      firebaseApp = admin.apps[0];
    }
    return admin;
  } catch (err) {
    logger.error('Firebase init error', { error: err.message });
    return null;
  }
}

export async function sendPushNotification(fcmToken, title, body) {
  if (!fcmToken) {
    logger.info('FCM stub: no fcmToken provided');
    return;
  }
  const admin = await getFirebaseApp();
  if (!admin) {
    logger.info('FCM stub: Firebase credentials not configured', { title, body });
    return;
  }
  try {
    const result = await admin.messaging().send({ token: fcmToken, notification: { title, body } });
    logger.debug('FCM push sent', { messageId: result });
  } catch (err) {
    logger.error('FCM send error', { error: err.message });
  }
}
