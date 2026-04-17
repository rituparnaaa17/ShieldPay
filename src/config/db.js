import pg from "pg";
import { config } from "./env.js";
import { logger } from "../utils/logger.js";

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
