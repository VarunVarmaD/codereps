import { z } from 'zod';

export const rateAttemptSchema = z.object({
  quality: z.number().int().min(1).max(5),
});

export type RateAttemptInput = z.infer<typeof rateAttemptSchema>;
