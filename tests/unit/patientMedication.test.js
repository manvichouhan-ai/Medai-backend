import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import mongoose from 'mongoose';
import User from '../../models/User.model.js';
import DoctorPatient from '../../models/DoctorPatient.model.js';
import MasterMedication from '../../models/MasterMedication.model.js';
import PatientMedication from '../../models/PatientMedication.model.js';
import * as patientMedicationService from '../../src/features/doctor/patientMedication.service.js';

jest.mock('../../config/redis.js', () => ({
  redis: {
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
  },
}));

describe('Patient Medication Service', () => {
  let doctorId, patientId, medicationId;

  beforeEach(async () => {
    // Create doctor
    const doctor = await User.create({
      email: `doctor-${Date.now()}@test.com`,
      fullName: 'Test Doctor',
      role: 'doctor',
    });
    doctorId = doctor._id;

    // Create patient
    const patient = await User.create({
      email: `patient-${Date.now()}@test.com`,
      fullName: 'Test Patient',
      role: 'patient',
    });
    patientId = patient._id;

    // Create doctor-patient relationship
    await DoctorPatient.create({
      doctorId,
      patientId,
      status: 'active',
    });

    // Create master medication
    const medication = await MasterMedication.create({
      name: 'Metformin',
      genericName: 'Metformin HCL',
      category: 'Diabetes',
      strength: '500mg',
      form: 'tablet',
      manufacturer: 'Sun Pharma',
      createdByDoctor: doctorId,
    });
    medicationId = medication._id;
  });

  afterEach(async () => {
    await PatientMedication.deleteMany({});
    await MasterMedication.deleteMany({});
    await DoctorPatient.deleteMany({});
    await User.deleteMany({});
  });

  describe('assignMedicationToPatient', () => {
    it('should assign medication to patient successfully', async () => {
      const assignmentData = {
        medicationId: medicationId.toString(),
        dosage: '1 tablet',
        scheduleType: 'daily',
        times: ['09:00', '21:00'],
        instructions: 'After meals',
        startDate: '2026-05-09',
        endDate: '2026-06-09',
      };

      const result = await patientMedicationService.assignMedicationToPatient(doctorId, patientId.toString(), assignmentData);

      expect(result).toBeDefined();
      expect(result.patientId.toString()).toBe(patientId.toString());
      expect(result.medicationId.toString()).toBe(medicationId.toString());
      expect(result.assignedByDoctor.toString()).toBe(doctorId.toString());
      expect(result.dosage).toBe('1 tablet');
      expect(result.scheduleType).toBe('daily');
      expect(result.times).toEqual(['09:00', '21:00']);
      expect(result.instructions).toBe('After meals');
      expect(result.isActive).toBe(true);
    });

    it('should create dose logs for daily schedule', async () => {
      const assignmentData = {
        medicationId: medicationId.toString(),
        dosage: '1 tablet',
        scheduleType: 'daily',
        times: ['09:00'],
        startDate: '2026-05-09',
      };

      await patientMedicationService.assignMedicationToPatient(doctorId, patientId.toString(), assignmentData);

      // Check that dose logs were created
      const DoseLog = (await import('../../models/DoseLog.model.js')).default;
      const doseLogs = await DoseLog.find({
        patientMedicationId: assignmentData.patientMedicationId,
      });
      
      expect(doseLogs.length).toBeGreaterThan(0);
      expect(doseLogs[0].status).toBe('pending');
    });

    it('should create dose logs for weekly schedule', async () => {
      const assignmentData = {
        medicationId: medicationId.toString(),
        dosage: '1 tablet',
        scheduleType: 'weekly',
        times: ['09:00'],
        daysOfWeek: ['Mon', 'Wed', 'Fri'],
        startDate: '2026-05-09',
      };

      await patientMedicationService.assignMedicationToPatient(doctorId, patientId.toString(), assignmentData);

      // Check that dose logs were created only for specified days
      const DoseLog = (await import('../../models/DoseLog.model.js')).default;
      const doseLogs = await DoseLog.find({
        patientMedicationId: assignmentData.patientMedicationId,
      });
      
      expect(doseLogs.length).toBeGreaterThan(0);
    });

    it('should throw error for duplicate assignment', async () => {
      const assignmentData = {
        medicationId: medicationId.toString(),
        dosage: '1 tablet',
        scheduleType: 'daily',
        times: ['09:00'],
        startDate: '2026-05-09',
      };

      // First assignment should succeed
      await patientMedicationService.assignMedicationToPatient(doctorId, patientId.toString(), assignmentData);

      // Second assignment should fail
      await expect(patientMedicationService.assignMedicationToPatient(doctorId, patientId.toString(), assignmentData))
        .rejects.toThrow('Medication already assigned to this patient');
    });

    it('should throw error for non-existent medication', async () => {
      const assignmentData = {
        medicationId: new mongoose.Types.ObjectId().toString(),
        dosage: '1 tablet',
        scheduleType: 'daily',
        times: ['09:00'],
        startDate: '2026-05-09',
      };

      await expect(patientMedicationService.assignMedicationToPatient(doctorId, patientId.toString(), assignmentData))
        .rejects.toThrow('Medication not found');
    });

    it('should throw error for unauthorized doctor', async () => {
      const otherDoctor = await User.create({
        email: `other-${Date.now()}@test.com`,
        fullName: 'Other Doctor',
        role: 'doctor',
      });

      const assignmentData = {
        medicationId: medicationId.toString(),
        dosage: '1 tablet',
        scheduleType: 'daily',
        times: ['09:00'],
        startDate: '2026-05-09',
      };

      await expect(patientMedicationService.assignMedicationToPatient(otherDoctor._id, patientId.toString(), assignmentData))
        .rejects.toThrow('Not authorized to access this patient');
    });
  });

  describe('getPatientMedications', () => {
    beforeEach(async () => {
      // Create test assignments
      await PatientMedication.create([
        {
          patientId,
          medicationId,
          assignedByDoctor: doctorId,
          dosage: '1 tablet',
          scheduleType: 'daily',
          times: ['09:00'],
          startDate: new Date('2026-05-09'),
          isActive: true,
        },
        {
          patientId,
          medicationId: await MasterMedication.create({
            name: 'Aspirin',
            genericName: 'Acetylsalicylic Acid',
            category: 'Pain Relief',
            strength: '100mg',
            form: 'tablet',
            manufacturer: 'Cipla',
            createdByDoctor: doctorId,
          }).then(med => med._id),
          assignedByDoctor: doctorId,
          dosage: '1 tablet',
          scheduleType: 'daily',
          times: ['21:00'],
          startDate: new Date('2026-05-09'),
          isActive: true,
        },
      ]);
    });

    it('should return patient medications', async () => {
      const result = await patientMedicationService.getPatientMedications(doctorId, patientId.toString());

      expect(result.medications).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should populate medication details', async () => {
      const result = await patientMedicationService.getPatientMedications(doctorId, patientId.toString());

      expect(result.medications[0].medicationId).toBeDefined();
      expect(result.medications[0].medicationId.name).toBeDefined();
      expect(result.medications[0].assignedByDoctor).toBeDefined();
    });

    it('should filter by active status', async () => {
      await PatientMedication.create({
        patientId,
        medicationId,
        assignedByDoctor: doctorId,
        dosage: '1 tablet',
        scheduleType: 'daily',
        times: ['09:00'],
        startDate: new Date('2026-05-09'),
        isActive: false,
      });

      const result = await patientMedicationService.getPatientMedications(doctorId, patientId.toString(), {
        active: 'true'
      });

      expect(result.medications).toHaveLength(2); // Only active ones
    });

    it('should paginate results', async () => {
      const result = await patientMedicationService.getPatientMedications(doctorId, patientId.toString(), {
        page: 1,
        limit: 1
      });

      expect(result.medications).toHaveLength(1);
      expect(result.total).toBe(2);
    });
  });

  describe('updatePatientMedication', () => {
    let patientMedicationId;

    beforeEach(async () => {
      const patientMed = await PatientMedication.create({
        patientId,
        medicationId,
        assignedByDoctor: doctorId,
        dosage: '1 tablet',
        scheduleType: 'daily',
        times: ['09:00'],
        startDate: new Date('2026-05-09'),
        isActive: true,
      });
      patientMedicationId = patientMed._id;
    });

    it('should update patient medication', async () => {
      const updates = {
        dosage: '2 tablets',
        instructions: 'Updated instructions',
      };

      const result = await patientMedicationService.updatePatientMedication(doctorId, patientMedicationId.toString(), updates);

      expect(result.dosage).toBe('2 tablets');
      expect(result.instructions).toBe('Updated instructions');
    });

    it('should regenerate dose logs when schedule changes', async () => {
      const updates = {
        times: ['10:00', '22:00'],
      };

      await patientMedicationService.updatePatientMedication(doctorId, patientMedicationId.toString(), updates);

      // Check that old future doses were deleted and new ones created
      const DoseLog = (await import('../../models/DoseLog.model.js')).default;
      const doseLogs = await DoseLog.find({
        patientMedicationId: patientMedicationId,
        status: 'pending',
        scheduledTime: { $gte: new Date() }
      });

      expect(doseLogs.length).toBeGreaterThan(0);
      // Check that new times are used
      const scheduledTimes = doseLogs.map(log => log.scheduledTime.getUTCHours());
      expect(scheduledTimes).toContain(10);
      expect(scheduledTimes).toContain(22);
    });

    it('should throw error for non-owner doctor', async () => {
      const otherDoctor = await User.create({
        email: `other-${Date.now()}@test.com`,
        fullName: 'Other Doctor',
        role: 'doctor',
      });

      const updates = {
        dosage: '2 tablets',
      };

      await expect(patientMedicationService.updatePatientMedication(otherDoctor._id, patientMedicationId.toString(), updates))
        .rejects.toThrow('Not authorized to update this medication assignment');
    });
  });

  describe('deletePatientMedication', () => {
    let patientMedicationId;

    beforeEach(async () => {
      const patientMed = await PatientMedication.create({
        patientId,
        medicationId,
        assignedByDoctor: doctorId,
        dosage: '1 tablet',
        scheduleType: 'daily',
        times: ['09:00'],
        startDate: new Date('2026-05-09'),
        isActive: true,
      });
      patientMedicationId = patientMed._id;
    });

    it('should soft delete patient medication', async () => {
      await patientMedicationService.deletePatientMedication(doctorId, patientMedicationId.toString());

      const deletedMed = await PatientMedication.findById(patientMedicationId);
      expect(deletedMed.isActive).toBe(false);
    });

    it('should delete future dose logs', async () => {
      await patientMedicationService.deletePatientMedication(doctorId, patientMedicationId.toString());

      const DoseLog = (await import('../../models/DoseLog.model.js')).default;
      const futureDoses = await DoseLog.find({
        patientMedicationId: patientMedicationId,
        status: 'pending',
        scheduledTime: { $gte: new Date() }
      });

      expect(futureDoses).toHaveLength(0);
    });

    it('should throw error for non-owner doctor', async () => {
      const otherDoctor = await User.create({
        email: `other-${Date.now()}@test.com`,
        fullName: 'Other Doctor',
        role: 'doctor',
      });

      await expect(patientMedicationService.deletePatientMedication(otherDoctor._id, patientMedicationId.toString()))
        .rejects.toThrow('Not authorized to delete this medication assignment');
    });
  });
});
