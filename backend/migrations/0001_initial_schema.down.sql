-- Drop Timeline History Log Indexes and Table
DROP INDEX IF EXISTS public.idx_timeline_user_date;
DROP TABLE IF EXISTS public.timeline_history;

-- Drop Spaced Repetition Items Indexes and Table
DROP INDEX IF EXISTS public.idx_sr_items_user_due;
DROP TABLE IF EXISTS public.spaced_repetition_items;

-- Drop Problems Table
DROP TABLE IF EXISTS public.problems;
