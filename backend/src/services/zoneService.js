import prisma from '../config/db.js';

// ─────────────────────────────────────────────────────────────────────────────
// ZONE RESOLUTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve zone by pincode → city → fallback to DEFAULT zone
 */
// Common city name aliases (alternate spellings / old names)
const CITY_ALIASES = {
  bengaluru:  'Bengaluru',
  bangalore:  'Bengaluru',
  bombay:     'Mumbai',
  calcutta:   'Kolkata',
  madras:     'Chennai',
  gurgaon:    'Delhi',
  gurugram:   'Delhi',
  noida:      'Delhi',
  faridabad:  'Delhi',
};

export const resolveZone = async ({ city, pincode } = {}) => {
  // 1. Try pincode lookup
  if (pincode) {
    const pincodeMap = await prisma.pincodeZoneMap.findUnique({
      where: { pincode: String(pincode) },
      include: { zone: true },
    });
    if (pincodeMap) return { zone: pincodeMap.zone, resolvedBy: 'pincode' };
  }

  // 2. Normalise city alias before lookup
  const normalised = city
    ? (CITY_ALIASES[city.trim().toLowerCase()] ?? city.trim())
    : null;

  // 3. Try city name match (case-insensitive)
  if (normalised) {
    const zone = await prisma.zone.findFirst({
      where: { city: { contains: normalised, mode: 'insensitive' } },
      orderBy: { riskFactor: 'desc' },
    });
    if (zone) return { zone, resolvedBy: 'city' };
  }

  // 3. Fallback to DEFAULT zone
  const fallback = await prisma.zone.findFirst({
    where: { zoneCode: 'DEFAULT' },
  });
  if (fallback) return { zone: fallback, resolvedBy: 'default' };

  throw Object.assign(new Error('No zone found and no DEFAULT zone configured.'), { statusCode: 500 });
};

/**
 * Get all zones (for frontend dropdowns)
 */
export const getAllZones = async () => {
  return prisma.zone.findMany({ orderBy: { zoneName: 'asc' } });
};

/**
 * Get zones grouped by city
 */
export const getZonesByCity = async (city) => {
  return prisma.zone.findMany({
    where: { city: { contains: city, mode: 'insensitive' } },
    orderBy: { zoneName: 'asc' },
  });
};
