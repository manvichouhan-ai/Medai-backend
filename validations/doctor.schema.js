import { z } from 'zod';
import { validate } from './auth.schema.js';

export const resolveAlertSchema = z.object({
  resolutionNotes: z.string().min(1, 'Resolution notes are required'),
});

export const escalateAlertSchema = z.object({
  escalationNotes: z.string().optional(),
});

export const createInterventionSchema = z.object({
  patientId: z.string().optional(),
  assignedTo: z.string().optional(),
  interventionType: z.enum([
    'medication_non_adherence',
    'repeated_disputes',
    'high_risk_prediction',
    'emergency',
    'medication_adjustment',
    'caregiver_request',
  ]),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  reason: z.string().min(1, 'Reason is required'),
  notes: z.string().optional(),
  relatedAlertIds: z.array(z.string()).optional(),
  relatedDoseLogIds: z.array(z.string()).optional(),
  followUpRequired: z.boolean().optional(),
  followUpDate: z.string().optional(),
});

export const validateResolveAlert = validate(resolveAlertSchema);
export const validateEscalateAlert = validate(escalateAlertSchema);
export const validateCreateIntervention = validate(createInterventionSchema);