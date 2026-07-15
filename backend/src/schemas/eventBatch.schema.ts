import { z } from 'zod';

export const attemptEventSchema = z.object({
  eventId: z.string().uuid(),
  problem: z.object({
    slug: z.string().min(1),
    title: z.string().min(1),
    difficulty: z.enum(['Easy', 'Medium', 'Hard']),
    tags: z.array(z.string()).min(1),
  }),
  activeSeconds: z.number().int().min(0),
  verdict: z.enum(['accepted', 'wrong_answer', 'tle', 'runtime_error', 'compile_error', 'other']),
  submissionCount: z.number().int().min(0),
  quality: z.number().int().min(1).max(5).nullable().optional(),
  attemptedAt: z.string().datetime(),
  isBackfilled: z.boolean().optional().default(false),
});

export const eventBatchSchema = z.object({
  events: z.array(attemptEventSchema).min(1).max(100),
});

export type AttemptEventInput = z.infer<typeof attemptEventSchema>;
export type EventBatchInput = z.infer<typeof eventBatchSchema>;
