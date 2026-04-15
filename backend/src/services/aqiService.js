import { query } from '../config/db.js';

const round2 = (value) => Math.round(value * 100) / 100;

const hashZone = (zone) => {
  const seed = `${zone.id}:${zone.zone_code}:${zone.zone_name}`;
  let total = 0;
  for (const char of seed) total += char.charCodeAt(0);
  return total;
};

const buildAqiReading = (zone) => {
  const hash = hashZone(zone);
  const isDemoZone = /velachery/i.test(zone.zone_name) || zone.zone_code === 'CHN-VEL';

  if (isDemoZone) {
    return {
      aqi: 212,
      source: 'mock-aqi-demo',
      raw_payload: {
        provider: 'mock-aqi-demo',
        zone_code: zone.zone_code,
        aqi: 212,
        condition: 'severe',
      },
    };
  }

  const aqi = Math.min(320, 40 + (hash % 170));
  return {
    aqi: round2(aqi),
    source: 'mock-aqi-adapter',
    raw_payload: {
      provider: 'mock-aqi-adapter',
      zone_code: zone.zone_code,
      aqi,
      condition: aqi >= 200 ? 'severe' : aqi >= 101 ? 'moderate' : 'good',
    },
  };
};

export const fetchAqiSnapshotForZone = async (zone) => {
  const reading = buildAqiReading(zone);

  const { rows } = await query(
    `INSERT INTO aqi_snapshots
       (zone_id, aqi, source, raw_payload)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [zone.id, reading.aqi, reading.source, JSON.stringify(reading.raw_payload)]
  );

  return rows[0];
};

export const getLatestAqiSnapshots = async () => {
  const { rows } = await query(
    `SELECT DISTINCT ON (zone_id) *
     FROM aqi_snapshots
     ORDER BY zone_id, recorded_at DESC`
  );
  return rows;
};