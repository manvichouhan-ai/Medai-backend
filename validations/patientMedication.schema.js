import { z } from 'zod';
import { validate } from './auth.schema.js';

const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

export const assignMedicationSchema = z.object({
  medicationId: z.string().min(1, 'Medication ID is required'),
  dosage: z.string().min(1, 'Dosage is required').max(50, 'Dosage too long'),
  scheduleType: z.enum(['daily', 'weekly'], {
    errorMap: () => ({ message: 'Schedule type must be daily or weekly' })
  }),
  times: z.array(z.string().regex(timeRegex, 'Time must be in HH:mm format (24-hour)')).min(1, 'At least one time is required'),
  daysOfWeek: z.array(z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])).optional(),
  instructions: z.string().max(500, 'Instructions too long').optional(),
  startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).refine((date) => {
    const parsed = new Date(date);
    return !isNaN(parsed.getTime());
  }, 'Invalid start date format'),
  endDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional().refine((date) => {
    if (!date) return true;
    const parsed = new Date(date);
    return !isNaN(parsed.getTime());
  }, 'Invalid end date format'),
}).refine((data) => {
  if (data.scheduleType === 'weekly') {
    return data.daysOfWeek && data.daysOfWeek.length > 0;
  }
  return true;
}, {
  message: 'Days of week are required for weekly schedule',
  path: ['scheduleType'],
}).refine((data) => {
  // Check for duplicate times
  const uniqueTimes = [...new Set(data.times)];
  return uniqueTimes.length === data.times.length;
}, {
  message: 'Duplicate times are not allowed',
  path: ['times'],
}).refine((data) => {
  // Check endDate >= startDate
  if (data.endDate && data.startDate) {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    return end >= start;
  }
  return true;
}, {
  message: 'End date must be after or equal to start date',
  path: ['endDate'],
});

export const updatePatientMedicationSchema = z.object({
  dosage: z.string().min(1, 'Dosage is required').max(50, 'Dosage too long').optional(),
  scheduleType: z.enum(['daily', 'weekly'], {
    errorMap: () => ({ message: 'Schedule type must be daily or weekly' })
  }).optional(),
  times: z.array(z.string().regex(timeRegex, 'Time must be in HH:mm format (24-hour)')).min(1, 'At least one time is required').optional(),
  daysOfWeek: z.array(z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])).optional(),
  instructions: z.string().max(500, 'Instructions too long').optional(),
  startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional().refine((date) => {
    if (!date) return true;
    const parsed = new Date(date);
    return !isNaN(parsed.getTime());
  }, 'Invalid start date format'),
  endDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional().refine((date) => {
    if (!date) return true;
    const parsed = new Date(date);
    return !isNaN(parsed.getTime());
  }, 'Invalid end date format'),
}).refine((data) => {
  if (data.scheduleType === 'weekly' && data.daysOfWeek) {
    return data.daysOfWeek.length > 0;
  }
  if (data.scheduleType === 'daily') {
    return true; // daily doesn't require daysOfWeek
  }
  return true;
}, {
  message: 'Days of week are required for weekly schedule',
  path: ['scheduleType'],
}).refine((data) => {
  if (data.times) {
    const uniqueTimes = [...new Set(data.times)];
    return uniqueTimes.length === data.times.length;
  }
  return true;
}, {
  message: 'Duplicate times are not allowed',
  path: ['times'],
}).refine((data) => {
  if (data.endDate && data.startDate) {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    return end >= start;
  }
  return true;
}, {
  message: 'End date must be after or equal to start date',
  path: ['endDate'],
});

export const validateAssignMedication = validate(assignMedicationSchema);
export const validateUpdatePatientMedication = validate(updatePatientMedicationSchema);
