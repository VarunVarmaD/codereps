-- Distinguishes manually-rated attempts (no real active_seconds — we approximate
-- it with the problem's target_seconds for a neutral time modifier) from
-- extension-captured ones. Mirrors is_backfilled's reasoning (0006). See DECISIONS.md.
ALTER TABLE public.attempts ADD COLUMN is_manual BOOLEAN NOT NULL DEFAULT FALSE;
