-- v1 pivot: extension-instrumented practice instead of in-app curriculum/workspace.
-- See DECISIONS.md for context. Renames/backfills in place rather than drop+recreate,
-- since dev data already exists in these tables.

-- 1. problems: metadata only from here on (never store LeetCode's problem content).
ALTER TABLE public.problems ADD COLUMN IF NOT EXISTS leetcode_slug VARCHAR(255);
ALTER TABLE public.problems ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE public.problems ADD COLUMN IF NOT EXISTS target_seconds INTEGER;

UPDATE public.problems
SET leetcode_slug = COALESCE(
  substring(leetcode_url from '/problems/([^/]+)'),
  lower(regexp_replace(title, '[^a-zA-Z0-9]+', '-', 'g'))
)
WHERE leetcode_slug IS NULL;

UPDATE public.problems SET tags = ARRAY[category] WHERE tags IS NULL;

UPDATE public.problems
SET target_seconds = CASE difficulty
  WHEN 'Easy' THEN 900
  WHEN 'Hard' THEN 2700
  ELSE 1800
END
WHERE target_seconds IS NULL;

ALTER TABLE public.problems ALTER COLUMN leetcode_slug SET NOT NULL;
ALTER TABLE public.problems ADD CONSTRAINT problems_leetcode_slug_key UNIQUE (leetcode_slug);
ALTER TABLE public.problems ALTER COLUMN target_seconds SET NOT NULL;
ALTER TABLE public.problems DROP COLUMN IF EXISTS description;

-- 2. spaced_repetition_items -> review_states
ALTER TABLE public.spaced_repetition_items RENAME TO review_states;
ALTER TABLE public.review_states RENAME COLUMN repetition_count TO repetitions;
ALTER TABLE public.review_states DROP COLUMN IF EXISTS enabled;
ALTER TABLE public.review_states DROP COLUMN IF EXISTS last_duration_seconds;
ALTER TABLE public.review_states RENAME CONSTRAINT unique_user_problem TO review_states_user_problem_key;

DROP INDEX IF EXISTS idx_sr_items_user_due;
CREATE INDEX IF NOT EXISTS idx_review_states_user_due ON public.review_states (user_id, due_at);

-- 3. timeline_history -> attempts
ALTER TABLE public.timeline_history RENAME TO attempts;

ALTER TABLE public.attempts ADD COLUMN IF NOT EXISTS event_id UUID;
UPDATE public.attempts SET event_id = gen_random_uuid() WHERE event_id IS NULL;
ALTER TABLE public.attempts ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.attempts ADD CONSTRAINT attempts_event_id_key UNIQUE (event_id);

ALTER TABLE public.attempts ADD COLUMN IF NOT EXISTS verdict TEXT;
UPDATE public.attempts SET verdict = 'accepted' WHERE verdict IS NULL;
ALTER TABLE public.attempts ALTER COLUMN verdict SET NOT NULL;
ALTER TABLE public.attempts ADD CONSTRAINT attempts_verdict_check
  CHECK (verdict IN ('accepted', 'wrong_answer', 'tle', 'runtime_error', 'compile_error', 'other'));

ALTER TABLE public.attempts ADD COLUMN IF NOT EXISTS submission_count INTEGER;
ALTER TABLE public.attempts RENAME COLUMN duration_seconds TO active_seconds;

ALTER TABLE public.attempts DROP CONSTRAINT IF EXISTS timeline_history_grade_check;
ALTER TABLE public.attempts RENAME COLUMN grade TO quality;
ALTER TABLE public.attempts ALTER COLUMN quality DROP NOT NULL;
-- Quality is a 1-5 rating from the extension's post-submission popup (see design doc).
-- The ported SM-2 function translates quality -> its internal 0-4 scale at the
-- boundary; the stored value stays 1-5 to match what the UI actually collects.
ALTER TABLE public.attempts ADD CONSTRAINT attempts_quality_check
  CHECK (quality IS NULL OR quality BETWEEN 1 AND 5);

ALTER TABLE public.attempts DROP COLUMN IF EXISTS interval_days;
ALTER TABLE public.attempts RENAME COLUMN reviewed_at TO attempted_at;

DROP INDEX IF EXISTS idx_timeline_user_date;
CREATE INDEX IF NOT EXISTS idx_attempts_user_date ON public.attempts (user_id, attempted_at DESC);

-- 4. Extension pairing/auth
CREATE TABLE IF NOT EXISTS public.extension_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_extension_tokens_user ON public.extension_tokens (user_id);

CREATE TABLE IF NOT EXISTS public.pairing_codes (
    code TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pairing_codes_user ON public.pairing_codes (user_id);
