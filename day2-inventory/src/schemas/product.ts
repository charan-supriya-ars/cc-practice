import { z } from 'zod';

export const CreateProductSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().default(''),
  unit_price: z.number().nonnegative('Unit price must be >= 0'),
  cost_price: z.number().nonnegative('Cost price must be >= 0'),
});

export const UpdateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  unit_price: z.number().nonnegative().optional(),
  cost_price: z.number().nonnegative().optional(),
});

export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
