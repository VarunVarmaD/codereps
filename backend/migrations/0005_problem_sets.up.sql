-- Curated problem sets (catalog, shared across all users) — NeetCode 250 becomes
-- the first row in what's designed to hold more sets later. See DECISIONS.md.

CREATE TABLE public.problem_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.problem_set_items (
  set_id UUID NOT NULL REFERENCES public.problem_sets(id) ON DELETE CASCADE,
  problem_id INTEGER NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  PRIMARY KEY (set_id, problem_id)
);
CREATE INDEX idx_problem_set_items_set ON public.problem_set_items (set_id, position);

-- Backfill: every problem seeded so far *is* the NeetCode 250.
INSERT INTO public.problem_sets (slug, name, description)
VALUES ('neetcode-250', 'NeetCode 250', 'The original NeetCode 250 curated interview-prep list.');

INSERT INTO public.problem_set_items (set_id, problem_id, position)
SELECT (SELECT id FROM public.problem_sets WHERE slug = 'neetcode-250'),
       p.id, ROW_NUMBER() OVER (ORDER BY p.id)
FROM public.problems p;
