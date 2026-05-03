import { describe, it, expect } from '@jest/globals';
import mongoose from 'mongoose';
import User from '../../models/User.model.js';
import Medication from '../../models/Medication.model.js';
import DoseLog from '../../models/DoseLog.model.js';
import { generateDoseLogs, createMedication } from '../../src/medications/medication.service.js';

describe('Medication Service', () => {
  let patientId;

  beforeEach(async () => {
    const user = await User.create({
      email: `patient-${Date.now()}@test.com`,
      fullName: 'Test Patient',
      role: 'patient',
    });
    patientId = user._id;
  });

  describe('generateDoseLogs', () => {
    it('generates correct number of logs for daily twice medication', async () => {
      const med = await Medication.create({
        patientId,
        name: 'TestMed',
        dosage: '100mg',
        frequency: { times: ['08:00', '20:00'], days: ['all'] },
        startDate: new Date(),
      });

      const count = await generateDoseLogs(med._id, patientId, med.frequency, new Date(), 7);
      expect(count).toBe(14);

      const logs = await DoseLog.find({ medicationId: med._id });
      expect(logs).toHaveLength(14);
      expect(logs.every((l) => l.status === 'pending')).toBe(true);
    });

    it('respects specific days filter', async () => {
      const med = await Medication.create({
        patientId,
        name: 'WeeklyMed',
        dosage: '50mg',
        frequency: { times: ['09:00'], days: ['Mon', 'Wed', 'Fri'] },
        startDate: new Date('2024-01-01'),
      });

      await generateDoseLogs(med._id, patientId, med.frequency, new Date('2024-01-01'), 7);
      const logs = await DoseLog.find({ medicationId: med._id });
      expect(logs.length).toBeLessThanOrEqual(3);
    });
  });
});
