import { query } from '../config/db.js';

const round2 = (value) => Math.round(value * 100) / 100;

const hashZone = (zone) => {
  const seed = `${zone.id}:${zone.zone_code}:${zone.zone_name}`;
  let total = 0;
  for (const char of seed) total += char.charCodeAt(0);
  return total;
};

const buildWeatherReading = (zone) => {
  const hash = hashZone(zone);
  const isDemoZone = /velachery/i.test(zone.zone_name) || zone.zone_code === 'CHN-VEL';

  if (isDemoZone) {
    return {
      rainfall_mm_per_hour: 42,
      heat_index: 37,
      weather_status: 'heavy_rain',
      source: 'mock-weather-demo',
      raw_payload: {
        provider: 'mock-weather-demo',
        zone_code: zone.zone_code,
        rainfall_mm_per_hour: 42,
        heat_index: 37,
        weather_status: 'heavy_rain',
        flood_severity: 84,
      },
    };
  }

  const rainfall_mm_per_hour = round2((hash % 18) + 2);
  const heat_index = round2(28 + (hash % 11));
  const flood_severity = Math.min(100, round2(rainfall_mm_per_hour * 2.1 + (hash % 7)));

  return {
    rainfall_mm_per_hour,
    heat_index,
    weather_status: rainfall_mm_per_hour >= 25 ? 'heavy_rain' : 'clear',
    source: 'mock-weather-adapter',
    raw_payload: {
      provider: 'mock-weather-adapter',
      zone_code: zone.zone_code,
      rainfall_mm_per_hour,
      heat_index,
      flood_severity,
      weather_status: rainfall_mm_per_hour >= 25 ? 'heavy_rain' : 'clear',
    },
  };
};

export const fetchWeatherSnapshotForZone = async (zone) => {
  const reading = buildWeatherReading(zone);

  const { rows } = await query(
    `INSERT INTO weather_snapshots
       (zone_id, rainfall_mm_per_hour, heat_index, weather_status, source, raw_payload)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      zone.id,
      reading.rainfall_mm_per_hour,
      reading.heat_index,
      reading.weather_status,
      reading.source,
      JSON.stringify(reading.raw_payload),
    ]
  );

  return rows[0];
};

export const getLatestWeatherSnapshots = async () => {
  const { rows } = await query(
    `SELECT DISTINCT ON (zone_id) *
     FROM weather_snapshots
     ORDER BY zone_id, recorded_at DESC`
  );
  return rows;
};

export const getAllZones = async () => {
  const { rows } = await query('SELECT * FROM zones ORDER BY zone_name ASC');
  return rows;
};