import { startOfDay, endOfDay, subDays, format } from 'date-fns';
import DoctorPatient from '../../../models/DoctorPatient.model.js';
import User from '../../../models/User.model.js';
import CaregiverPatient from '../../../models/CaregiverPatient.model.js';
import Alert from '../../../models/Alert.model.js';
import Medication from '../../../models/Medication.model.js';
import DoseLog from '../../../models/DoseLog.model.js';
import { getRiskScore } from '../ai/ai.service.js';
import { logger } from '../../utils/logger.js';

/**
 * Get dashboard overview metrics for a doctor
 */
async function getOverviewMetrics(doctorId) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const thirtyDaysAgo = subDays(now, 30);

  const [
    totalPatients,
    activeCaregivers,
    criticalAlerts,
    adherenceData,
    missedDosesToday,
  ] = await Promise.all([
    // Count total patients (created by OR assigned to doctor)
    User.countDocuments({
      $or: [
        { createdByDoctor: doctorId, role: 'patient' },
        { _id: { $in: await DoctorPatient.find({ doctorId, status: 'active' }).distinct('patientId') } },
      ],
      role: 'patient',
      isActive: true,
    }),

    // Count active caregivers (linked through CaregiverPatient)
    CaregiverPatient.distinct('caregiverId', {
      doctorId,
      status: 'active',
    }).then((ids) => User.countDocuments({ _id: { $in: ids }, role: 'caregiver', isActive: true })),

    // Count critical unresolved alerts
    Alert.countDocuments({
      patientId: { $in: await DoctorPatient.find({ doctorId, status: 'active' }).distinct('patientId') },
      severity: { $in: ['high', 'critical'] },
      status: 'active',
    }),

    // Calculate average adherence using aggregation
    getAverageAdherence(doctorId, thirtyDaysAgo),

    // Count missed doses today
    DoseLog.countDocuments({
      patientId: { $in: await DoctorPatient.find({ doctorId, status: 'active' }).distinct('patientId') },
      status: 'missed',
      scheduledTime: { $gte: todayStart, $lte: todayEnd },
    }),
  ]);

  return {
    totalPatients,
    activeCaregivers,
    criticalAlerts,
    averageAdherence: Math.round(adherenceData),
    missedDosesToday,
  };
}

/**
 * Calculate average adherence across all doctor patients
 */
async function getAverageAdherence(doctorId, startDate) {
  const patientIds = await DoctorPatient.find({ doctorId, status: 'active' }).distinct('patientId');

  if (patientIds.length === 0) return 0;

  const result = await DoseLog.aggregate([
    {
      $match: {
        patientId: { $in: patientIds },
        scheduledTime: { $gte: startDate },
        status: { $in: ['taken', 'delayed', 'missed'] },
      },
    },
    {
      $group: {
        _id: null,
        totalDoses: { $sum: 1 },
        completedDoses: {
          $sum: {
            $cond: [
              { $in: ['$status', ['taken', 'delayed']] },
              1,
              0,
            ],
          },
        },
      },
    },
    {
      $project: {
        adherenceRate: {
          $cond: [
            { $eq: ['$totalDoses', 0] },
            0,
            { $multiply: [{ $divide: ['$completedDoses', '$totalDoses'] }, 100] },
          ],
        },
      },
    },
  ]);

  return result[0]?.adherenceRate || 0;
}

/**
 * Get high-risk patients (top 5)
 */
