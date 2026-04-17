import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

// Supports DATABASE_URL (Neon) or individual DB_* vars (local)
const poolConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
  : {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT, 10),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: { rejectUnauthorized: false },
    };

const pool = new Pool(poolConfig);

const run = async () => {
  const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  try {
    await pool.query(sql);
    console.log('✅ Schema applied successfully');
  } catch (err) {
    console.error('❌ Schema error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

run();
