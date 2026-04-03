import pg from 'pg';
import { config } from './env.js';

const { Pool } = pg;

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err.message);
});

export const query = (text, params) => pool.query(text, params);

export const testConnection = async () => {
  const client = await pool.connect();
  client.release();
  console.log('✅ PostgreSQL connected successfully');
};

export default pool;
