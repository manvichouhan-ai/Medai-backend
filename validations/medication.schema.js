import { z } from 'zod';
import { validate } from './auth.schema.js';

const frequencySchema = z.object({
  times: z.array(z.string().regex(/^\d{2}:\d{2}$/)),
  days: z.array(z.string()),
});

export const createMedicationSchema = z.object({
  name: z.string().min(1),
  dosage: z.string().min(1),
  frequency: frequencySchema,
  startDate: z.string().datetime().or(z.string()),
  endDate: z.string().datetime().or(z.string()).optional(),
  instructions: z.string().optional(),
  patientId: z.string().optional(),
  prescribedBy: z.string().optional(),
});

export const updateMedicationSchema = createMedicationSchema.partial();

export const validateCreateMedication = validate(createMedicationSchema);
export const validateUpdateMedication = validate(updateMedicationSchema);
