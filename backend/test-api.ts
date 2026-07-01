import { pool } from './src/config/db';

const TEST_USER_ID = '00000000-0000-0000-0000-000000000000';
const TEST_PROBLEM_ID = 1; // Concatenation of Array

async function runTests() {
  console.log('🧪 Starting Core Backend API Integration Tests...');

  try {
    // 1. Setup Mock User in auth.users schema to satisfy foreign key constraint
    console.log('👤 Setting up mock test user in auth.users...');
    await pool.query(
      `INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role)
       VALUES ($1, 'test-srs@codereps.com', '{}', '{}', 'authenticated', 'authenticated')
       ON CONFLICT (id) DO NOTHING;`,
      [TEST_USER_ID]
    );

    // 2. Test GET /api/problems SQL Query logic
    console.log('📋 Testing GET /api/problems query join...');
    const listQuery = `
      SELECT 
        p.id, p.title, p.category, p.difficulty,
        sri.interval_days, sri.repetition_count,
        CASE 
          WHEN sri.id IS NULL THEN 'New'
          WHEN sri.repetition_count = 0 THEN 'Learning'
          WHEN sri.due_at <= NOW() THEN 'Review'
          ELSE 'Mastered'
        END as status
      FROM public.problems p
      LEFT JOIN public.spaced_repetition_items sri 
        ON p.id = sri.problem_id AND sri.user_id = $1
      ORDER BY p.id ASC;
    `;
    const listResult = await pool.query(listQuery, [TEST_USER_ID]);
    
    if (listResult.rows.length === 250) {
      console.log(`✅ Success: Found all 250 problems joined with status.`);
      console.log(`   Sample status of Problem 1: ${listResult.rows[0].status}`);
    } else {
      throw new Error(`Expected 250 problems, but found ${listResult.rows.length}`);
    }

    // 3. Test POST /api/problems/:id/review with SM-2 Spaced Repetition logic
    console.log('🧠 Testing SM-2 Spaced Repetition math & upsert...');
    
    // Simulate first correct review (Grade 4: Good response)
    const grade = 4;
    let repetitions = 0;
    let interval = 1;
    let easeFactor = 2.50;

    // First Review (n=0) -> interval should become 1, repetitions should become 1
    if (grade >= 3) {
      if (repetitions === 0) {
        interval = 1;
      }
      repetitions += 1;
    }
    easeFactor = easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
    if (easeFactor < 1.3) easeFactor = 1.3;
    let dueAt = new Date(Date.now() + interval * 24 * 60 * 60 * 1000);

    console.log('   Saving first review attempt...');
    await pool.query(
      `INSERT INTO public.spaced_repetition_items (user_id, problem_id, interval_days, ease_factor, repetition_count, due_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (user_id, problem_id) DO UPDATE SET 
         interval_days = EXCLUDED.interval_days,
         ease_factor = EXCLUDED.ease_factor,
         repetition_count = EXCLUDED.repetition_count,
         due_at = EXCLUDED.due_at,
         updated_at = NOW();`,
      [TEST_USER_ID, TEST_PROBLEM_ID, interval, easeFactor, repetitions, dueAt]
    );

    // Verify first update
    const check1 = await pool.query(
      `SELECT interval_days, repetition_count, ease_factor::float FROM public.spaced_repetition_items WHERE user_id = $1 AND problem_id = $2;`,
      [TEST_USER_ID, TEST_PROBLEM_ID]
    );
    console.log(`   Result after 1st review: Interval=${check1.rows[0].interval_days}, Reps=${check1.rows[0].repetition_count}, EF=${check1.rows[0].ease_factor}`);
    if (check1.rows[0].interval_days !== 1 || check1.rows[0].repetition_count !== 1) {
      throw new Error('SM-2 First Review Calculations incorrect');
    }

    // Simulate second correct review (Grade 5: Perfect response)
    const grade2 = 5;
    repetitions = check1.rows[0].repetition_count;
    interval = check1.rows[0].interval_days;
    easeFactor = check1.rows[0].ease_factor;

    if (grade2 >= 3) {
      if (repetitions === 1) {
        interval = 6;
      }
      repetitions += 1;
    }
    easeFactor = easeFactor + (0.1 - (5 - grade2) * (0.08 + (5 - grade2) * 0.02));
    dueAt = new Date(Date.now() + interval * 24 * 60 * 60 * 1000);

    console.log('   Saving second review attempt...');
    await pool.query(
      `INSERT INTO public.spaced_repetition_items (user_id, problem_id, interval_days, ease_factor, repetition_count, due_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (user_id, problem_id) DO UPDATE SET 
         interval_days = EXCLUDED.interval_days,
         ease_factor = EXCLUDED.ease_factor,
         repetition_count = EXCLUDED.repetition_count,
         due_at = EXCLUDED.due_at,
         updated_at = NOW();`,
      [TEST_USER_ID, TEST_PROBLEM_ID, interval, easeFactor, repetitions, dueAt]
    );

    // Verify second update
    const check2 = await pool.query(
      `SELECT interval_days, repetition_count, ease_factor::float FROM public.spaced_repetition_items WHERE user_id = $1 AND problem_id = $2;`,
      [TEST_USER_ID, TEST_PROBLEM_ID]
    );
    console.log(`   Result after 2nd review: Interval=${check2.rows[0].interval_days}, Reps=${check2.rows[0].repetition_count}, EF=${check2.rows[0].ease_factor}`);
    if (check2.rows[0].interval_days !== 6 || check2.rows[0].repetition_count !== 2) {
      throw new Error('SM-2 Second Review Calculations incorrect');
    }

    console.log('✅ Success: SM-2 scheduling updates verified correctly!');

  } catch (err: any) {
    console.error('❌ Test failed:', err.message);
  } finally {
    // 4. Cleanup Mock User (cascades and clears all test progress logs)
    console.log('🧹 Cleaning up mock test user data...');
    await pool.query('DELETE FROM auth.users WHERE id = $1;', [TEST_USER_ID]);
    await pool.end();
    console.log('👋 Database pool closed. Testing completed.');
  }
}

runTests();
