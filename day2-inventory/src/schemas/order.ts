import { z } from 'zod';

export const OrderItemInput = z.object({
  product_id: z.number().int().positive(),
  quantity: z.number().int().positive('Quantity must be > 0'),
});

export const CreateOrderSchema = z.object({
  customer_name: z.string().min(1, 'Customer name is required'),
  items: z.array(OrderItemInput).min(1, 'At least one item is required'),
});

export const UpdateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']),
});

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof UpdateOrderStatusSchema>;
