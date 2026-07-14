import { Client } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ Error: DATABASE_URL is not set in your .env file.');
  process.exit(1);
}

const TARGET_SECONDS_BY_DIFFICULTY: Record<string, number> = {
  Easy: 900,
  Medium: 1800,
  Hard: 2700,
};

function slugify(leetcodeUrl: string, name: string): string {
  const match = leetcodeUrl.match(/\/problems\/([^/]+)/);
  return match ? match[1] : name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

async function runSeeder() {
  console.log('🌱 Starting NeetCode 250 Seeder...');

  const jsonPath = path.join(__dirname, 'neetcode_250.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('❌ Error: neetcode_250.json not found at:', jsonPath);
    process.exit(1);
  }

  const rawData = fs.readFileSync(jsonPath, 'utf8');
  const problemsData = JSON.parse(rawData);
  const problems = problemsData.problems;

  if (!Array.isArray(problems)) {
    console.error('❌ Error: Invalid format in neetcode_250.json');
    process.exit(1);
  }

  console.log(`Loaded ${problems.length} problems.`);

  // Metadata only — never store LeetCode's problem content (see DECISIONS.md).
  const mappedProblems = problems.map((p: any) => ({
    title: p.name,
    category: p.category,
    difficulty: p.difficulty,
    leetcode_url: p.leetcode_url,
    leetcode_slug: slugify(p.leetcode_url, p.name),
    tags: [p.category],
    target_seconds: TARGET_SECONDS_BY_DIFFICULTY[p.difficulty] ?? 1800,
  }));

  console.log('🔌 Connecting to Supabase PostgreSQL database...');
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('✅ Connected. Clearing existing problems...');

    // Clear existing problems
    await client.query('TRUNCATE public.problems RESTART IDENTITY CASCADE;');

    console.log('Writing problems to database...');

    for (const p of mappedProblems) {
      await client.query(
        `INSERT INTO public.problems (title, category, difficulty, leetcode_url, leetcode_slug, tags, target_seconds)
         VALUES ($1, $2, $3, $4, $5, $6, $7);`,
        [p.title, p.category, p.difficulty, p.leetcode_url, p.leetcode_slug, p.tags, p.target_seconds]
      );
    }

    console.log(`🎉 Seeding successfully completed! All ${mappedProblems.length} problems loaded.`);
  } catch (err: any) {
    console.error('❌ Database operation failed:', err.message);
  } finally {
    await client.end();
  }
}

runSeeder();
