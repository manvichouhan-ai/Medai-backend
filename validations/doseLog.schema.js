import { z } from 'zod';
import { validate } from './auth.schema.js';

export const takeDoseSchema = z.object({
  notes: z.string().optional(),
});

export const skipDoseSchema = z.object({
  notes: z.string().min(1, 'Notes are required when skipping a dose'),
});

export const validateTakeDose = validate(takeDoseSchema);
export const validateSkipDose = validate(skipDoseSchema);
