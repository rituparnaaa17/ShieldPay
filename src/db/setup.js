import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import pg from "pg";
import "dotenv/config";

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const run = async () => {
  const sql = readFileSync(join(__dirname, "schema.sql"), "utf8");

  try {
    await pool.query(sql);
    console.log("✅ Schema applied successfully");
  } catch (err) {
    console.error("❌ Schema error:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

run();
