import { z } from 'zod';
import { validate } from './auth.schema.js';

const frequencySchema = z.object({
  times: z.array(z.string().regex(/^\d{2}:\d{2}$/)),
  days: z.array(z.string()),
});

export const createMedicationSchema = z.object({
  name: z.string().min(1),
  dosage: z.string().min(1),
  frequency: frequencySchema.optional(),
  scheduleType: z.enum(['daily', 'weekly']).optional(),
  daysOfWeek: z.array(z.string()).optional(),
  startDate: z.string().datetime().or(z.string()),
  endDate: z.string().datetime().or(z.string()).optional(),
  instructions: z.string().optional(),
  patientId: z.string().optional(),
  prescribedBy: z.string().optional(),
}).refine(
  (data) => {
    if (data.scheduleType === 'weekly') {
      return data.daysOfWeek && data.daysOfWeek.length > 0;
    }
    if (data.scheduleType === 'daily') {
      return data.frequency && data.frequency.times && data.frequency.times.length > 0;
    }
    return true;
  },
  {
    message: 'Invalid schedule configuration',
    path: ['scheduleType'],
  }
);

export const updateMedicationSchema = z.object({
  name: z.string().min(1).optional(),
  dosage: z.string().min(1).optional(),
  frequency: frequencySchema.optional(),
  scheduleType: z.enum(['daily', 'weekly']).optional(),
  daysOfWeek: z.array(z.string()).optional(),
  startDate: z.string().datetime().or(z.string()).optional(),
  endDate: z.string().datetime().or(z.string()).optional(),
  instructions: z.string().optional(),
  patientId: z.string().optional(),
  prescribedBy: z.string().optional(),
}).refine(
  (data) => {
    if (data.scheduleType === 'weekly') {
      return data.daysOfWeek && data.daysOfWeek.length > 0;
    }
    if (data.scheduleType === 'daily') {
      return data.frequency && data.frequency.times && data.frequency.times.length > 0;
    }
    return true;
  },
  {
    message: 'Invalid schedule configuration',
    path: ['scheduleType'],
  }
);

export const validateCreateMedication = validate(createMedicationSchema);
export const validateUpdateMedication = validate(updateMedicationSchema);
