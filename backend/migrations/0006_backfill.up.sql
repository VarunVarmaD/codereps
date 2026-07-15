-- Distinguishes historically-backfilled attempts (no real active_seconds — we
-- weren't watching them happen) from live-observed ones. See DECISIONS.md.
ALTER TABLE public.attempts ADD COLUMN is_backfilled BOOLEAN NOT NULL DEFAULT FALSE;