async function getHighRiskPatients(doctorId) {
  const patientIds = await DoctorPatient.find({ doctorId, status: 'active' }).distinct('patientId');

  if (patientIds.length === 0) return [];

  const thirtyDaysAgo = subDays(new Date(), 30);

  // Get patient metrics using aggregation
  const patientMetrics = await DoseLog.aggregate([
    {
      $match: {
        patientId: { $in: patientIds },
        scheduledTime: { $gte: thirtyDaysAgo },
        status: { $in: ['taken', 'delayed', 'missed'] },
      },
    },
    {
      $group: {
        _id: '$patientId',
        totalDoses: { $sum: 1 },
        completedDoses: {
          $sum: {
            $cond: [
              { $in: ['$status', ['taken', 'delayed']] },
              1,
              0,
            ],
          },
        },
        missedDoses: {
          $sum: {
            $cond: [{ $eq: ['$status', 'missed'] }, 1, 0],
          },
        },
        lastMissedDose: {
          $max: {
            $cond: [{ $eq: ['$status', 'missed'] }, '$scheduledTime', null],
          },
        },
      },
    },
    {
      $project: {
        patientId: '$_id',
        adherenceRate: {
          $cond: [
            { $eq: ['$totalDoses', 0] },
            0,
            { $multiply: [{ $divide: ['$completedDoses', '$totalDoses'] }, 100] },
          ],
        },
        missedDoses: 1,
        lastMissedDose: 1,
      },
    },
  ]);

  // Get patients with their basic info
  const patients = await User.find(
    { _id: { $in: patientIds }, role: 'patient', isActive: true },
    { _id: 1, fullName: 1 }
  ).lean();

  const patientMap = new Map(patients.map((p) => [p._id.toString(), p]));

  // Get unresolved alert counts per patient
  const alertCounts = await Alert.aggregate([
    {
      $match: {
        patientId: { $in: patientIds },
        status: 'active',
      },
    },
    {
      $group: {
        _id: '$patientId',
        alertCount: { $sum: 1 },
      },
    },
  ]);

  const alertMap = new Map(alertCounts.map((a) => [a._id.toString(), a.alertCount]));

  // Combine metrics and try to get AI risk scores
  const patientsWithRisk = await Promise.all(
    patientMetrics.map(async (metric) => {
      const patient = patientMap.get(metric.patientId.toString());
      if (!patient) return null;

      let riskScore = 0;
      let riskLevel = 'low';

      try {
        const aiRisk = await getRiskScore(metric.patientId);
        riskScore = aiRisk.riskScore || 0;
        riskLevel = aiRisk.riskLevel || 'low';
      } catch (error) {
        // Fallback heuristic
        riskScore = calculateFallbackRiskScore(metric, alertMap.get(metric.patientId.toString()) || 0);
        riskLevel = riskScore >= 70 ? 'high' : riskScore >= 40 ? 'medium' : 'low';
      }

      return {
        id: patient._id,
        name: patient.fullName,
        riskScore: Math.round(riskScore),
        riskLevel,
        adherenceRate: Math.round(metric.adherenceRate),
        lastMissedDose: metric.lastMissedDose || null,
      };
    })
  );

  // Filter nulls and sort by risk score descending
  return patientsWithRisk
    .filter(Boolean)
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 5);
}

/**
 * Calculate fallback risk score when AI service is unavailable
 */
function calculateFallbackRiskScore(metrics, alertCount) {
  let score = 0;

  // Low adherence contributes to risk
  if (metrics.adherenceRate < 70) score += 30;
  if (metrics.adherenceRate < 50) score += 20;

  // Multiple missed doses contribute to risk
  if (metrics.missedDoses > 5) score += 20;
  if (metrics.missedDoses > 10) score += 15;

  // Unresolved alerts contribute to risk
  if (alertCount > 0) score += 15;
  if (alertCount > 3) score += 10;

  return Math.min(score, 100);
}

/**
 * Get recent unresolved alerts
 */
async function getRecentAlerts(doctorId) {
  const patientIds = await DoctorPatient.find({ doctorId, status: 'active' }).distinct('patientId');

  if (patientIds.length === 0) return [];

  const alerts = await Alert.aggregate([
    {
      $match: {
        patientId: { $in: patientIds },
        status: 'active',
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'patientId',
        foreignField: '_id',
        as: 'patient',
      },
    },
    {
      $unwind: '$patient',
    },
    {
      $project: {
        id: '$_id',
        type: 1,
        severity: 1,
        patientName: '$patient.fullName',
        createdAt: 1,
        resolved: { $eq: ['$status', 'resolved'] },
      },
    },
    {
      $sort: { createdAt: -1 },
    },
    {
      $limit: 5,
    },
  ]);

  return alerts;
}

/**
 * Get today's medication schedules
 */
async function getTodaySchedules(doctorId) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const patientIds = await DoctorPatient.find({ doctorId, status: 'active' }).distinct('patientId');

  if (patientIds.length === 0) return [];

  const schedules = await DoseLog.aggregate([
    {
      $match: {
        patientId: { $in: patientIds },
        scheduledTime: { $gte: todayStart, $lte: todayEnd },
        status: 'pending',
      },
    },
    {
      $lookup: {
        from: 'medications',
        localField: 'medicationId',
        foreignField: '_id',
        as: 'medication',
      },
    },
    {
      $unwind: '$medication',
    },
    {
      $lookup: {
        from: 'users',
        localField: 'patientId',
        foreignField: '_id',
        as: 'patient',
      },
    },
    {
      $unwind: '$patient',
    },
    {
      $project: {
        patientId: 1,
        patientName: '$patient.fullName',
        medicationName: '$medication.name',
        scheduledTime: 1,
        status: 1,
      },
    },
    {
      $sort: { scheduledTime: 1 },
    },
  ]);

  // Format time as HH:MM
  return schedules.map((schedule) => ({
    ...schedule,
    scheduledTime: format(schedule.scheduledTime, 'HH:mm'),
  }));
}

