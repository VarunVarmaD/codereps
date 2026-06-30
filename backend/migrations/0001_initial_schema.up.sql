-- Create Problems Table
CREATE TABLE IF NOT EXISTS public.problems (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    difficulty VARCHAR(50) NOT NULL,
    description TEXT,
    leetcode_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Spaced Repetition tracking state linked to Supabase auth.users
CREATE TABLE IF NOT EXISTS public.spaced_repetition_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    problem_id INTEGER NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
    interval_days INTEGER NOT NULL DEFAULT 1,
    ease_factor NUMERIC(4, 2) NOT NULL DEFAULT 2.50,
    repetition_count INTEGER NOT NULL DEFAULT 0,
    due_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure a user only tracks a problem once
    CONSTRAINT unique_user_problem UNIQUE (user_id, problem_id)
);

-- Create Timeline History Log for review audits
CREATE TABLE IF NOT EXISTS public.timeline_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    problem_id INTEGER NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
    grade INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 5),
    interval_days INTEGER NOT NULL,
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexing optimizations for deliberate query patterns
CREATE INDEX IF NOT EXISTS idx_sr_items_user_due ON public.spaced_repetition_items (user_id, due_at) WHERE enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_timeline_user_date ON public.timeline_history (user_id, reviewed_at DESC);
