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

export const createPatientSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  age: z.number().min(0).max(150, 'Invalid age'),
  gender: z.enum(['male', 'female', 'other']),
  phone: z.string().min(1, 'Phone number is required'),
  conditions: z.array(z.string()).default([]),
  emergencyContact: z.object({
    name: z.string().min(1, 'Emergency contact name is required'),
    phone: z.string().min(1, 'Emergency contact phone is required'),
    relationship: z.string().min(1, 'Emergency contact relationship is required'),
  }),
});

export const createCaregiverSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(80, 'Full name must be at most 80 characters'),
  email: z.string().email('Invalid email format').max(255, 'Email must be at most 255 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(72, 'Password must be at most 72 characters'),
  phone: z.string().max(40, 'Phone must be at most 40 characters').optional(),
  relationship: z.string().max(60, 'Relationship must be at most 60 characters').optional(),
  address: z.string().max(255, 'Address must be at most 255 characters').optional(),
});

export const assignCaregiverSchema = z.object({
  caregiverId: z.string().min(1, 'Caregiver ID is required'),
  relationship: z.string().optional(),
});

export const validateResolveAlert = validate(resolveAlertSchema);
export const validateEscalateAlert = validate(escalateAlertSchema);
export const validateCreateIntervention = validate(createInterventionSchema);
export const validateCreatePatient = validate(createPatientSchema);
export const validateCreateCaregiver = validate(createCaregiverSchema);
export const validateAssignCaregiver = validate(assignCaregiverSchema);