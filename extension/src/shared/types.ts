// Kept in sync by hand with backend/src/schemas/eventBatch.schema.ts — no shared
// package at this size, just don't let the two drift silently.

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export type Verdict =
  | 'accepted'
  | 'wrong_answer'
  | 'tle'
  | 'runtime_error'
  | 'compile_error'
  | 'other';

export interface ProblemMetadata {
  slug: string;
  title: string;
  difficulty: Difficulty;
  tags: string[];
}

export interface AttemptEvent {
  eventId: string;
  problem: ProblemMetadata;
  activeSeconds: number;
  verdict: Verdict;
  submissionCount: number;
  quality?: number | null; // 1-5, filled in by the post-submission popup (M3)
  attemptedAt: string; // ISO timestamp
}
