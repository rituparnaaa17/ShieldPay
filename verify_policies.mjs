import pg from 'pg';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve('backend/.env') });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  const { rows } = await pool.query(`SELECT id, phone, name FROM users WHERE phone = '+91 9876543211' LIMIT 1`);
  if (!rows.length) {
    console.log("no user");
    process.exit();
  }
  const userId = rows[0].id;
  console.log("user", userId);
  
  const { rows: policies } = await pool.query(
    'SELECT * FROM policies WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  console.log("policies:", policies);
  process.exit();
}
run();
