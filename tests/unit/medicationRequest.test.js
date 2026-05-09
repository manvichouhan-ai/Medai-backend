import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import mongoose from 'mongoose';
import User from '../../models/User.model.js';
import MedicationRequest from '../../models/MedicationRequest.model.js';
import Medication from '../../models/Medication.model.js';
import CaregiverPatient from '../../models/CaregiverPatient.model.js';
import * as medicationRequestService from '../../src/medicationRequests/medicationRequest.service.js';

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

describe('Medication Request Service', () => {
  let patientId, caregiverId, doctorId;

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
  });

  afterEach(async () => {
    await MedicationRequest.deleteMany({});
    await Medication.deleteMany({});
    await CaregiverPatient.deleteMany({});
    await User.deleteMany({});
  });

  describe('createMedicationRequest', () => {
    it('patient creates request successfully', async () => {
      const data = {
        type: 'new_medication',
        medicationData: {
          name: 'Lisinopril',
          dosage: '10mg',
          frequency: { times: ['08:00'], days: ['all'] },
          startDate: new Date().toISOString(),
        },
        notes: 'Blood pressure medication',
        priority: 'medium',
      };

      const request = await medicationRequestService.createMedicationRequest(
        patientId,
        'patient',
        data
      );

      expect(request.status).toBe('pending');
      expect(request.patientId.toString()).toBe(patientId.toString());
      expect(request.requestedBy.toString()).toBe(patientId.toString());
      expect(request.requestedByRole).toBe('patient');
      expect(request.medicationData.name).toBe('Lisinopril');
    });

    it('caregiver creates request for linked patient', async () => {
      const data = {
        patientId: patientId.toString(),
        type: 'dosage_change',
        medicationData: {
          name: 'Metformin',
          dosage: '500mg',
          frequency: { times: ['08:00', '20:00'], days: ['all'] },
          startDate: new Date().toISOString(),
        },
        priority: 'high',
      };

      const request = await medicationRequestService.createMedicationRequest(
        caregiverId,
        'caregiver',
        data
      );

      expect(request.status).toBe('pending');
      expect(request.patientId.toString()).toBe(patientId.toString());
      expect(request.requestedBy.toString()).toBe(caregiverId.toString());
      expect(request.requestedByRole).toBe('caregiver');
    });

    it('caregiver cannot create request for unlinked patient', async () => {
      const otherPatient = await User.create({
        email: `other-${Date.now()}@test.com`,
        fullName: 'Other Patient',
        role: 'patient',
      });

      const data = {
        patientId: otherPatient._id.toString(),
        type: 'new_medication',
        medicationData: {
          name: 'Aspirin',
          dosage: '81mg',
          frequency: { times: ['08:00'], days: ['all'] },
          startDate: new Date().toISOString(),
        },
      };

      await expect(
        medicationRequestService.createMedicationRequest(caregiverId, 'caregiver', data)
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe('getMedicationRequests', () => {
    beforeEach(async () => {
      await MedicationRequest.create([
        {
          patientId,
          requestedBy: patientId,
          requestedByRole: 'patient',
          type: 'new_medication',
          medicationData: {
            name: 'Med1',
            dosage: '10mg',
            frequency: { times: ['08:00'], days: ['all'] },
            startDate: new Date(),
          },
          status: 'pending',
          priority: 'high',
        },
        {
          patientId,
          requestedBy: caregiverId,
          requestedByRole: 'caregiver',
          type: 'dosage_change',
          medicationData: {
            name: 'Med2',
            dosage: '20mg',
            frequency: { times: ['08:00'], days: ['all'] },
            startDate: new Date(),
          },
          status: 'approved',
          priority: 'low',
        },
      ]);
    });

    it('patient sees their own requests', async () => {
      const result = await medicationRequestService.getMedicationRequests(patientId, 'patient');
      expect(result.requests).toHaveLength(2);
      expect(result.requests.every((r) => r.patientId.toString() === patientId.toString())).toBe(true);
    });

    it('caregiver sees linked patient requests', async () => {
      const result = await medicationRequestService.getMedicationRequests(caregiverId, 'caregiver');
      expect(result.requests).toHaveLength(2);
    });

    it('doctor sees all requests with filters', async () => {
      const result = await medicationRequestService.getMedicationRequests(doctorId, 'doctor', {
        status: 'pending',
      });
      expect(result.requests).toHaveLength(1);
      expect(result.requests[0].status).toBe('pending');
    });

    it('supports pagination', async () => {
      const result = await medicationRequestService.getMedicationRequests(doctorId, 'doctor', {
        page: 1,
        limit: 1,
      });
      expect(result.requests).toHaveLength(1);
      expect(result.total).toBe(2);
    });
  });

  describe('getMedicationRequestById', () => {
    let requestId;

    beforeEach(async () => {
      const request = await MedicationRequest.create({
        patientId,
        requestedBy: patientId,
        requestedByRole: 'patient',
        type: 'new_medication',
        medicationData: {
          name: 'TestMed',
          dosage: '10mg',
          frequency: { times: ['08:00'], days: ['all'] },
          startDate: new Date(),
        },
        status: 'pending',
      });
      requestId = request._id;
    });

    it('patient can view their own request', async () => {
      const request = await medicationRequestService.getMedicationRequestById(
        requestId,
        patientId,
        'patient'
      );
      expect(request._id.toString()).toBe(requestId.toString());
    });

    it('caregiver can view linked patient request', async () => {
      const request = await medicationRequestService.getMedicationRequestById(
        requestId,
        caregiverId,
        'caregiver'
      );
      expect(request._id.toString()).toBe(requestId.toString());
    });

    it('patient cannot view other patient request', async () => {
      const otherPatient = await User.create({
        email: `other-${Date.now()}@test.com`,
        fullName: 'Other Patient',
        role: 'patient',
      });

      await expect(
        medicationRequestService.getMedicationRequestById(requestId, otherPatient._id, 'patient')
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('returns 404 for non-existent request', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await expect(
        medicationRequestService.getMedicationRequestById(fakeId, patientId, 'patient')
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('approveMedicationRequest', () => {
    let requestId;

    beforeEach(async () => {
      const request = await MedicationRequest.create({
        patientId,
        requestedBy: patientId,
        requestedByRole: 'patient',
        type: 'new_medication',
        medicationData: {
          name: 'Lisinopril',
          dosage: '10mg',
          frequency: { times: ['08:00'], days: ['all'] },
          startDate: new Date(),
        },
        status: 'pending',
      });
      requestId = request._id;
    });

    it('doctor approves request and creates medication', async () => {
      const request = await medicationRequestService.approveMedicationRequest(
        requestId,
        doctorId,
        { notes: 'Approved' }
      );

      expect(request.status).toBe('approved');
      expect(request.reviewedBy.toString()).toBe(doctorId.toString());
      expect(request.reviewedAt).toBeDefined();

      const medication = await Medication.findOne({ patientId, name: 'Lisinopril' });
      expect(medication).toBeDefined();
      expect(medication.prescribedBy.toString()).toBe(doctorId.toString());
    });

    it('cannot approve already processed request', async () => {
      await medicationRequestService.approveMedicationRequest(requestId, doctorId, {});

      await expect(
        medicationRequestService.approveMedicationRequest(requestId, doctorId, {})
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('handles discontinue type', async () => {
      const med = await Medication.create({
        patientId,
        name: 'OldMed',
        dosage: '10mg',
        frequency: { times: ['08:00'], days: ['all'] },
        startDate: new Date(),
        prescribedBy: doctorId,
      });

      const discontinueRequest = await MedicationRequest.create({
        patientId,
        requestedBy: patientId,
        requestedByRole: 'patient',
        type: 'discontinue',
        medicationData: {
          name: 'OldMed',
          dosage: '10mg',
          frequency: { times: ['08:00'], days: ['all'] },
          startDate: new Date(),
        },
        status: 'pending',
      });

      await medicationRequestService.approveMedicationRequest(discontinueRequest._id, doctorId, {});

      const updatedMed = await Medication.findById(med._id);
      expect(updatedMed.isActive).toBe(false);
    });
  });

  describe('rejectMedicationRequest', () => {
    let requestId;

    beforeEach(async () => {
      const request = await MedicationRequest.create({
        patientId,
        requestedBy: patientId,
        requestedByRole: 'patient',
        type: 'new_medication',
        medicationData: {
          name: 'Lisinopril',
          dosage: '10mg',
          frequency: { times: ['08:00'], days: ['all'] },
          startDate: new Date(),
        },
        status: 'pending',
      });
      requestId = request._id;
    });

    it('doctor rejects request with reason', async () => {
      const request = await medicationRequestService.rejectMedicationRequest(requestId, doctorId, {
        rejectionReason: 'Not clinically indicated',
        notes: 'Consult cardiologist first',
      });

      expect(request.status).toBe('rejected');
      expect(request.rejectionReason).toBe('Not clinically indicated');
      expect(request.reviewedBy.toString()).toBe(doctorId.toString());
      expect(request.reviewedAt).toBeDefined();
    });

    it('cannot reject already processed request', async () => {
      await medicationRequestService.rejectMedicationRequest(requestId, doctorId, {
        rejectionReason: 'Test',
      });

      await expect(
        medicationRequestService.rejectMedicationRequest(requestId, doctorId, {
          rejectionReason: 'Test',
        })
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('does not create medication on rejection', async () => {
      await medicationRequestService.rejectMedicationRequest(requestId, doctorId, {
        rejectionReason: 'Not needed',
      });

      const medication = await Medication.findOne({ patientId, name: 'Lisinopril' });
      expect(medication).toBeNull();
    });
  });
});
