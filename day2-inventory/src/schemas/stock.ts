import { z } from 'zod';

export const InboundSchema = z.object({
  product_id: z.number().int().positive(),
  quantity: z.number().int().positive('Quantity must be > 0'),
  unit_cost: z.number().nonnegative('Unit cost must be >= 0'),
  reason: z.string().default('purchase'),
  notes: z.string().default(''),
});

export const OutboundSchema = z.object({
  product_id: z.number().int().positive(),
  quantity: z.number().int().positive('Quantity must be > 0'),
  unit_cost: z.number().nonnegative('Unit cost must be >= 0'),
  reason: z.string().default('sale'),
  reference_id: z.number().int().positive().optional(),
  notes: z.string().default(''),
});

export type InboundInput = z.infer<typeof InboundSchema>;
export type OutboundInput = z.infer<typeof OutboundSchema>;
