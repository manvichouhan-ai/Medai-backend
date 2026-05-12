import { z } from 'zod';
import { validate } from './auth.schema.js';

export const createMasterMedicationSchema = z.object({
  name: z.string().min(1, 'Medication name is required').max(100, 'Name too long'),
  genericName: z.string().min(1, 'Generic name is required').max(100, 'Generic name too long'),
  category: z.string().min(1, 'Category is required').max(50, 'Category too long'),
  strength: z.string().min(1, 'Strength is required').max(20, 'Strength too long'),
  form: z.enum(['tablet', 'capsule', 'liquid', 'injection', 'inhaler', 'patch', 'cream', 'ointment', 'drops', 'spray'], {
    errorMap: () => ({ message: 'Invalid medication form' })
  }),
  manufacturer: z.string().min(1, 'Manufacturer is required').max(100, 'Manufacturer too long'),
  description: z.string().max(500, 'Description too long').optional(),
  sideEffects: z.array(z.string().max(100, 'Side effect too long')).max(20, 'Too many side effects').optional(),
});

export const updateMasterMedicationSchema = createMasterMedicationSchema.partial();

export const validateCreateMasterMedication = validate(createMasterMedicationSchema);
export const validateUpdateMasterMedication = validate(updateMasterMedicationSchema);
