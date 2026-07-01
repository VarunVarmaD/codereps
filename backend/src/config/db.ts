import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const dbPassword = process.env.SUPABASE_DB_PASSWORD;

if (!dbPassword) {
  console.warn('⚠️ Warning: SUPABASE_DB_PASSWORD is not set in your .env file.');
}

const connectionString = `postgresql://postgres:${dbPassword}@db.qizexxrhvrjdyjzvickl.supabase.co:5432/postgres`;

export const pool = new Pool({
  connectionString: dbPassword ? connectionString : undefined,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle database client:', err.message);
});
