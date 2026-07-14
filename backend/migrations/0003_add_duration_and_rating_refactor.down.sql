ALTER TABLE public.spaced_repetition_items DROP COLUMN IF EXISTS last_duration_seconds;
ALTER TABLE public.spaced_repetition_items ALTER COLUMN ease_factor SET DEFAULT 2.50;

ALTER TABLE public.timeline_history DROP CONSTRAINT IF EXISTS timeline_history_grade_check;
ALTER TABLE public.timeline_history ADD CONSTRAINT timeline_history_grade_check CHECK (grade BETWEEN 1 AND 5);
ALTER TABLE public.timeline_history DROP COLUMN IF EXISTS duration_seconds;
