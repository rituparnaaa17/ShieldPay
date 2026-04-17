import pg from "pg";
import "dotenv/config";

const { Client } = pg;

console.log("Testing connection to:", process.env.DB_HOST);
console.log("DATABASE_URL set:", !!process.env.DATABASE_URL);

// Test 1: via DATABASE_URL
const client1 = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

try {
  console.log("\n[Test 1] Connecting via DATABASE_URL...");
  await client1.connect();
  const res = await client1.query("SELECT NOW() as time");
  console.log("✅ DATABASE_URL connected! Server time:", res.rows[0].time);
  await client1.end();
} catch (err) {
  console.error("❌ DATABASE_URL failed:", err.message);
}

// Test 2: via individual vars
const client2 = new Client({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

try {
  console.log("\n[Test 2] Connecting via individual vars...");
  await client2.connect();
  const res = await client2.query("SELECT NOW() as time");
  console.log("✅ Individual vars connected! Server time:", res.rows[0].time);
  await client2.end();
} catch (err) {
  console.error("❌ Individual vars failed:", err.message);
}
