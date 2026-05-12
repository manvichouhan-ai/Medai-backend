import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import mongoose from 'mongoose';
import User from '../../models/User.model.js';
import MasterMedication from '../../models/MasterMedication.model.js';
import * as masterMedicationService from '../../src/features/doctor/masterMedication.service.js';

jest.mock('../../config/redis.js', () => ({
  redis: {
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
  },
}));

describe('Master Medication Service', () => {
  let doctorId, adminId;

  beforeEach(async () => {
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
  });

  afterEach(async () => {
    await MasterMedication.deleteMany({});
    await User.deleteMany({});
  });

  describe('createMasterMedication', () => {
    it('should create a master medication successfully', async () => {
      const medicationData = {
        name: 'Metformin',
        genericName: 'Metformin Hydrochloride',
        category: 'Diabetes',
        strength: '500mg',
        form: 'tablet',
        manufacturer: 'Sun Pharma',
        description: 'Used for blood sugar control',
        sideEffects: ['Nausea', 'Headache'],
      };

      const result = await masterMedicationService.createMasterMedication(doctorId, medicationData);

      expect(result).toBeDefined();
      expect(result.name).toBe(medicationData.name);
      expect(result.genericName).toBe(medicationData.genericName);
      expect(result.category).toBe(medicationData.category);
      expect(result.createdByDoctor.toString()).toBe(doctorId.toString());
      expect(result.isActive).toBe(true);
    });

    it('should validate required fields', async () => {
      const invalidData = {
        name: '',
        genericName: 'Test',
      };

      await expect(masterMedicationService.createMasterMedication(doctorId, invalidData))
        .rejects.toThrow();
    });
  });

  describe('getMasterMedications', () => {
    beforeEach(async () => {
      // Create test medications
      await MasterMedication.create([
        {
          name: 'Metformin',
          genericName: 'Metformin HCL',
          category: 'Diabetes',
          strength: '500mg',
          form: 'tablet',
          manufacturer: 'Sun Pharma',
          createdByDoctor: doctorId,
        },
        {
          name: 'Aspirin',
          genericName: 'Acetylsalicylic Acid',
          category: 'Pain Relief',
          strength: '100mg',
          form: 'tablet',
          manufacturer: 'Cipla',
          createdByDoctor: doctorId,
        },
      ]);
    });

    it('should return medications for doctor', async () => {
      const result = await masterMedicationService.getMasterMedications(doctorId);

      expect(result.medications).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should return all medications for admin', async () => {
      const result = await masterMedicationService.getMasterMedications(null);

      expect(result.medications).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by category', async () => {
      const result = await masterMedicationService.getMasterMedications(doctorId, {
        category: 'Diabetes'
      });

      expect(result.medications).toHaveLength(1);
      expect(result.medications[0].category).toBe('Diabetes');
    });

    it('should search medications', async () => {
      const result = await masterMedicationService.getMasterMedications(doctorId, {
        search: 'Metformin'
      });

      expect(result.medications).toHaveLength(1);
      expect(result.medications[0].name).toBe('Metformin');
    });

    it('should paginate results', async () => {
      const result = await masterMedicationService.getMasterMedications(doctorId, {
        page: 1,
        limit: 1
      });

      expect(result.medications).toHaveLength(1);
      expect(result.total).toBe(2);
      expect(result.totalPages).toBe(2);
    });
  });

  describe('getMasterMedicationById', () => {
    let medicationId;

    beforeEach(async () => {
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

    it('should return medication for owner doctor', async () => {
      const result = await masterMedicationService.getMasterMedicationById(medicationId, doctorId);

      expect(result).toBeDefined();
      expect(result.name).toBe('Metformin');
    });

    it('should return medication for admin', async () => {
      const result = await masterMedicationService.getMasterMedicationById(medicationId, null);

      expect(result).toBeDefined();
      expect(result.name).toBe('Metformin');
    });

    it('should throw error for non-owner doctor', async () => {
      const otherDoctor = await User.create({
        email: `other-${Date.now()}@test.com`,
        fullName: 'Other Doctor',
        role: 'doctor',
      });

      await expect(masterMedicationService.getMasterMedicationById(medicationId, otherDoctor._id))
        .rejects.toThrow('Medication not found');
    });

    it('should throw error for non-existent medication', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      await expect(masterMedicationService.getMasterMedicationById(fakeId, doctorId))
        .rejects.toThrow('Medication not found');
    });
  });

  describe('updateMasterMedication', () => {
    let medicationId;

    beforeEach(async () => {
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

    it('should update medication for owner doctor', async () => {
      const updates = {
        name: 'Metformin XR',
        description: 'Extended release formulation',
      };

      const result = await masterMedicationService.updateMasterMedication(medicationId, doctorId, updates);

      expect(result.name).toBe('Metformin XR');
      expect(result.description).toBe('Extended release formulation');
    });

    it('should update medication for admin', async () => {
      const updates = {
        name: 'Metformin XR',
      };

      const result = await masterMedicationService.updateMasterMedication(medicationId, null, updates);

      expect(result.name).toBe('Metformin XR');
    });

    it('should throw error for non-owner doctor', async () => {
      const otherDoctor = await User.create({
        email: `other-${Date.now()}@test.com`,
        fullName: 'Other Doctor',
        role: 'doctor',
      });

      await expect(masterMedicationService.updateMasterMedication(medicationId, otherDoctor._id, {}))
        .rejects.toThrow('Medication not found or access denied');
    });
  });

  describe('deleteMasterMedication', () => {
    let medicationId;

    beforeEach(async () => {
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

    it('should soft delete medication for owner doctor', async () => {
      await masterMedicationService.deleteMasterMedication(medicationId, doctorId);

      const deletedMed = await MasterMedication.findById(medicationId);
      expect(deletedMed.isActive).toBe(false);
    });

    it('should soft delete medication for admin', async () => {
      await masterMedicationService.deleteMasterMedication(medicationId, null);

      const deletedMed = await MasterMedication.findById(medicationId);
      expect(deletedMed.isActive).toBe(false);
    });

    it('should throw error for non-owner doctor', async () => {
      const otherDoctor = await User.create({
        email: `other-${Date.now()}@test.com`,
        fullName: 'Other Doctor',
        role: 'doctor',
      });

      await expect(masterMedicationService.deleteMasterMedication(medicationId, otherDoctor._id))
        .rejects.toThrow('Medication not found or access denied');
    });
  });

  describe('getMedicationCategories', () => {
    beforeEach(async () => {
      await MasterMedication.create([
        {
          name: 'Metformin',
          genericName: 'Metformin HCL',
          category: 'Diabetes',
          strength: '500mg',
          form: 'tablet',
          manufacturer: 'Sun Pharma',
          createdByDoctor: doctorId,
        },
        {
          name: 'Aspirin',
          genericName: 'Acetylsalicylic Acid',
          category: 'Pain Relief',
          strength: '100mg',
          form: 'tablet',
          manufacturer: 'Cipla',
          createdByDoctor: doctorId,
        },
        {
          name: 'Insulin',
          genericName: 'Insulin Glargine',
          category: 'Diabetes',
          strength: '100U/ml',
          form: 'injection',
          manufacturer: 'Novo Nordisk',
          createdByDoctor: doctorId,
        },
      ]);
    });

    it('should return categories with counts', async () => {
      const categories = await masterMedicationService.getMedicationCategories(doctorId);

      expect(categories).toHaveLength(2);
      expect(categories.find(c => c.category === 'Diabetes').count).toBe(2);
      expect(categories.find(c => c.category === 'Pain Relief').count).toBe(1);
    });
  });
});