/**
 * Get weekly adherence trend (last 7 days)
 */
async function getWeeklyAdherenceTrend(doctorId) {
  const patientIds = await DoctorPatient.find({ doctorId, status: 'active' }).distinct('patientId');

  if (patientIds.length === 0) return [];

  const sevenDaysAgo = subDays(new Date(), 7);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const trend = await DoseLog.aggregate([
    {
      $match: {
        patientId: { $in: patientIds },
        scheduledTime: { $gte: sevenDaysAgo },
        status: { $in: ['taken', 'delayed', 'missed'] },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$scheduledTime' },
        },
        totalDoses: { $sum: 1 },
        completedDoses: {
          $sum: {
            $cond: [
              { $in: ['$status', ['taken', 'delayed']] },
              1,
              0,
            ],
          },
        },
      },
    },
    {
      $project: {
        date: '$_id',
        adherenceRate: {
          $cond: [
            { $eq: ['$totalDoses', 0] },
            0,
            { $multiply: [{ $divide: ['$completedDoses', '$totalDoses'] }, 100] },
          ],
        },
      },
    },
    {
      $sort: { date: 1 },
    },
  ]);

  // Map to day names and fill missing days with 0
  const result = [];
  for (let i = 6; i >= 0; i--) {
    const date = subDays(new Date(), i);
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayName = dayNames[date.getDay()];
    const dayData = trend.find((t) => t.date === dateStr);

    result.push({
      day: dayName,
      rate: dayData ? Math.round(dayData.adherenceRate) : 0,
    });
  }

  return result;
}

/**
 * Get monthly adherence trend (last 30 days grouped by week)
 */
async function getMonthlyAdherenceTrend(doctorId) {
  const patientIds = await DoctorPatient.find({ doctorId, status: 'active' }).distinct('patientId');

  if (patientIds.length === 0) return [];

  const thirtyDaysAgo = subDays(new Date(), 30);

  const trend = await DoseLog.aggregate([
    {
      $match: {
        patientId: { $in: patientIds },
        scheduledTime: { $gte: thirtyDaysAgo },
        status: { $in: ['taken', 'delayed', 'missed'] },
      },
    },
    {
      $group: {
        _id: {
          week: { $isoWeek: '$scheduledTime' },
          year: { $year: '$scheduledTime' },
        },
        totalDoses: { $sum: 1 },
        completedDoses: {
          $sum: {
            $cond: [
              { $in: ['$status', ['taken', 'delayed']] },
              1,
              0,
            ],
          },
        },
      },
    },
    {
      $project: {
        week: '$_id.week',
        year: '$_id.year',
        adherenceRate: {
          $cond: [
            { $eq: ['$totalDoses', 0] },
            0,
            { $multiply: [{ $divide: ['$completedDoses', '$totalDoses'] }, 100] },
          ],
        },
      },
    },
    {
      $sort: { year: 1, week: 1 },
    },
  ]);

  // Map to week labels
  const now = new Date();
  let weekNum = 1;
  const currentWeek = getISOWeek(now);

  return trend.map((t) => ({
    week: `Week ${weekNum++}`,
    rate: Math.round(t.adherenceRate),
  }));
}

/**
 * Get ISO week number
 */
function getISOWeek(date) {
  const tempDate = new Date(date.valueOf());
  tempDate.setHours(0, 0, 0, 0);
  tempDate.setDate(tempDate.getDate() + 4 - (tempDate.getDay() || 7));
  const yearStart = new Date(tempDate.getFullYear(), 0, 1);
  return Math.ceil((((tempDate - yearStart) / 86400000) + 1) / 7);
}

/**
 * Main dashboard function
 */
export async function getDoctorDashboard(doctorId) {
  try {
    const [overview, highRiskPatients, recentAlerts, todaySchedules, weeklyTrend, monthlyTrend] =
      await Promise.all([
        getOverviewMetrics(doctorId),
        getHighRiskPatients(doctorId),
        getRecentAlerts(doctorId),
        getTodaySchedules(doctorId),
        getWeeklyAdherenceTrend(doctorId),
        getMonthlyAdherenceTrend(doctorId),
      ]);

    return {
      overview,
      highRiskPatients,
      recentAlerts,
      todaySchedules,
      adherenceTrend: {
        weekly: weeklyTrend,
        monthly: monthlyTrend,
      },
    };
  } catch (error) {
    logger.error('Dashboard data fetch failed', { error: error.message, doctorId });
    throw error;
  }
}