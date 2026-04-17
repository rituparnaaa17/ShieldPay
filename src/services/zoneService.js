import { query } from "../config/db.js";

// ─────────────────────────────────────────────────────────────────────────────
// In-memory TTL cache
// NOTE: single-instance cache only. In multi-instance deployments,
// each process maintains its own cache.
// ─────────────────────────────────────────────────────────────────────────────
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const zoneCache = {
  byPincode: new Map(),
  byCity: new Map(),
  default: null,
};

const isFresh = (entry) => entry && Date.now() - entry.cachedAt < CACHE_TTL_MS;

// ─────────────────────────────────────────────────────────────────────────────
// Current alias source of truth
// NOTE: Keep in code for now. Consolidate in Phase 5 if DB alias table is used.
// ─────────────────────────────────────────────────────────────────────────────
const CITY_ALIASES = {
  bombay: "Mumbai",
  bengaluru: "Bangalore",
  calcutta: "Kolkata",
  madras: "Chennai",
  "new delhi": "Delhi",
  ncr: "Delhi",
  gurugram: "Delhi",
  gurgaon: "Delhi",
  noida: "Delhi",
  "navi mumbai": "Mumbai",
  thane: "Mumbai",
};

const normalizeCity = (rawCity) => {
  if (!rawCity) return null;
  const trimmed = rawCity.trim();
  const lower = trimmed.toLowerCase();
  return CITY_ALIASES[lower] ?? trimmed;
};

// ─────────────────────────────────────────────────────────────────────────────
// Distance helpers
// ─────────────────────────────────────────────────────────────────────────────
const toRad = (deg) => (deg * Math.PI) / 180;

const haversineKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const CITY_CENTROIDS = {
  Mumbai: { lat: 19.076, lng: 72.8777 },
  Delhi: { lat: 28.6139, lng: 77.209 },
  Bangalore: { lat: 12.9716, lng: 77.5946 },
  Pune: { lat: 18.5204, lng: 73.8567 },
  Chennai: { lat: 13.0827, lng: 80.2707 },
  Kolkata: { lat: 22.5726, lng: 88.3639 },
  Hyderabad: { lat: 17.385, lng: 78.4867 },
  Ahmedabad: { lat: 23.0225, lng: 72.5714 },
};

const nearestCity = (lat, lng, maxKm = 35) => {
  let best = null;
  let bestDist = Infinity;

  for (const [city, coords] of Object.entries(CITY_CENTROIDS)) {
    const d = haversineKm(lat, lng, coords.lat, coords.lng);
    if (d < bestDist) {
      bestDist = d;
      best = city;
    }
  }

  if (bestDist <= maxKm) {
    return { city: best, distanceKm: Number(bestDist.toFixed(2)) };
  }

  return null;
};

const buildResolution = ({
  zone,
  resolvedBy,
  confidence,
  warning = null,
  normalizedCity = null,
  fallbackUsed = false,
  matchedDistanceKm = null,
  cachedAt = Date.now(),
}) => ({
  zone,
  resolvedBy,
  confidence,
  warning,
  normalizedCity,
  fallbackUsed,
  matchedDistanceKm,
  cachedAt,
});

// ─────────────────────────────────────────────────────────────────────────────
// Resolve zone
// Priority: pincode → city → lat/lng → default
// ─────────────────────────────────────────────────────────────────────────────
export const resolveZone = async ({ city, pincode, lat, lng }) => {
  // 1) PINCODE lookup: highest confidence
  if (pincode) {
    const key = pincode.toString().trim();

    if (isFresh(zoneCache.byPincode.get(key))) {
      return zoneCache.byPincode.get(key);
    }

    const { rows } = await query(
      `
      SELECT z.*
      FROM pincode_zone_map pzm
      JOIN zones z ON z.id = pzm.zone_id
      WHERE pzm.pincode = $1
      LIMIT 1
      `,
      [key],
    );

    if (rows.length > 0) {
      const result = buildResolution({
        zone: rows[0],
        resolvedBy: "pincode",
        confidence: "high",
        warning: null,
        fallbackUsed: false,
      });

      zoneCache.byPincode.set(key, result);
      return result;
    }
  }

  // 2) CITY lookup: choose balanced zone, not highest-risk zone
  const normalizedCity = normalizeCity(city);
  if (normalizedCity) {
    const key = normalizedCity.toLowerCase();

    if (isFresh(zoneCache.byCity.get(key))) {
      return zoneCache.byCity.get(key);
    }

    const { rows } = await query(
      `
      SELECT *
      FROM zones
      WHERE LOWER(city) = LOWER($1)
      ORDER BY ABS(risk_factor - (
        SELECT AVG(risk_factor)::numeric
        FROM zones
        WHERE LOWER(city) = LOWER($1)
      )) ASC, risk_factor ASC
      LIMIT 1
      `,
      [normalizedCity],
    );

    if (rows.length > 0) {
      const aliasWasApplied =
        city && normalizedCity.toLowerCase() !== city.trim().toLowerCase();

      const result = buildResolution({
        zone: rows[0],
        resolvedBy: "city",
        confidence: aliasWasApplied ? "medium" : "medium_high",
        warning: aliasWasApplied
          ? `City alias matched: "${city}" → "${normalizedCity}".`
          : null,
        normalizedCity,
        fallbackUsed: false,
      });

      zoneCache.byCity.set(key, result);
      return result;
    }
  }

  // 3) LAT/LNG proximity fallback: medium/low confidence
  if (lat != null && lng != null) {
    const parsedLat = Number(lat);
    const parsedLng = Number(lng);

    if (!Number.isNaN(parsedLat) && !Number.isNaN(parsedLng)) {
      const nearest = nearestCity(parsedLat, parsedLng, 35);

      if (nearest) {
        const { rows } = await query(
          `
          SELECT *
          FROM zones
          WHERE LOWER(city) = LOWER($1)
          ORDER BY ABS(risk_factor - (
            SELECT AVG(risk_factor)::numeric
            FROM zones
            WHERE LOWER(city) = LOWER($1)
          )) ASC, risk_factor ASC
          LIMIT 1
          `,
          [nearest.city],
        );

        if (rows.length > 0) {
          return buildResolution({
            zone: rows[0],
            resolvedBy: "lat_lng",
            confidence: nearest.distanceKm <= 15 ? "medium" : "low_medium",
            warning: `Location matched by nearest city centroid (${nearest.city}, ${nearest.distanceKm} km away).`,
            normalizedCity: nearest.city,
            fallbackUsed: true,
            matchedDistanceKm: nearest.distanceKm,
          });
        }
      }
    }
  }

  // 4) DEFAULT fallback: low confidence + explicit warning
  if (isFresh(zoneCache.default)) {
    return zoneCache.default;
  }

  const { rows } = await query(
    `SELECT * FROM zones WHERE zone_code = 'DEFAULT' LIMIT 1`,
  );

  if (rows.length === 0) {
    const err = new Error("No default zone configured in DB");
    err.statusCode = 500;
    throw err;
  }

  const result = buildResolution({
    zone: rows[0],
    resolvedBy: "default",
    confidence: "low",
    warning:
      "No exact pincode, city, or nearby lat/lng match found. Default zone applied.",
    fallbackUsed: true,
  });

  zoneCache.default = result;
  return result;
};

// Expose cache-busting for tests / admin reloads
export const clearZoneCache = () => {
  zoneCache.byPincode.clear();
  zoneCache.byCity.clear();
  zoneCache.default = null;
};
