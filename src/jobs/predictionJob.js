import cron from 'node-cron';
import User from '../../models/User.model.js';
import { getPatientRiskPrediction } from '../services/ai.service.js';
import { dispatchAlert } from '../features/notifications/notification.service.js';
import { logger } from '../utils/logger.js';

export function startPredictionJob() {
  cron.schedule('0 * * * *', async () => {
    try {
      const patients = await User.find({ role: 'patient', isActive: true }).select('_id').lean();
      let highRiskCount = 0;

      for (const patient of patients) {
        try {
          const result = await getPatientRiskPrediction(patient._id.toString());
          
          logger.info('AI prediction result', {
            patientId: patient._id,
            riskLevel: result.riskLevel,
            riskScore: result.riskScore
          });
          
          if (result.riskLevel === 'high') {
            await dispatchAlert(
              patient._id,
              'high_risk',
              `AI detected high risk of missing next dose (risk score: ${result.riskScore})`,
              'ai_prediction'
            );
            highRiskCount++;
          }
        } catch (err) {
          logger.warn('Prediction failed for patient', { patientId: patient._id, error: err.message });
        }
      }

      logger.info(`Prediction job: ${patients.length} patients checked, ${highRiskCount} high risk`);
    } catch (err) {
      logger.error('Prediction job error', { error: err.message });
    }
  });

  logger.info('Prediction job started (every 1hr)');
}
