import axios from 'axios';
import { logger } from '../utils/logger.js';

export async function getPatientRiskPrediction(patientId) {
  try {
    const response = await axios.get(`http://localhost:8000/api/predict/${patientId}`, { 
      timeout: 5000 
    });
    
    return {
      riskScore: response.data.riskScore,
      riskLevel: response.data.riskLevel,
      factors: response.data.factors || [],
      insight: response.data.insight || ''
    };
  } catch (err) {
    logger.warn('AI prediction service unavailable', { 
      patientId, 
      error: err.message 
    });
    
    // Fallback - never crash the cron
    return {
      riskLevel: 'medium',
      riskScore: 0.5,
      factors: [],
      insight: 'AI service unavailable - using default assessment'
    };
  }
}
