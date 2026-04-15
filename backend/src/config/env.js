import 'dotenv/config';

const required = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}

export const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  db: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },
  thresholds: {
    heavyRain: Number(process.env.HEAVY_RAIN_THRESHOLD ?? 25),
    flood: Number(process.env.FLOOD_THRESHOLD ?? 70),
    aqi: Number(process.env.AQI_THRESHOLD ?? 200),
    heatIndex: Number(process.env.HEAT_INDEX_THRESHOLD ?? 40),
  },
  intervals: {
    pollWeatherMinutes: Number(process.env.POLL_WEATHER_INTERVAL_MINUTES ?? 15),
    pollAqiMinutes: Number(process.env.POLL_AQI_INTERVAL_MINUTES ?? 15),
    detectTriggersMinutes: Number(process.env.DETECT_TRIGGER_INTERVAL_MINUTES ?? 5),
    processClaimsMinutes: Number(process.env.PROCESS_CLAIMS_INTERVAL_MINUTES ?? 5),
  },
};
