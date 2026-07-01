import { Client } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const dbPassword = process.env.SUPABASE_DB_PASSWORD;
if (!dbPassword) {
  console.error('❌ Error: SUPABASE_DB_PASSWORD is not set in your .env file.');
  process.exit(1);
}

const connectionString = `postgresql://postgres:${dbPassword}@db.qizexxrhvrjdyjzvickl.supabase.co:5432/postgres`;

const query = `
  query questionContent($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
      content
    }
  }
`;

async function fetchDescription(slug: string): Promise<string> {
  try {
    const response = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: JSON.stringify({
        query,
        variables: { titleSlug: slug }
      })
    });
    
    if (!response.ok) {
      return '';
    }
    
    const result: any = await response.json();
    return result?.data?.question?.content || '';
  } catch (err) {
    return '';
  }
}

async function processInBatches<T, R>(items: T[], batchSize: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(items.length / batchSize)} (Problems ${i + 1} to ${Math.min(i + batchSize, items.length)})...`);
    const batchResults = await Promise.all(batch.map(item => fn(item)));
    results.push(...batchResults);
    // Add a small delay between batches to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  return results;
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

  console.log(`Loaded ${problems.length} problems. Fetching descriptions from LeetCode...`);

  // Batch process fetching descriptions
  const enrichedProblems = await processInBatches(problems, 20, async (p: any) => {
    const match = p.leetcode_url.match(/\/problems\/([^/]+)/);
    const slug = match ? match[1] : p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const description = await fetchDescription(slug);
    return {
      title: p.name,
      category: p.category,
      difficulty: p.difficulty,
      leetcode_url: p.leetcode_url,
      description: description || 'No description available.'
    };
  });

  console.log('🔌 Connecting to Supabase PostgreSQL database...');
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('✅ Connected. Clearing existing problems...');
    
    // Clear existing problems
    await client.query('TRUNCATE public.problems RESTART IDENTITY CASCADE;');
    
    console.log('Writing problems to database...');
    
    // Perform bulk inserts
    for (const p of enrichedProblems) {
      await client.query(
        `INSERT INTO public.problems (title, category, difficulty, description, leetcode_url)
         VALUES ($1, $2, $3, $4, $5);`,
        [p.title, p.category, p.difficulty, p.description, p.leetcode_url]
      );
    }
    
    console.log('🎉 Seeding successfully completed! All 250 problems loaded.');
  } catch (err: any) {
    console.error('❌ Database operation failed:', err.message);
  } finally {
    await client.end();
  }
}

runSeeder();
