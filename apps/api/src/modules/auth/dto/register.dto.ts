import { z } from 'zod';

// Type-only — runtime validation by CRBL (ContractPipe via SchemaRegistry/AJV)
export const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z
    .string()
    .min(8)
    .max(128)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one digit')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  first_name_ar: z.string().min(1).max(100),
  last_name_ar: z.string().min(1).max(100),
  first_name_en: z.string().min(1).max(100).optional(),
  last_name_en: z.string().min(1).max(100).optional(),
  phone: z
    .string()
    .regex(/^\+[1-9]\d{1,14}$/, 'Phone must be in E.164 format')
    .max(20)
    .optional(),
});

export type RegisterDto = z.infer<typeof registerSchema>;
