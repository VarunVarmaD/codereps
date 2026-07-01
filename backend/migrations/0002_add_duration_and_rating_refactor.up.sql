-- Alter spaced_repetition_items
ALTER TABLE public.spaced_repetition_items ADD COLUMN IF NOT EXISTS last_duration_seconds INTEGER DEFAULT NULL;
ALTER TABLE public.spaced_repetition_items ALTER COLUMN ease_factor SET DEFAULT 2.00;

-- Alter timeline_history
ALTER TABLE public.timeline_history DROP CONSTRAINT IF EXISTS timeline_history_grade_check;
ALTER TABLE public.timeline_history ADD CONSTRAINT timeline_history_grade_check CHECK (grade BETWEEN 0 AND 4);
ALTER TABLE public.timeline_history ADD COLUMN IF NOT EXISTS duration_seconds INTEGER DEFAULT NULL;
