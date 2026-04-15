import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'password',
  connectionTimeoutMillis: 3000,
});

try {
  const res = await pool.query('SELECT version()');
  console.log('✅ DB connected:', res.rows[0].version.split(' ').slice(0,2).join(' '));
  
  // Check if shieldpay DB exists
  const dbCheck = await pool.query("SELECT datname FROM pg_database WHERE datname = 'shieldpay'");
  if (dbCheck.rows.length > 0) {
    console.log('✅ shieldpay database exists');
  } else {
    console.log('⚠️  shieldpay database does NOT exist — will create it');
    await pool.query('CREATE DATABASE shieldpay');
    console.log('✅ shieldpay database created');
  }
} catch (e) {
  console.error('❌ DB ERROR:', e.message);
} finally {
  await pool.end();
}
