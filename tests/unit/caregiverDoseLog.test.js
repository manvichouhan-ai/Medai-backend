import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import mongoose from 'mongoose';
import User from '../../models/User.model.js';
import Medication from '../../models/Medication.model.js';
import DoseLog from '../../models/DoseLog.model.js';
import CaregiverPatient from '../../models/CaregiverPatient.model.js';
import * as caregiverDoseLogService from '../../src/doseLogs/caregiverDoseLog.service.js';

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

describe('Caregiver Dose Log Service', () => {
  let patientId, caregiverId, doctorId, medicationId, doseLogId;

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

    const doseLog = await DoseLog.create({
      medicationId,
      patientId,
      scheduledTime: new Date(),
      status: 'pending',
    });
    doseLogId = doseLog._id;
  });

  afterEach(async () => {
    await DoseLog.deleteMany({});
    await Medication.deleteMany({});
    await CaregiverPatient.deleteMany({});
    await User.deleteMany({});
  });

  describe('assistDose', () => {
    it('caregiver assists dose for assigned patient', async () => {
      const data = { assistanceNotes: 'Administered with water' };
      const log = await caregiverDoseLogService.assistDose(doseLogId, caregiverId, data);

      expect(log.status).toBe('taken');
      expect(log.takenBy.toString()).toBe(caregiverId.toString());
      expect(log.takenByRole).toBe('caregiver');
      expect(log.assistedBy.toString()).toBe(caregiverId.toString());
      expect(log.confirmationStatus).toBe('confirmed');
      expect(log.confirmedBy.toString()).toBe(caregiverId.toString());
      expect(log.confirmedAt).toBeDefined();
      expect(log.assistanceNotes).toBe('Administered with water');
    });

    it('caregiver cannot assist dose for unassigned patient', async () => {
      const otherCaregiver = await User.create({
        email: `other-${Date.now()}@test.com`,
        fullName: 'Other Caregiver',
        role: 'caregiver',
      });

      await expect(
        caregiverDoseLogService.assistDose(doseLogId, otherCaregiver._id, {})
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('cannot assist already actioned dose', async () => {
      await DoseLog.findByIdAndUpdate(doseLogId, { status: 'taken', takenAt: new Date() });

      await expect(
        caregiverDoseLogService.assistDose(doseLogId, caregiverId, {})
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('dose log not found', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      await expect(
        caregiverDoseLogService.assistDose(fakeId, caregiverId, {})
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('doctor can also assist dose', async () => {
      const data = { assistanceNotes: 'Doctor administered' };
      const log = await caregiverDoseLogService.assistDose(doseLogId, doctorId, data);

      expect(log.status).toBe('taken');
      expect(log.takenBy.toString()).toBe(doctorId.toString());
      expect(log.takenByRole).toBe('caregiver');
    });
  });

  describe('confirmDose', () => {
    beforeEach(async () => {
      await DoseLog.findByIdAndUpdate(doseLogId, {
        status: 'taken',
        takenAt: new Date(),
        takenBy: patientId,
        takenByRole: 'patient',
      });
    });

    it('caregiver confirms patient-marked dose', async () => {
      const data = { notes: 'Witnessed intake' };
      const log = await caregiverDoseLogService.confirmDose(doseLogId, caregiverId, data);

      expect(log.confirmationStatus).toBe('confirmed');
      expect(log.confirmedBy.toString()).toBe(caregiverId.toString());
      expect(log.confirmedAt).toBeDefined();
      expect(log.notes).toBe('Witnessed intake');
    });

    it('cannot confirm pending dose', async () => {
      await DoseLog.findByIdAndUpdate(doseLogId, { status: 'pending' });

      await expect(
        caregiverDoseLogService.confirmDose(doseLogId, caregiverId, {})
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('cannot confirm already confirmed dose', async () => {
      await DoseLog.findByIdAndUpdate(doseLogId, {
        confirmationStatus: 'confirmed',
        confirmedBy: caregiverId,
        confirmedAt: new Date(),
      });

      await expect(
        caregiverDoseLogService.confirmDose(doseLogId, caregiverId, {})
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('caregiver cannot confirm unassigned patient dose', async () => {
      const otherCaregiver = await User.create({
        email: `other-${Date.now()}@test.com`,
        fullName: 'Other Caregiver',
        role: 'caregiver',
      });

      await expect(
        caregiverDoseLogService.confirmDose(doseLogId, otherCaregiver._id, {})
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe('disputeDose', () => {
    beforeEach(async () => {
      await DoseLog.findByIdAndUpdate(doseLogId, {
        status: 'taken',
        takenAt: new Date(),
        takenBy: patientId,
        takenByRole: 'patient',
      });
    });

    it('caregiver disputes patient-marked dose', async () => {
      const data = { disputeReason: 'Patient was not present', notes: 'Follow up required' };
      const log = await caregiverDoseLogService.disputeDose(doseLogId, caregiverId, data);

      expect(log.confirmationStatus).toBe('disputed');
      expect(log.notes).toBe('Follow up required');
    });

    it('cannot dispute pending dose', async () => {
      await DoseLog.findByIdAndUpdate(doseLogId, { status: 'pending' });

      await expect(
        caregiverDoseLogService.disputeDose(doseLogId, caregiverId, {
          disputeReason: 'Test',
        })
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('disputeReason is required', async () => {
      await expect(
        caregiverDoseLogService.disputeDose(doseLogId, caregiverId, {})
      ).rejects.toThrow();
    });

    it('triggers intervention after 3 disputes in 7 days', async () => {
      const otherLogs = await DoseLog.create([
        {
          medicationId,
          patientId,
          scheduledTime: new Date(Date.now() - 86400000),
          status: 'taken',
          takenAt: new Date(Date.now() - 86400000),
          confirmationStatus: 'disputed',
          confirmedAt: new Date(Date.now() - 86400000),
        },
        {
          medicationId,
          patientId,
          scheduledTime: new Date(Date.now() - 172800000),
          status: 'taken',
          takenAt: new Date(Date.now() - 172800000),
          confirmationStatus: 'disputed',
          confirmedAt: new Date(Date.now() - 172800000),
        },
      ]);

      const log = await caregiverDoseLogService.disputeDose(doseLogId, caregiverId, {
        disputeReason: 'Third dispute',
      });

      expect(log.interventionRequired).toBe(true);
      expect(log.interventionReason).toContain('Repeated disputes');
    });

    it('caregiver cannot dispute unassigned patient dose', async () => {
      const otherCaregiver = await User.create({
        email: `other-${Date.now()}@test.com`,
        fullName: 'Other Caregiver',
        role: 'caregiver',
      });

      await expect(
        caregiverDoseLogService.disputeDose(doseLogId, otherCaregiver._id, {
          disputeReason: 'Test',
        })
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe('getPendingConfirmations', () => {
    beforeEach(async () => {
      const otherPatient = await User.create({
        email: `other-${Date.now()}@test.com`,
        fullName: 'Other Patient',
        role: 'patient',
      });

      await DoseLog.create([
        {
          medicationId,
          patientId,
          scheduledTime: new Date(),
          status: 'taken',
          takenAt: new Date(),
          confirmationStatus: 'pending',
        },
        {
          medicationId,
          patientId,
          scheduledTime: new Date(Date.now() + 3600000),
          status: 'delayed',
          takenAt: new Date(),
          confirmationStatus: 'pending',
        },
        {
          medicationId,
          patientId: otherPatient._id,
          scheduledTime: new Date(),
          status: 'taken',
          takenAt: new Date(),
          confirmationStatus: 'pending',
        },
        {
          medicationId,
          patientId,
          scheduledTime: new Date(),
          status: 'taken',
          takenAt: new Date(),
          confirmationStatus: 'confirmed',
        },
      ]);
    });

    it('returns pending confirmations for assigned patients', async () => {
      const result = await caregiverDoseLogService.getPendingConfirmations(caregiverId);

      expect(result.logs).toHaveLength(2);
      expect(result.logs.every((log) => log.confirmationStatus === 'pending')).toBe(true);
    });

    it('filters by patient', async () => {
      const result = await caregiverDoseLogService.getPendingConfirmations(caregiverId, {
        patientId: patientId.toString(),
      });

      expect(result.logs).toHaveLength(2);
    });

    it('rejects unassigned patient filter', async () => {
      const otherPatient = await User.create({
        email: `other2-${Date.now()}@test.com`,
        fullName: 'Other Patient 2',
        role: 'patient',
      });

      await expect(
        caregiverDoseLogService.getPendingConfirmations(caregiverId, {
          patientId: otherPatient._id.toString(),
        })
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('supports pagination', async () => {
      const result = await caregiverDoseLogService.getPendingConfirmations(caregiverId, {
        page: 1,
        limit: 1,
      });

      expect(result.logs).toHaveLength(1);
      expect(result.total).toBe(2);
    });

    it('sorts by scheduled time ascending', async () => {
      const result = await caregiverDoseLogService.getPendingConfirmations(caregiverId);

      expect(result.logs[0].scheduledTime.getTime()).toBeLessThanOrEqual(
        result.logs[1].scheduledTime.getTime()
      );
    });
  });

  describe('getAssistedHistory', () => {
    beforeEach(async () => {
      const otherPatient = await User.create({
        email: `other-${Date.now()}@test.com`,
        fullName: 'Other Patient',
        role: 'patient',
      });

      await DoseLog.create([
        {
          medicationId,
          patientId,
          scheduledTime: new Date(Date.now() - 86400000),
          takenAt: new Date(Date.now() - 86400000),
          status: 'taken',
          assistedBy: caregiverId,
        },
        {
          medicationId,
          patientId,
          scheduledTime: new Date(Date.now() - 172800000),
          takenAt: new Date(Date.now() - 172800000),
          status: 'delayed',
          assistedBy: caregiverId,
        },
        {
          medicationId,
          patientId: otherPatient._id,
          scheduledTime: new Date(),
          takenAt: new Date(),
          status: 'taken',
          assistedBy: caregiverId,
        },
        {
          medicationId,
          patientId,
          scheduledTime: new Date(),
          takenAt: new Date(),
          status: 'taken',
          assistedBy: doctorId,
        },
      ]);
    });

    it('returns assisted dose history for assigned patients', async () => {
      const result = await caregiverDoseLogService.getAssistedHistory(caregiverId);

      expect(result.logs).toHaveLength(2);
      expect(result.logs.every((log) => log.assistedBy.toString() === caregiverId.toString())).toBe(
        true
      );
    });

    it('filters by patient', async () => {
      const result = await caregiverDoseLogService.getAssistedHistory(caregiverId, {
        patientId: patientId.toString(),
      });

      expect(result.logs).toHaveLength(2);
    });

    it('filters by status', async () => {
      const result = await caregiverDoseLogService.getAssistedHistory(caregiverId, {
        status: 'delayed',
      });

      expect(result.logs).toHaveLength(1);
      expect(result.logs[0].status).toBe('delayed');
    });

    it('rejects unassigned patient filter', async () => {
      const otherPatient = await User.create({
        email: `other2-${Date.now()}@test.com`,
        fullName: 'Other Patient 2',
        role: 'patient',
      });

      await expect(
        caregiverDoseLogService.getAssistedHistory(caregiverId, {
          patientId: otherPatient._id.toString(),
        })
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('supports pagination', async () => {
      const result = await caregiverDoseLogService.getAssistedHistory(caregiverId, {
        page: 1,
        limit: 1,
      });

      expect(result.logs).toHaveLength(1);
      expect(result.total).toBe(2);
    });

    it('sorts by takenAt descending', async () => {
      const result = await caregiverDoseLogService.getAssistedHistory(caregiverId);

      expect(result.logs[0].takenAt.getTime()).toBeGreaterThanOrEqual(
        result.logs[1].takenAt.getTime()
      );
    });
  });
});
