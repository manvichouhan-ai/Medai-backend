import Groq from 'groq-sdk';
import axios from 'axios';
import { redis } from '../../../config/redis.js';
import { env } from '../../../config/env.js';
import { computePatientFeatures } from '../../adherence/adherence.service.js';
import { logger } from '../../utils/logger.js';

const INSIGHT_CACHE_TTL = 6 * 60 * 60;

let groqClient = null;

function getGroqClient() {
  if (groqClient) return groqClient;
  if (!env.GROQ_API_KEY) return null;
  groqClient = new Groq({ apiKey: env.GROQ_API_KEY });
  return groqClient;
}

export async function getRiskScore(patientId) {
  try {
    const response = await axios.get(`${env.PYTHON_AI_URL}/predict/${patientId}`, { timeout: 5000 });
    return response.data;
  } catch (err) {
    logger.warn('Python AI service unavailable for risk score', { error: err.message });
    return {
      riskScore: 0.5,
      riskLevel: 'medium',
      topFactors: [],
      insightText: 'AI service unavailable — using default risk assessment',
    };
  }
}

export async function generateInsight(patientId) {
  const cacheKey = `insight:${patientId}`;
  const cached = await redis.get(cacheKey).catch(() => null);
  if (cached) return { insight: cached, fromCache: true };

  const features = await computePatientFeatures(patientId);

  let insightText;
  const client = getGroqClient();

  if (client) {
    try {
      const response = await client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 200,
        messages: [
          {
            role: 'system',
            content: 'You are MedAI, a friendly healthcare assistant. Be warm, brief, non-alarming.',
          },
          {
            role: 'user',
            content: `Patient adherence data: ${JSON.stringify(features)}. Write 2 sentences of insight and 1 actionable suggestion.`,
          },
        ],
      });
      insightText = response.choices[0]?.message?.content || 'Keep up the great work with your medications!';
    } catch (err) {
      logger.error('Groq API error', { error: err.message });
      insightText = buildFallbackInsight(features);
    }
  } else {
    logger.info('Groq API key not set — using fallback insight');
    insightText = buildFallbackInsight(features);
  }

  await redis.set(cacheKey, insightText, 'EX', INSIGHT_CACHE_TTL).catch(() => null);

  return { insight: insightText, fromCache: false };
}

function buildFallbackInsight(features) {
  const adherence = features.adherence30d || 0;
  if (adherence >= 90) {
    return `Excellent work! Your ${adherence}% adherence over the past 30 days shows great commitment to your health. Keep maintaining this routine — consistency is key to the best outcomes.`;
  } else if (adherence >= 70) {
    return `You're doing well with a ${adherence}% adherence rate. A small improvement could make a big difference. Try setting a daily alarm at your usual medication times to stay on track.`;
  } else {
    return `Your adherence is at ${adherence}% this month — there's room to improve. Consider using the reminder feature and asking a caregiver to help keep you accountable.`;
  }
}

export async function runBatchPredictions() {
  try {
    const response = await axios.post(`${env.PYTHON_AI_URL}/predict/batch`, {}, { timeout: 30000 });
    return response.data;
  } catch (err) {
    logger.warn('Python AI batch prediction failed', { error: err.message });
    return { status: 'failed', error: err.message };
  }
}
