import { query } from '../config/db.js';

/**
 * Resolve zone by pincode → city fallback → default zone
 * Returns zone row from DB
 */
export const resolveZone = async ({ city, pincode }) => {
  // 1️⃣ Pincode lookup (most precise)
  if (pincode) {
    const { rows } = await query(
      `SELECT z.*
       FROM pincode_zone_map pzm
       JOIN zones z ON z.id = pzm.zone_id
       WHERE pzm.pincode = $1
       LIMIT 1`,
      [pincode.toString().trim()]
    );
    if (rows.length > 0) return { zone: rows[0], resolvedBy: 'pincode' };
  }

  // 2️⃣ City fallback (pick highest-risk zone for the city — safer estimate)
  if (city) {
    const { rows } = await query(
      `SELECT * FROM zones
       WHERE LOWER(city) = LOWER($1)
       ORDER BY risk_factor DESC
       LIMIT 1`,
      [city.trim()]
    );
    if (rows.length > 0) return { zone: rows[0], resolvedBy: 'city' };
  }

  // 3️⃣ Default zone (always exists after seed)
  const { rows } = await query(
    `SELECT * FROM zones WHERE zone_code = 'DEFAULT' LIMIT 1`
  );

  if (rows.length === 0) {
    const err = new Error('No default zone configured in DB');
    err.statusCode = 500;
    throw err;
  }

  return { zone: rows[0], resolvedBy: 'default' };
};
