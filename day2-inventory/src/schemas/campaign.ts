import { z } from 'zod';

export const CreateCampaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required'),
  discount_type: z.enum(['percentage', 'fixed']),
  discount_value: z.number().positive('Discount value must be > 0'),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
}).refine((data) => data.end_date > data.start_date, {
  message: 'End date must be after start date',
  path: ['end_date'],
});

export const UpdateCampaignSchema = z.object({
  name: z.string().min(1).optional(),
  discount_type: z.enum(['percentage', 'fixed']).optional(),
  discount_value: z.number().positive().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  is_active: z.boolean().optional(),
});

export type CreateCampaignInput = z.infer<typeof CreateCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof UpdateCampaignSchema>;
