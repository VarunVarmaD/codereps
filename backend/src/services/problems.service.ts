import { PoolClient } from 'pg';
import { pool } from '../config/db';
import { fetchQuestionData } from './leetcodeMetadata.service';
import { ensureTracked } from './reviewStates.service';

export interface ProblemMetadata {
  slug: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  tags: string[];
}

const TARGET_SECONDS_BY_DIFFICULTY: Record<string, number> = {
  Easy: 900,
  Medium: 1800,
  Hard: 2700,
};

// Any LeetCode problem can show up here, not just a pre-seeded set — first time a
// slug is seen it's inserted, every time after it's refreshed (title/difficulty/
// tags can change on LeetCode's end; target_seconds, once set, is left alone
// rather than reset on every event). Shared by the extension's event-recording
// path (events.service.ts) and the add-by-URL path (addProblemByUrl below).
export async function upsertProblemMetadata(client: PoolClient, problem: ProblemMetadata): Promise<number> {
  const targetSeconds = TARGET_SECONDS_BY_DIFFICULTY[problem.difficulty] ?? 1800;
  const result = await client.query(
    `INSERT INTO public.problems (title, category, difficulty, leetcode_slug, leetcode_url, tags, target_seconds)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (leetcode_slug) DO UPDATE SET
       title = EXCLUDED.title,
       difficulty = EXCLUDED.difficulty,
       tags = EXCLUDED.tags
     RETURNING id;`,
    [
      problem.title,
      problem.tags[0], // `category` predates tag-based modeling; kept NOT NULL, filled from the primary tag.
      problem.difficulty,
      problem.slug,
      `https://leetcode.com/problems/${problem.slug}/`,
      problem.tags,
      targetSeconds,
    ]
  );
  return result.rows[0].id;
}

const LEETCODE_PROBLEM_URL_RE = /\/problems\/([^/]+)/;

export function extractSlugFromLeetCodeUrl(url: string): string | null {
  const match = url.match(LEETCODE_PROBLEM_URL_RE);
  return match ? match[1] : null;
}

export interface AddedProblem {
  id: number;
  slug: string;
  title: string;
  difficulty: string;
  tags: string[];
}

// "Add a problem" always means "and start tracking it" — there's no reason a
// user would add a problem to CodeReps except to work on it.
export async function addProblemByUrl(userId: string, leetcodeUrl: string): Promise<AddedProblem> {
  const slug = extractSlugFromLeetCodeUrl(leetcodeUrl);
  if (!slug) {
    throw new Error(`Could not find a LeetCode problem slug in "${leetcodeUrl}"`);
  }

  const metadata = await fetchQuestionData(slug);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const problemId = await upsertProblemMetadata(client, metadata);
    await ensureTracked(client, userId, problemId);
    await client.query('COMMIT');
    return {
      id: problemId,
      slug: metadata.slug,
      title: metadata.title,
      difficulty: metadata.difficulty,
      tags: metadata.tags,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
