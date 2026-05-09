import { z } from 'zod';
import { validate } from './auth.schema.js';

export const takeDoseSchema = z.object({
  notes: z.string().optional(),
});

export const skipDoseSchema = z.object({
  notes: z.string().min(1, 'Notes are required when skipping a dose'),
});

export const assistDoseSchema = z.object({
  assistanceNotes: z.string().optional(),
});

export const confirmDoseSchema = z.object({
  notes: z.string().optional(),
});

export const disputeDoseSchema = z.object({
  disputeReason: z.string().min(1, 'Dispute reason is required'),
  notes: z.string().optional(),
});

export const validateTakeDose = validate(takeDoseSchema);
export const validateSkipDose = validate(skipDoseSchema);
export const validateAssistDose = validate(assistDoseSchema);
export const validateConfirmDose = validate(confirmDoseSchema);
export const validateDisputeDose = validate(disputeDoseSchema);
