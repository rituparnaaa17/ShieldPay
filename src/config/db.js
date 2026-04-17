import pg from "pg";
import { config } from "./env.js";
import { logger } from "../utils/logger.js";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Required for Neon
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // 10s — Neon serverless needs time to wake up
});

pool.on("error", (err) => {
  logger.error("Unexpected DB pool error", {
    error: err.message,
  });
});

export const query = (text, params) => pool.query(text, params);

export const getClient = async () => pool.connect();

export const testConnection = async () => {
  const client = await pool.connect();
  client.release();

  logger.info("PostgreSQL connected successfully", {
    host: config.db.host,
    database: config.db.database,
    port: config.db.port,
  });
};

export default pool;
