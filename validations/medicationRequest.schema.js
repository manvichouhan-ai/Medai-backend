import { z } from 'zod';
import { validate } from './auth.schema.js';

const frequencySchema = z.object({
  times: z.array(z.string().regex(/^\d{2}:\d{2}$/)),
  days: z.array(z.string()),
});

const medicationDataSchema = z.object({
  name: z.string().min(1, 'Medication name is required'),
  dosage: z.string().min(1, 'Dosage is required'),
  frequency: frequencySchema,
  instructions: z.string().optional(),
  startDate: z.string().datetime().or(z.string()),
  endDate: z.string().datetime().or(z.string()).optional(),
});

export const createMedicationRequestSchema = z.object({
  patientId: z.string().optional(),
  type: z.enum(['new_medication', 'dosage_change', 'discontinue'], {
    required_error: 'Request type is required',
  }),
  medicationData: medicationDataSchema,
  notes: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
});

export const approveMedicationRequestSchema = z.object({
  notes: z.string().optional(),
});

export const rejectMedicationRequestSchema = z.object({
  rejectionReason: z.string().min(1, 'Rejection reason is required'),
  notes: z.string().optional(),
});

export const validateCreateMedicationRequest = validate(createMedicationRequestSchema);
export const validateApproveMedicationRequest = validate(approveMedicationRequestSchema);
export const validateRejectMedicationRequest = validate(rejectMedicationRequestSchema);
