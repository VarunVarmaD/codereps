import { z } from 'zod';

export const pairRequestSchema = z.object({
  code: z.string().length(8),
});

export type PairRequestInput = z.infer<typeof pairRequestSchema>;
