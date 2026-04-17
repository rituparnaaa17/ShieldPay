import "dotenv/config";

// When DATABASE_URL is provided (Neon / cloud), individual DB_* vars are optional
const usingConnectionString = !!process.env.DATABASE_URL;
const required = usingConnectionString
  ? []
  : ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"];

const fail = (message) => {
  console.error(`Config error: ${message}`);
  process.exit(1);
};

const parseRequiredInt = (
  key,
  { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {},
) => {
  const raw = process.env[key];

  if (raw == null || raw === "") {
    fail(`Missing required env var: ${key}`);
  }

  const value = Number(raw);

  if (!Number.isInteger(value)) {
    fail(`${key} must be an integer. Received: ${raw}`);
  }

  if (value < min || value > max) {
    fail(`${key} must be between ${min} and ${max}. Received: ${value}`);
  }

  return value;
};

const parseOptionalInt = (
  key,
  defaultValue,
  { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {},
) => {
  const raw = process.env[key];

  if (raw == null || raw === "") {
    return defaultValue;
  }

  const value = Number(raw);

  if (!Number.isInteger(value)) {
    fail(`${key} must be an integer. Received: ${raw}`);
  }

  if (value < min || value > max) {
    fail(`${key} must be between ${min} and ${max}. Received: ${value}`);
  }

  return value;
};

const parseOptionalNumber = (
  key,
  defaultValue,
  { min = -Infinity, max = Infinity } = {},
) => {
  const raw = process.env[key];

  if (raw == null || raw === "") {
    return defaultValue;
  }

  const value = Number(raw);

  if (Number.isNaN(value)) {
    fail(`${key} must be a valid number. Received: ${raw}`);
  }

  if (value < min || value > max) {
    fail(`${key} must be between ${min} and ${max}. Received: ${value}`);
  }

  return value;
};

for (const key of required) {
  if (!process.env[key]) {
    fail(`Missing required env var: ${key}`);
  }
}

const nodeEnv = process.env.NODE_ENV || "development";
const allowedNodeEnvs = ["development", "test", "production"];

if (!allowedNodeEnvs.includes(nodeEnv)) {
  fail(
    `NODE_ENV must be one of: ${allowedNodeEnvs.join(", ")}. Received: ${nodeEnv}`,
  );
}

export const config = {
  port: parseOptionalInt("PORT", 5000, { min: 1, max: 65535 }),
  nodeEnv,
  db: {
    host: process.env.DB_HOST,
    port: parseRequiredInt("DB_PORT", { min: 1, max: 65535 }),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },
  thresholds: {
    heavyRain: parseOptionalNumber("HEAVY_RAIN_THRESHOLD", 25, { min: 0 }),
    flood: parseOptionalNumber("FLOOD_THRESHOLD", 70, { min: 0 }),
    aqi: parseOptionalNumber("AQI_THRESHOLD", 200, { min: 0 }),
    heatIndex: parseOptionalNumber("HEAT_INDEX_THRESHOLD", 40, { min: 0 }),
  },
  intervals: {
    pollWeatherMinutes: parseOptionalInt("POLL_WEATHER_INTERVAL_MINUTES", 15, {
      min: 1,
      max: 1440,
    }),
    pollAqiMinutes: parseOptionalInt("POLL_AQI_INTERVAL_MINUTES", 15, {
      min: 1,
      max: 1440,
    }),
    detectTriggersMinutes: parseOptionalInt(
      "DETECT_TRIGGER_INTERVAL_MINUTES",
      5,
      { min: 1, max: 1440 },
    ),
    processClaimsMinutes: parseOptionalInt(
      "PROCESS_CLAIMS_INTERVAL_MINUTES",
      5,
      { min: 1, max: 1440 },
    ),
  },
};
