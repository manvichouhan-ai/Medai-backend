import { z } from 'zod';
import { sendError } from '../src/utils/response.utils.js';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
  role: z.enum(['patient', 'caregiver', 'doctor', 'admin']).optional(),
  phone: z.string().optional(),
  timezone: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
      return sendError(res, message, 400);
    }
    req.body = result.data;
    next();
  };
}
