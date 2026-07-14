import { z } from 'zod';

export const addProblemSchema = z.object({
  leetcodeUrl: z.string().url(),
});

export type AddProblemInput = z.infer<typeof addProblemSchema>;
