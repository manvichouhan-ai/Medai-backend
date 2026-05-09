import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import mongoose from 'mongoose';
import User from '../../models/User.model.js';
import DoctorPatient from '../../models/DoctorPatient.model.js';
import Medication from '../../models/Medication.model.js';
import DoseLog from '../../models/DoseLog.model.js';
import Alert from '../../models/Alert.model.js';
import Intervention from '../../models/Intervention.model.js';
import * as doctorService from '../../src/features/doctor/doctor.service.js';

jest.mock('../../config/redis.js', () => ({
  redis: {
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
  },
}));

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

jest.mock('../../src/features/ai/ai.service.js', () => ({
  getRiskScore: jest.fn().mockResolvedValue({
    riskScore: 0.7,
    riskLevel: 'high',
    topFactors: ['missed_doses', 'delay_pattern'],
    insightText: 'Test risk insight',
  }),
  generateInsight: jest.fn().mockResolvedValue({
    insight: 'Test insight text',
    fromCache: false,
  }),
}));

jest.mock('../../src/features/notifications/notification.service.js', () => ({
  dispatchAlert: jest.fn().mockResolvedValue({}),
}));

describe('Doctor Service', () => {
  let doctorId, patientId, otherPatientId, adminId, medicationId, alertId;

  beforeEach(async () => {
    const doctor = await User.create({
      email: `doctor-${Date.now()}@test.com`,
      fullName: 'Test Doctor',
      role: 'doctor',
    });
    doctorId = doctor._id;

    const patient = await User.create({
      email: `patient-${Date.now()}@test.com`,
      fullName: 'Test Patient',
      role: 'patient',
    });
    patientId = patient._id;

    const otherPatient = await User.create({
      email: `other-${Date.now()}@test.com`,
      fullName: 'Other Patient',
      role: 'patient',
    });
    otherPatientId = otherPatient._id;

    const admin = await User.create({
      email: `admin-${Date.now()}@test.com`,
      fullName: 'Test Admin',
      role: 'admin',
    });
    adminId = admin._id;

    await DoctorPatient.create({
      doctorId,
      patientId,
      status: 'active',
    });

    const medication = await Medication.create({
      patientId,
      name: 'Lisinopril',
      dosage: '10mg',
      frequency: { times: ['08:00'], days: ['all'] },
      startDate: new Date(),
      prescribedBy: doctorId,
    });
    medicationId = medication._id;

    const alert = await Alert.create({
      patientId,
      triggeredBy: 'system',
      type: 'missed_dose',
      message: 'Missed dose detected',
      status: 'active',
    });
    alertId = alert._id;
  });

  afterEach(async () => {
    await DoctorPatient.deleteMany({});
    await Intervention.deleteMany({});
    await Alert.deleteMany({});
    await DoseLog.deleteMany({});
    await Medication.deleteMany({});
    await User.deleteMany({});
  });

  describe('getAssignedPatients', () => {
    it('returns assigned patients for doctor', async () => {
      const result = await doctorService.getAssignedPatients(doctorId);
      expect(result.patients).toHaveLength(1);
      expect(result.patients[0].patientId.toString()).toBe(patientId.toString());
      expect(result.patients[0].patient.fullName).toBe('Test Patient');
    });

    it('supports search by name', async () => {
      const result = await doctorService.getAssignedPatients(doctorId, { search: 'Test' });
      expect(result.patients).toHaveLength(1);
    });

    it('supports search by email', async () => {
      const result = await doctorService.getAssignedPatients(doctorId, { search: 'patient' });
      expect(result.patients).toHaveLength(1);
    });

    it('filters by risk level', async () => {
      const result = await doctorService.getAssignedPatients(doctorId, { riskLevel: 'high' });
      expect(result.patients).toHaveLength(1);
    });

    it('filters by adherence score', async () => {
      const result = await doctorService.getAssignedPatients(doctorId, { adherenceFilter: '0' });
      expect(result.patients).toHaveLength(1);
    });

    it('supports pagination', async () => {
      const result = await doctorService.getAssignedPatients(doctorId, { page: 1, limit: 10 });
      expect(result.patients.length).toBeLessThanOrEqual(10);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('returns empty array for doctor with no patients', async () => {
      const newDoctor = await User.create({
        email: `newdoctor-${Date.now()}@test.com`,
        fullName: 'New Doctor',
        role: 'doctor',
      });
      const result = await doctorService.getAssignedPatients(newDoctor._id);
      expect(result.patients).toHaveLength(0);
    });
  });

  describe('getPatientProfile', () => {
    it('returns full patient profile for assigned patient', async () => {
      const result = await doctorService.getPatientProfile(doctorId, patientId);
      expect(result.patient._id.toString()).toBe(patientId.toString());
      expect(result.patient.fullName).toBe('Test Patient');
      expect(result.medications).toBeDefined();
      expect(result.recentAlerts).toBeDefined();
      expect(result.interventions).toBeDefined();
    });

    it('throws 403 for unassigned patient', async () => {
      await expect(
        doctorService.getPatientProfile(doctorId, otherPatientId)
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('throws 404 for non-existent patient', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await expect(
        doctorService.getPatientProfile(doctorId, fakeId)
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('getPatientMedications', () => {
    it('returns medications for assigned patient', async () => {
      const result = await doctorService.getPatientMedications(doctorId, patientId);
      expect(result.medications).toHaveLength(1);
      expect(result.medications[0].name).toBe('Lisinopril');
    });

    it('filters active medications', async () => {
      await Medication.create({
        patientId,
        name: 'Inactive Med',
        dosage: '5mg',
        frequency: { times: ['12:00'], days: ['all'] },
        startDate: new Date(),
        isActive: false,
      });

      const result = await doctorService.getPatientMedications(doctorId, patientId, { active: 'true' });
      expect(result.medications).toHaveLength(1);
      expect(result.medications[0].isActive).toBe(true);
    });

    it('throws 403 for unassigned patient', async () => {
      await expect(
        doctorService.getPatientMedications(doctorId, otherPatientId)
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('supports pagination', async () => {
      const result = await doctorService.getPatientMedications(doctorId, patientId, { page: 1, limit: 10 });
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });
  });

  describe('getPatientDoseLogs', () => {
    beforeEach(async () => {
      await DoseLog.create({
        medicationId,
        patientId,
        scheduledTime: new Date(),
        status: 'taken',
      });
      await DoseLog.create({
        medicationId,
        patientId,
        scheduledTime: new Date(Date.now() - 86400000),
        status: 'missed',
      });
    });

    it('returns dose logs for assigned patient', async () => {
      const result = await doctorService.getPatientDoseLogs(doctorId, patientId);
      expect(result.logs).toHaveLength(2);
    });

    it('filters by status', async () => {
      const result = await doctorService.getPatientDoseLogs(doctorId, patientId, { status: 'missed' });
      expect(result.logs).toHaveLength(1);
      expect(result.logs[0].status).toBe('missed');
    });

    it('filters by date range', async () => {
      const fromDate = new Date(Date.now() - 86400000).toISOString();
      const result = await doctorService.getPatientDoseLogs(doctorId, patientId, { fromDate });
      expect(result.logs.length).toBeGreaterThan(0);
    });

    it('throws 403 for unassigned patient', async () => {
      await expect(
        doctorService.getPatientDoseLogs(doctorId, otherPatientId)
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('supports pagination', async () => {
      const result = await doctorService.getPatientDoseLogs(doctorId, patientId, { page: 1, limit: 1 });
      expect(result.logs.length).toBeLessThanOrEqual(1);
      expect(result.page).toBe(1);
    });
  });

  describe('getPatientAdherence', () => {
    it('returns adherence data for assigned patient', async () => {
      const result = await doctorService.getPatientAdherence(doctorId, patientId);
      expect(result.daily).toBeDefined();
      expect(result.weekly).toBeDefined();
      expect(result.monthly).toBeDefined();
      expect(result.missedDoseTrends).toBeDefined();
    });

    it('throws 403 for unassigned patient', async () => {
      await expect(
        doctorService.getPatientAdherence(doctorId, otherPatientId)
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe('getPatientRisk', () => {
    it('returns risk data for assigned patient', async () => {
      const result = await doctorService.getPatientRisk(doctorId, patientId);
      expect(result.patientId.toString()).toBe(patientId.toString());
      expect(result.riskScore).toBeDefined();
      expect(result.riskLevel).toBeDefined();
      expect(result.contributingFactors).toBeDefined();
      expect(result.generatedAt).toBeDefined();
    });

    it('throws 403 for unassigned patient', async () => {
      await expect(
        doctorService.getPatientRisk(doctorId, otherPatientId)
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe('getPatientInsights', () => {
    it('returns insights for assigned patient', async () => {
      const result = await doctorService.getPatientInsights(doctorId, patientId);
      expect(result.patientId.toString()).toBe(patientId.toString());
      expect(result.insight).toBeDefined();
      expect(result.behavioralPatterns).toBeDefined();
      expect(result.missedDosePatterns).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });

    it('throws 403 for unassigned patient', async () => {
      await expect(
        doctorService.getPatientInsights(doctorId, otherPatientId)
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe('getDoctorAlerts', () => {
    it('returns alerts for doctor\'s patients', async () => {
      const result = await doctorService.getDoctorAlerts(doctorId);
      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0]._id.toString()).toBe(alertId.toString());
    });

    it('filters unresolved alerts', async () => {
      const result = await doctorService.getDoctorAlerts(doctorId, { unresolved: 'true' });
      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0].status).toBe('active');
    });

    it('filters by severity', async () => {
      const result = await doctorService.getDoctorAlerts(doctorId, { severity: 'missed_dose' });
      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0].type).toBe('missed_dose');
    });

    it('filters by patientId', async () => {
      const result = await doctorService.getDoctorAlerts(doctorId, { patientId: patientId.toString() });
      expect(result.alerts).toHaveLength(1);
    });

    it('supports pagination', async () => {
      const result = await doctorService.getDoctorAlerts(doctorId, { page: 1, limit: 10 });
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });
  });

  describe('resolveAlert', () => {
    it('resolves alert for assigned patient', async () => {
      const result = await doctorService.resolveAlert(alertId, doctorId, {
        resolutionNotes: 'Issue resolved',
      });
      expect(result.status).toBe('resolved');
      expect(result.resolvedBy.toString()).toBe(doctorId.toString());
      expect(result.resolutionNotes).toBe('Issue resolved');
      expect(result.resolvedAt).toBeDefined();
    });

    it('throws 403 for alert not assigned to doctor', async () => {
      const otherDoctor = await User.create({
        email: `otherdoctor-${Date.now()}@test.com`,
        fullName: 'Other Doctor',
        role: 'doctor',
      });

      await expect(
        doctorService.resolveAlert(alertId, otherDoctor._id, { resolutionNotes: 'Test' })
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('throws 404 for non-existent alert', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await expect(
        doctorService.resolveAlert(fakeId, doctorId, { resolutionNotes: 'Test' })
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('escalateAlert', () => {
    it('escalates alert and increases escalation level', async () => {
      const result = await doctorService.escalateAlert(alertId, doctorId, {
        escalationNotes: 'Escalating to higher level',
      });
      expect(result.alert.escalationLevel).toBe(1);
      expect(result.alert.status).toBe('escalated');
    });

    it('creates intervention for high severity alerts', async () => {
      const highRiskAlert = await Alert.create({
        patientId,
        triggeredBy: 'ai_prediction',
        type: 'high_risk',
        message: 'High risk detected',
        status: 'active',
      });

      const result = await doctorService.escalateAlert(highRiskAlert._id, doctorId, {
        escalationNotes: 'Escalating',
      });
      expect(result.intervention).toBeDefined();
      expect(result.intervention.interventionType).toBe('high_risk_prediction');
    });

    it('throws 403 for alert not assigned to doctor', async () => {
      const otherDoctor = await User.create({
        email: `otherdoctor-${Date.now()}@test.com`,
        fullName: 'Other Doctor',
        role: 'doctor',
      });

      await expect(
        doctorService.escalateAlert(alertId, otherDoctor._id, { escalationNotes: 'Test' })
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('throws 404 for non-existent alert', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await expect(
        doctorService.escalateAlert(fakeId, doctorId, { escalationNotes: 'Test' })
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('createIntervention', () => {
    it('creates intervention for assigned patient', async () => {
      const data = {
        patientId: patientId.toString(),
        interventionType: 'medication_non_adherence',
        priority: 'high',
        reason: 'Patient missing doses',
        notes: 'Needs follow-up',
      };

      const result = await doctorService.createIntervention(doctorId, data);
      expect(result.patientId.toString()).toBe(patientId.toString());
      expect(result.createdBy.toString()).toBe(doctorId.toString());
      expect(result.interventionType).toBe('medication_non_adherence');
      expect(result.priority).toBe('high');
    });

    it('creates intervention without patientId (for doctor)', async () => {
      const data = {
        interventionType: 'emergency',
        priority: 'urgent',
        reason: 'Emergency intervention',
      };

      const result = await doctorService.createIntervention(doctorId, data);
      expect(result.interventionType).toBe('emergency');
      expect(result.priority).toBe('urgent');
    });

    it('throws 403 for unassigned patient', async () => {
      const data = {
        patientId: otherPatientId.toString(),
        interventionType: 'medication_non_adherence',
        reason: 'Test',
      };

      await expect(
        doctorService.createIntervention(doctorId, data)
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('links related alerts to intervention', async () => {
      const data = {
        patientId: patientId.toString(),
        interventionType: 'medication_non_adherence',
        reason: 'Test',
        relatedAlertIds: [alertId.toString()],
      };

      const result = await doctorService.createIntervention(doctorId, data);
      expect(result).toBeDefined();

      const updatedAlert = await Alert.findById(alertId);
      expect(updatedAlert.relatedInterventionId.toString()).toBe(result._id.toString());
      expect(updatedAlert.status).toBe('escalated');
    });
  });

  describe('getPatientInterventions', () => {
    beforeEach(async () => {
      await Intervention.create([
        {
          patientId,
          createdBy: doctorId,
          interventionType: 'medication_non_adherence',
          status: 'pending',
          priority: 'medium',
          reason: 'Test 1',
        },
        {
          patientId,
          createdBy: doctorId,
          interventionType: 'high_risk_prediction',
          status: 'in_progress',
          priority: 'high',
          reason: 'Test 2',
        },
      ]);
    });

    it('returns interventions for assigned patient', async () => {
      const result = await doctorService.getPatientInterventions(doctorId, patientId);
      expect(result.interventions).toHaveLength(2);
    });

    it('filters by status', async () => {
      const result = await doctorService.getPatientInterventions(doctorId, patientId, { status: 'pending' });
      expect(result.interventions).toHaveLength(1);
      expect(result.interventions[0].status).toBe('pending');
    });

    it('throws 403 for unassigned patient', async () => {
      await expect(
        doctorService.getPatientInterventions(doctorId, otherPatientId)
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('supports pagination', async () => {
      const result = await doctorService.getPatientInterventions(doctorId, patientId, { page: 1, limit: 1 });
      expect(result.interventions).toHaveLength(1);
      expect(result.total).toBe(2);
    });
  });

  describe('RBAC - Unauthorized Access', () => {
    it('caregiver cannot access doctor endpoints', async () => {
      const caregiver = await User.create({
        email: `caregiver-${Date.now()}@test.com`,
        fullName: 'Test Caregiver',
        role: 'caregiver',
      });

      await expect(
        doctorService.getPatientProfile(caregiver._id, patientId)
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('patient cannot access doctor endpoints', async () => {
      await expect(
        doctorService.getPatientProfile(patientId, patientId)
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });
});