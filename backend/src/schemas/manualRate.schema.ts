import { z } from 'zod';

export const manualRateSchema = z.object({
  quality: z.number().int().min(1).max(5),
});

export type ManualRateInput = z.infer<typeof manualRateSchema>;
