import { query } from '../config/db.js';

// ─────────────────────────────────────────────────────────────────────────────
// FIX 1 — In-memory TTL cache (zones change almost never)
// Eliminates a DB round-trip on every single pricing request
// ─────────────────────────────────────────────────────────────────────────────
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const zoneCache = {
  byPincode: new Map(),   // pincode  → { zone, resolvedBy, cachedAt }
  byCity:    new Map(),   // city_key → { zone, resolvedBy, cachedAt }
  default:   null,
};

const isFresh = (entry) => entry && (Date.now() - entry.cachedAt) < CACHE_TTL_MS;

// ─────────────────────────────────────────────────────────────────────────────
// FIX 3 — City alias normalization
// "Bombay" → "Mumbai", "Bengaluru" → "Bangalore", etc.
// ─────────────────────────────────────────────────────────────────────────────
const CITY_ALIASES = {
  bombay:     'Mumbai',
  bengaluru:  'Bangalore',
  calcutta:   'Kolkata',
  madras:     'Chennai',
  'new delhi': 'Delhi',
  ncr:        'Delhi',
  gurugram:   'Delhi',
  gurgaon:    'Delhi',
  noida:      'Delhi',
  'navi mumbai': 'Mumbai',
  thane:      'Mumbai',
};

const normalizeCity = (rawCity) => {
  if (!rawCity) return null;
  const lower = rawCity.trim().toLowerCase();
  return CITY_ALIASES[lower] ?? rawCity.trim();
};

// ─────────────────────────────────────────────────────────────────────────────
// FIX 2 — Haversine distance (km) for lat/lng proximity fallback
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

// Approximate city centres for lat/lng proximity matching
const CITY_CENTROIDS = {
  Mumbai:    { lat: 19.0760, lng: 72.8777 },
  Delhi:     { lat: 28.6139, lng: 77.2090 },
  Bangalore: { lat: 12.9716, lng: 77.5946 },
  Pune:      { lat: 18.5204, lng: 73.8567 },
  Chennai:   { lat: 13.0827, lng: 80.2707 },
  Kolkata:   { lat: 22.5726, lng: 88.3639 },
  Hyderabad: { lat: 17.3850, lng: 78.4867 },
  Ahmedabad: { lat: 23.0225, lng: 72.5714 },
};

const nearestCity = (lat, lng, maxKm = 50) => {
  let best = null;
  let bestDist = Infinity;
  for (const [city, coords] of Object.entries(CITY_CENTROIDS)) {
    const d = haversineKm(lat, lng, coords.lat, coords.lng);
    if (d < bestDist) { bestDist = d; best = city; }
  }
  return bestDist <= maxKm ? best : null;
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN — resolveZone
// Priority: pincode → city (normalized + aliased) → lat/lng → default
// ─────────────────────────────────────────────────────────────────────────────
export const resolveZone = async ({ city, pincode, lat, lng }) => {
  // ── 1. Pincode lookup ──────────────────────────────────────────────────────
  if (pincode) {
    const key = pincode.toString().trim();

    if (isFresh(zoneCache.byPincode.get(key))) {
      return zoneCache.byPincode.get(key);
    }

    const { rows } = await query(
      `SELECT z.*
       FROM pincode_zone_map pzm
       JOIN zones z ON z.id = pzm.zone_id
       WHERE pzm.pincode = $1
       LIMIT 1`,
      [key]
    );

    if (rows.length > 0) {
      const result = { zone: rows[0], resolvedBy: 'pincode', cachedAt: Date.now() };
      zoneCache.byPincode.set(key, result);
      return result;
    }
  }

  // ── 2. City lookup (normalized + alias-aware) ─────────────────────────────
  const resolvedCity = normalizeCity(city);
  if (resolvedCity) {
    const key = resolvedCity.toLowerCase();

    if (isFresh(zoneCache.byCity.get(key))) {
      return zoneCache.byCity.get(key);
    }

    const { rows } = await query(
      `SELECT * FROM zones
       WHERE LOWER(city) = LOWER($1)
       ORDER BY risk_factor DESC
       LIMIT 1`,
      [resolvedCity]
    );

    if (rows.length > 0) {
      const result = { zone: rows[0], resolvedBy: 'city', cachedAt: Date.now() };
      zoneCache.byCity.set(key, result);
      return result;
    }
  }

  // ── 3. Lat/Lng proximity fallback (NOW IMPLEMENTED) ───────────────────────
  if (lat != null && lng != null) {
    const closestCity = nearestCity(parseFloat(lat), parseFloat(lng));
    if (closestCity) {
      const { rows } = await query(
        `SELECT * FROM zones
         WHERE LOWER(city) = LOWER($1)
         ORDER BY risk_factor DESC
         LIMIT 1`,
        [closestCity]
      );
      if (rows.length > 0) {
        return { zone: rows[0], resolvedBy: 'lat_lng' };
      }
    }
  }

  // ── 4. Default zone ────────────────────────────────────────────────────────
  if (isFresh(zoneCache.default)) return zoneCache.default;

  const { rows } = await query(
    `SELECT * FROM zones WHERE zone_code = 'DEFAULT' LIMIT 1`
  );

  if (rows.length === 0) {
    const err = new Error('No default zone configured in DB');
    err.statusCode = 500;
    throw err;
  }

  const result = { zone: rows[0], resolvedBy: 'default', cachedAt: Date.now() };
  zoneCache.default = result;
  return result;
};

// Expose cache-busting for tests / admin reloads
export const clearZoneCache = () => {
  zoneCache.byPincode.clear();
  zoneCache.byCity.clear();
  zoneCache.default = null;
};
