-- Best-effort reversal. Data dropped in the up migration (problems.description,
-- review_states.enabled/last_duration_seconds, attempts.interval_days) is not
-- recoverable — columns are re-added as nullable placeholders, not repopulated.

DROP TABLE IF EXISTS public.pairing_codes;
DROP TABLE IF EXISTS public.extension_tokens;

DROP INDEX IF EXISTS idx_attempts_user_date;
CREATE INDEX IF NOT EXISTS idx_timeline_user_date ON public.attempts (user_id, attempted_at DESC);

ALTER TABLE public.attempts RENAME COLUMN attempted_at TO reviewed_at;
ALTER TABLE public.attempts ADD COLUMN IF NOT EXISTS interval_days INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.attempts DROP CONSTRAINT IF EXISTS attempts_quality_check;
ALTER TABLE public.attempts RENAME COLUMN quality TO grade;
UPDATE public.attempts SET grade = 0 WHERE grade IS NULL;
ALTER TABLE public.attempts ALTER COLUMN grade SET NOT NULL;
ALTER TABLE public.attempts ADD CONSTRAINT timeline_history_grade_check CHECK (grade BETWEEN 0 AND 4);

ALTER TABLE public.attempts RENAME COLUMN active_seconds TO duration_seconds;
ALTER TABLE public.attempts DROP COLUMN IF EXISTS submission_count;
ALTER TABLE public.attempts DROP CONSTRAINT IF EXISTS attempts_verdict_check;
ALTER TABLE public.attempts DROP COLUMN IF EXISTS verdict;
ALTER TABLE public.attempts DROP CONSTRAINT IF EXISTS attempts_event_id_key;
ALTER TABLE public.attempts DROP COLUMN IF EXISTS event_id;

ALTER TABLE public.attempts RENAME TO timeline_history;

DROP INDEX IF EXISTS idx_review_states_user_due;
CREATE INDEX IF NOT EXISTS idx_sr_items_user_due ON public.review_states (user_id, due_at);

ALTER TABLE public.review_states RENAME CONSTRAINT review_states_user_problem_key TO unique_user_problem;
ALTER TABLE public.review_states ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.review_states ADD COLUMN IF NOT EXISTS last_duration_seconds INTEGER DEFAULT NULL;
ALTER TABLE public.review_states RENAME COLUMN repetitions TO repetition_count;
ALTER TABLE public.review_states RENAME TO spaced_repetition_items;

ALTER TABLE public.problems ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.problems ALTER COLUMN target_seconds DROP NOT NULL;
ALTER TABLE public.problems DROP CONSTRAINT IF EXISTS problems_leetcode_slug_key;
ALTER TABLE public.problems ALTER COLUMN leetcode_slug DROP NOT NULL;
ALTER TABLE public.problems DROP COLUMN IF EXISTS target_seconds;
ALTER TABLE public.problems DROP COLUMN IF EXISTS tags;
ALTER TABLE public.problems DROP COLUMN IF EXISTS leetcode_slug;
