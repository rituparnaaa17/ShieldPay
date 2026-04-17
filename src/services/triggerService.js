import { query } from '../config/db.js';
import { config } from '../config/env.js';
import { getLatestAqiSnapshots } from './aqiService.js';
import { getLatestWeatherSnapshots } from './weatherService.js';

const TRIGGER_TYPES = ['HEAVY_RAIN', 'FLOOD', 'SEVERE_AQI', 'HEATWAVE', 'ZONE_SHUTDOWN'];

const parsePayload = (value) => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};

const getFloodSeverity = (weatherSnapshot) => {
  const raw = parsePayload(weatherSnapshot?.raw_payload);
  if (typeof raw.flood_severity === 'number') return raw.flood_severity;
  const rainfall = Number(weatherSnapshot?.rainfall_mm_per_hour ?? 0);
  return Math.min(100, Math.round(rainfall * 2 + (raw.weather_status === 'heavy_rain' ? 15 : 0)));
};

const isZoneShutdown = (zone) => {
  const shutdownZones = (process.env.ZONE_SHUTDOWN_ZONE_CODES ?? '').split(',').map((entry) => entry.trim()).filter(Boolean);
  return shutdownZones.includes(zone.zone_code) || /shutdown/i.test(zone.zone_name);
};

const fetchActiveTrigger = async (zoneId, triggerType) => {
  const { rows } = await query(
    `SELECT *
     FROM trigger_events
     WHERE zone_id = $1
       AND trigger_type = $2
       AND status = 'active'
     ORDER BY created_at DESC
     LIMIT 1`,
    [zoneId, triggerType]
  );
  return rows[0] ?? null;
};

const upsertActiveTrigger = async ({ zoneId, triggerType, severity, source, rawPayload, startTime }) => {
  const existing = await fetchActiveTrigger(zoneId, triggerType);

  if (existing) {
    const { rows } = await query(
      `UPDATE trigger_events
       SET severity = $1,
           end_time = $2,
           source = $3,
           raw_payload = $4,
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [severity, new Date().toISOString(), source, JSON.stringify(rawPayload), existing.id]
    );
    return rows[0];
  }

  const { rows } = await query(
    `INSERT INTO trigger_events
       (zone_id, trigger_type, severity, start_time, end_time, status, source, raw_payload)
     VALUES ($1, $2, $3, $4, $5, 'active', $6, $7)
     RETURNING *`,
    [zoneId, triggerType, severity, startTime ?? new Date().toISOString(), null, source, JSON.stringify(rawPayload)]
  );
  return rows[0];
};

const resolveTrigger = async (existing, source, rawPayload) => {
  if (!existing || existing.status !== 'active') return null;

  const { rows } = await query(
    `UPDATE trigger_events
     SET status = 'resolved',
         end_time = COALESCE(end_time, NOW()),
         source = $1,
         raw_payload = $2,
         updated_at = NOW()
     WHERE id = $3
     RETURNING *`,
    [source, JSON.stringify(rawPayload), existing.id]
  );
  return rows[0];
};

export const getLatestSnapshotsByZone = async () => {
  const [weatherSnapshots, aqiSnapshots, zones] = await Promise.all([
    getLatestWeatherSnapshots(),
    getLatestAqiSnapshots(),
    query('SELECT * FROM zones ORDER BY zone_name ASC'),
  ]);

  const weatherByZone = new Map(weatherSnapshots.map((snapshot) => [snapshot.zone_id, snapshot]));
  const aqiByZone = new Map(aqiSnapshots.map((snapshot) => [snapshot.zone_id, snapshot]));

  return zones.rows.map((zone) => ({
    zone,
    weather: weatherByZone.get(zone.id) ?? null,
    aqi: aqiByZone.get(zone.id) ?? null,
  }));
};

export const evaluateTriggerRules = async () => {
  const zones = await getLatestSnapshotsByZone();
  const results = [];

  for (const { zone, weather, aqi } of zones) {
    const weatherPayload = parsePayload(weather?.raw_payload);
    const aqiPayload = parsePayload(aqi?.raw_payload);
    const floodSeverity = getFloodSeverity(weather);

    const rules = [
      {
        triggerType: 'HEAVY_RAIN',
        active: Number(weather?.rainfall_mm_per_hour ?? 0) >= config.thresholds.heavyRain,
        severity: Number(weather?.rainfall_mm_per_hour ?? 0),
        source: weather?.source ?? 'mock-weather-adapter',
        rawPayload: weatherPayload,
      },
      {
        triggerType: 'FLOOD',
        active: floodSeverity >= config.thresholds.flood,
        severity: floodSeverity,
        source: weather?.source ?? 'mock-weather-adapter',
        rawPayload: { ...weatherPayload, flood_severity: floodSeverity },
      },
      {
        triggerType: 'SEVERE_AQI',
        active: Number(aqi?.aqi ?? 0) >= config.thresholds.aqi,
        severity: Number(aqi?.aqi ?? 0),
        source: aqi?.source ?? 'mock-aqi-adapter',
        rawPayload: aqiPayload,
      },
      {
        triggerType: 'HEATWAVE',
        active: Number(weather?.heat_index ?? 0) >= config.thresholds.heatIndex,
        severity: Number(weather?.heat_index ?? 0),
        source: weather?.source ?? 'mock-weather-adapter',
        rawPayload: weatherPayload,
      },
      {
        triggerType: 'ZONE_SHUTDOWN',
        active: isZoneShutdown(zone),
        severity: isZoneShutdown(zone) ? 100 : 0,
        source: 'mock-zone-shutdown-service',
        rawPayload: { zone_code: zone.zone_code, shutdown: isZoneShutdown(zone) },
      },
    ];

    for (const rule of rules) {
      const existing = await fetchActiveTrigger(zone.id, rule.triggerType);

      if (rule.active) {
        const trigger = await upsertActiveTrigger({
          zoneId: zone.id,
          triggerType: rule.triggerType,
          severity: rule.severity,
          source: rule.source,
          rawPayload: rule.rawPayload,
          startTime: existing?.start_time ?? new Date().toISOString(),
        });
        results.push({ action: existing ? 'updated' : 'created', trigger });
      } else if (existing) {
        const resolved = await resolveTrigger(existing, rule.source, rule.rawPayload);
        if (resolved) results.push({ action: 'resolved', trigger: resolved });
      }
    }
  }

  return results;
};

export const listActiveTriggers = async ({ zoneId = null } = {}) => {
  const params = [];
  let whereClause = `WHERE status = 'active'`;

  if (zoneId) {
    params.push(zoneId);
    whereClause += ` AND zone_id = $${params.length}`;
  }

  const { rows } = await query(
    `SELECT te.*, z.zone_name, z.zone_code, z.city, z.state
     FROM trigger_events te
     JOIN zones z ON z.id = te.zone_id
     ${whereClause}
     ORDER BY te.created_at DESC`,
    params
  );

  return rows;
};

export const listAllTriggers = async () => {
  const { rows } = await query(
    `SELECT te.*, z.zone_name, z.zone_code, z.city, z.state
     FROM trigger_events te
     JOIN zones z ON z.id = te.zone_id
     ORDER BY te.created_at DESC`
  );
  return rows;
};

export const getTriggerById = async (triggerId) => {
  const { rows } = await query('SELECT * FROM trigger_events WHERE id = $1 LIMIT 1', [triggerId]);
  return rows[0] ?? null;
};

export const TRIGGER_TYPES_SUPPORTED = TRIGGER_TYPES;