import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import mongoose from 'mongoose';
import User from '../../models/User.model.js';
import Intervention from '../../models/Intervention.model.js';
import Alert from '../../models/Alert.model.js';
import DoseLog from '../../models/DoseLog.model.js';
import CaregiverPatient from '../../models/CaregiverPatient.model.js';
import Medication from '../../models/Medication.model.js';
import * as interventionService from '../../src/features/interventions/intervention.service.js';

jest.mock('../../config/redis.js', () => ({
  redis: {
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
  },
}));

jest.mock('../../src/features/notifications/notification.service.js', () => ({
  dispatchAlert: jest.fn().mockResolvedValue({}),
}));

describe('Intervention Service', () => {
  let patientId, caregiverId, doctorId, adminId, medicationId;

  beforeEach(async () => {
    const patient = await User.create({
      email: `patient-${Date.now()}@test.com`,
      fullName: 'Test Patient',
      role: 'patient',
    });
    patientId = patient._id;

    const caregiver = await User.create({
      email: `caregiver-${Date.now()}@test.com`,
      fullName: 'Test Caregiver',
      role: 'caregiver',
    });
    caregiverId = caregiver._id;

    const doctor = await User.create({
      email: `doctor-${Date.now()}@test.com`,
      fullName: 'Test Doctor',
      role: 'doctor',
    });
    doctorId = doctor._id;

    const admin = await User.create({
      email: `admin-${Date.now()}@test.com`,
      fullName: 'Test Admin',
      role: 'admin',
    });
    adminId = admin._id;

    await CaregiverPatient.create({
      caregiverId,
      patientId,
      relationship: 'family',
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
  });

  afterEach(async () => {
    await Intervention.deleteMany({});
    await Alert.deleteMany({});
    await DoseLog.deleteMany({});
    await Medication.deleteMany({});
    await CaregiverPatient.deleteMany({});
    await User.deleteMany({});
  });

  describe('createIntervention', () => {
    it('caregiver creates intervention for assigned patient', async () => {
      const data = {
        patientId: patientId.toString(),
        interventionType: 'caregiver_request',
        priority: 'medium',
        reason: 'Patient needs medication review',
        notes: 'Follow up required',
      };

      const intervention = await interventionService.createIntervention(
        caregiverId,
        'caregiver',
        data
      );

      expect(intervention.patientId.toString()).toBe(patientId.toString());
      expect(intervention.createdBy.toString()).toBe(caregiverId.toString());
      expect(intervention.interventionType).toBe('caregiver_request');
      expect(intervention.status).toBe('pending');
    });

    it('doctor creates intervention', async () => {
      const data = {
        interventionType: 'medication_non_adherence',
        priority: 'high',
        reason: 'Chronic non-adherence detected',
      };

      const intervention = await interventionService.createIntervention(doctorId, 'doctor', data);

      expect(intervention.interventionType).toBe('medication_non_adherence');
      expect(intervention.priority).toBe('high');
    });

    it('caregiver cannot create intervention without patientId', async () => {
      const data = {
        interventionType: 'caregiver_request',
        reason: 'Test',
      };

      await expect(
        interventionService.createIntervention(caregiverId, 'caregiver', data)
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('caregiver cannot create intervention for unassigned patient', async () => {
      const otherPatient = await User.create({
        email: `other-${Date.now()}@test.com`,
        fullName: 'Other Patient',
        role: 'patient',
      });

      const data = {
        patientId: otherPatient._id.toString(),
        interventionType: 'caregiver_request',
        reason: 'Test',
      };

      await expect(
        interventionService.createIntervention(caregiverId, 'caregiver', data)
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('links related alerts to intervention', async () => {
      const alert = await Alert.create({
        patientId,
        triggeredBy: 'system',
        type: 'missed_dose',
        message: 'Missed dose',
      });

      const data = {
        interventionType: 'medication_non_adherence',
        reason: 'Test',
        relatedAlertIds: [alert._id.toString()],
      };

      const intervention = await interventionService.createIntervention(doctorId, 'doctor', data);

      const updatedAlert = await Alert.findById(alert._id);
      expect(updatedAlert.relatedInterventionId.toString()).toBe(intervention._id.toString());
      expect(updatedAlert.status).toBe('escalated');
    });
  });

  describe('getInterventions', () => {
    beforeEach(async () => {
      await Intervention.create([
        {
          patientId,
          createdBy: caregiverId,
          interventionType: 'caregiver_request',
          status: 'pending',
          priority: 'medium',
          reason: 'Test 1',
        },
        {
          patientId,
          createdBy: caregiverId,
          interventionType: 'medication_non_adherence',
          status: 'in_progress',
          priority: 'high',
          reason: 'Test 2',
        },
      ]);
    });

    it('caregiver sees interventions for assigned patients', async () => {
      const result = await interventionService.getInterventions(caregiverId, 'caregiver');
      expect(result.interventions).toHaveLength(2);
    });

    it('doctor can filter by status', async () => {
      const result = await interventionService.getInterventions(doctorId, 'doctor', { status: 'pending' });
      expect(result.interventions).toHaveLength(1);
      expect(result.interventions[0].status).toBe('pending');
    });

    it('doctor can filter by priority', async () => {
      const result = await interventionService.getInterventions(doctorId, 'doctor', { priority: 'high' });
      expect(result.interventions).toHaveLength(1);
      expect(result.interventions[0].priority).toBe('high');
    });

    it('supports pagination', async () => {
      const result = await interventionService.getInterventions(doctorId, 'doctor', { page: 1, limit: 1 });
      expect(result.interventions).toHaveLength(1);
      expect(result.total).toBe(2);
    });
  });

  describe('getInterventionById', () => {
    let interventionId;

    beforeEach(async () => {
      const intervention = await Intervention.create({
        patientId,
        createdBy: caregiverId,
        interventionType: 'caregiver_request',
        status: 'pending',
        reason: 'Test',
      });
      interventionId = intervention._id;
    });

    it('caregiver can view intervention for assigned patient', async () => {
      const intervention = await interventionService.getInterventionById(
        interventionId,
        caregiverId,
        'caregiver'
      );
      expect(intervention._id.toString()).toBe(interventionId.toString());
    });

    it('caregiver cannot view intervention for unassigned patient', async () => {
      const otherCaregiver = await User.create({
        email: `other-${Date.now()}@test.com`,
        fullName: 'Other Caregiver',
        role: 'caregiver',
      });

      await expect(
        interventionService.getInterventionById(interventionId, otherCaregiver._id, 'caregiver')
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('returns 404 for non-existent intervention', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await expect(
        interventionService.getInterventionById(fakeId, doctorId, 'doctor')
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('updateIntervention', () => {
    let interventionId;

    beforeEach(async () => {
      const intervention = await Intervention.create({
        patientId,
        createdBy: caregiverId,
        interventionType: 'caregiver_request',
        status: 'pending',
        reason: 'Test',
      });
      interventionId = intervention._id;
    });

    it('caregiver can update intervention for assigned patient', async () => {
      const data = { status: 'in_progress', notes: 'Working on it' };
      const intervention = await interventionService.updateIntervention(
        interventionId,
        caregiverId,
        'caregiver',
        data
      );

      expect(intervention.status).toBe('in_progress');
      expect(intervention.notes).toBe('Working on it');
    });

    it('caregiver cannot resolve urgent intervention', async () => {
      await Intervention.findByIdAndUpdate(interventionId, { priority: 'urgent' });

      await expect(
        interventionService.updateIntervention(interventionId, caregiverId, 'caregiver', {
          status: 'resolved',
        })
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('doctor can resolve urgent intervention', async () => {
      await Intervention.findByIdAndUpdate(interventionId, { priority: 'urgent' });

      const intervention = await interventionService.updateIntervention(interventionId, doctorId, 'doctor', {
        status: 'resolved',
      });

      expect(intervention.status).toBe('resolved');
    });
  });

  describe('resolveIntervention', () => {
    let interventionId, alertId;

    beforeEach(async () => {
      const alert = await Alert.create({
        patientId,
        triggeredBy: 'system',
        type: 'missed_dose',
        message: 'Missed dose',
      });
      alertId = alert._id;

      const intervention = await Intervention.create({
        patientId,
        createdBy: caregiverId,
        interventionType: 'caregiver_request',
        status: 'pending',
        reason: 'Test',
        relatedAlertIds: [alertId],
      });
      interventionId = intervention._id;
    });

    it('resolves intervention and linked alerts', async () => {
      const data = { resolutionNotes: 'Issue resolved' };
      const intervention = await interventionService.resolveIntervention(
        interventionId,
        doctorId,
        data
      );

      expect(intervention.status).toBe('resolved');
      expect(intervention.resolvedBy.toString()).toBe(doctorId.toString());
      expect(intervention.resolvedAt).toBeDefined();

      const alert = await Alert.findById(alertId);
      expect(alert.status).toBe('resolved');
      expect(alert.resolvedBy.toString()).toBe(doctorId.toString());
    });

    it('caregiver cannot resolve urgent intervention', async () => {
      await Intervention.findByIdAndUpdate(interventionId, { priority: 'urgent' });

      await expect(
        interventionService.resolveIntervention(interventionId, caregiverId, {
          resolutionNotes: 'Test',
        })
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe('escalateAlert', () => {
    let alertId;

    beforeEach(async () => {
      const alert = await Alert.create({
        patientId,
        triggeredBy: 'system',
        type: 'high_risk',
        message: 'High risk detected',
      });
      alertId = alert._id;
    });

    it('escalates alert and creates intervention', async () => {
      const data = {
        escalateTo: doctorId.toString(),
        escalationReason: 'Requires clinical review',
        notes: 'Escalating to doctor',
      };

      const result = await interventionService.escalateAlert(alertId, caregiverId, data);

      expect(result.alert.escalationLevel).toBe(1);
      expect(result.alert.status).toBe('escalated');
      expect(result.intervention.interventionType).toBe('emergency');
      expect(result.intervention.assignedTo.toString()).toBe(doctorId.toString());
    });

    it('increments escalation level on subsequent escalations', async () => {
      await Alert.findByIdAndUpdate(alertId, { escalationLevel: 1 });

      const data = {
        escalateTo: doctorId.toString(),
        escalationReason: 'Still requires review',
      };

      const result = await interventionService.escalateAlert(alertId, caregiverId, data);

      expect(result.alert.escalationLevel).toBe(2);
      expect(result.intervention.priority).toBe('urgent');
    });

    it('returns 404 for non-existent alert', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      await expect(
        interventionService.escalateAlert(fakeId, caregiverId, {
          escalateTo: doctorId.toString(),
          escalationReason: 'Test',
        })
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('resolveAlert', () => {
    let alertId, interventionId;

    beforeEach(async () => {
      const intervention = await Intervention.create({
        patientId,
        createdBy: caregiverId,
        interventionType: 'caregiver_request',
        status: 'pending',
        reason: 'Test',
      });
      interventionId = intervention._id;

      const alert = await Alert.create({
        patientId,
        triggeredBy: 'system',
        type: 'missed_dose',
        message: 'Missed dose',
        relatedInterventionId: interventionId,
      });
      alertId = alert._id;
    });

    it('resolves alert and linked intervention', async () => {
      const data = { resolutionNotes: 'Alert resolved' };
      const alert = await interventionService.resolveAlert(alertId, doctorId, data);

      expect(alert.status).toBe('resolved');
      expect(alert.resolvedBy.toString()).toBe(doctorId.toString());

      const intervention = await Intervention.findById(interventionId);
      expect(intervention.status).toBe('resolved');
    });

    it('resolves alert without linked intervention', async () => {
      await Alert.findByIdAndUpdate(alertId, { relatedInterventionId: null });

      const data = { resolutionNotes: 'Alert resolved' };
      const alert = await interventionService.resolveAlert(alertId, doctorId, data);

      expect(alert.status).toBe('resolved');
    });
  });

  describe('checkForRepeatedDisputes', () => {
    beforeEach(async () => {
      const now = new Date();
      await DoseLog.create([
        {
          medicationId,
          patientId,
          scheduledTime: new Date(now - 86400000),
          takenAt: new Date(now - 86400000),
          status: 'taken',
          confirmationStatus: 'disputed',
          confirmedAt: new Date(now - 86400000),
        },
        {
          medicationId,
          patientId,
          scheduledTime: new Date(now - 172800000),
          takenAt: new Date(now - 172800000),
          status: 'taken',
          confirmationStatus: 'disputed',
          confirmedAt: new Date(now - 172800000),
        },
        {
          medicationId,
          patientId,
          scheduledTime: new Date(now - 259200000),
          takenAt: new Date(now - 259200000),
          status: 'taken',
          confirmationStatus: 'disputed',
          confirmedAt: new Date(now - 259200000),
        },
      ]);
    });

    it('triggers intervention after 3 disputes in 7 days', async () => {
      const intervention = await interventionService.checkForRepeatedDisputes(patientId);

      expect(intervention).toBeDefined();
      expect(intervention.interventionType).toBe('repeated_disputes');
      expect(intervention.reason).toContain('3 disputed doses');
    });

    it('does not create duplicate intervention', async () => {
      await interventionService.checkForRepeatedDisputes(patientId);
      const secondCall = await interventionService.checkForRepeatedDisputes(patientId);

      expect(secondCall).toBeNull();
    });
  });

  describe('checkForChronicMissedDoses', () => {
    beforeEach(async () => {
      const now = new Date();
      await DoseLog.create([
        {
          medicationId,
          patientId,
          scheduledTime: new Date(now - 86400000),
          status: 'missed',
        },
        {
          medicationId,
          patientId,
          scheduledTime: new Date(now - 172800000),
          status: 'missed',
        },
        {
          medicationId,
          patientId,
          scheduledTime: new Date(now - 259200000),
          status: 'missed',
        },
        {
          medicationId,
          patientId,
          scheduledTime: new Date(now - 345600000),
          status: 'missed',
        },
        {
          medicationId,
          patientId,
          scheduledTime: new Date(now - 432000000),
          status: 'missed',
        },
      ]);
    });

    it('triggers intervention after 5 missed doses in 7 days', async () => {
      const intervention = await interventionService.checkForChronicMissedDoses(patientId);

      expect(intervention).toBeDefined();
      expect(intervention.interventionType).toBe('medication_non_adherence');
      expect(intervention.reason).toContain('5 missed doses');
    });
  });

  describe('checkForHighRiskPrediction', () => {
    it('triggers intervention for risk score >= 0.8', async () => {
      const intervention = await interventionService.checkForHighRiskPrediction(patientId, 0.85);

      expect(intervention).toBeDefined();
      expect(intervention.interventionType).toBe('high_risk_prediction');
      expect(intervention.priority).toBe('high');
    });

    it('sets urgent priority for risk score >= 0.9', async () => {
      const intervention = await interventionService.checkForHighRiskPrediction(patientId, 0.92);

      expect(intervention).toBeDefined();
      expect(intervention.priority).toBe('urgent');
      expect(intervention.escalationLevel).toBe(2);
    });

    it('does not trigger for risk score < 0.8', async () => {
      const intervention = await interventionService.checkForHighRiskPrediction(patientId, 0.75);

      expect(intervention).toBeNull();
    });
  });
});
