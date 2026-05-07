import { z } from 'zod';

export const CreateShipmentSchema = z.object({
  order_id: z.number().int().positive(),
  carrier: z.string().default(''),
  tracking_number: z.string().optional(),
});

export const UpdateShipmentSchema = z.object({
  tracking_number: z.string().optional(),
  carrier: z.string().optional(),
  status: z.enum(['pending', 'shipped', 'in_transit', 'delivered']).optional(),
});

export type CreateShipmentInput = z.infer<typeof CreateShipmentSchema>;
export type UpdateShipmentInput = z.infer<typeof UpdateShipmentSchema>;
