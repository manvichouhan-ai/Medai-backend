import { z } from 'zod';
import { validate } from './auth.schema.js';

export const alertPreferencesSchema = z.object({
  push: z.boolean().optional(),
  sms: z.boolean().optional(),
  email: z.boolean().optional(),
  thresholdMinutes: z.number().optional(),
});

export const caregiverInviteResponseSchema = z.object({
  relationship: z.string().optional(),
  canEditSchedule: z.boolean().optional(),
  alertPreferences: alertPreferencesSchema.optional(),
});

export const validateInviteResponse = validate(caregiverInviteResponseSchema);

export const noteSchema = z.object({
  message: z.string().min(1),
});

export const validateNote = validate(noteSchema);
