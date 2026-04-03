import { query } from '../config/db.js';
import { getQuoteById } from './pricingService.js';

export const createPolicy = async ({ quoteId, userId }) => {
  // 1. Fetch and validate quote
  const quote = await getQuoteById(quoteId);
  if (!quote) {
    const err = new Error(`Quote not found: ${quoteId}`);
    err.statusCode = 404;
    throw err;
  }

  // 2. Check quote hasn't expired
  if (new Date(quote.expires_at) < new Date()) {
    const err = new Error('Quote has expired. Please generate a new quote.');
    err.statusCode = 410;
    throw err;
  }

  // 3. Validate userId matches quote (if quote has a user)
  if (quote.user_id && quote.user_id !== userId) {
    const err = new Error('Quote does not belong to this user.');
    err.statusCode = 403;
    throw err;
  }

  // 4. Create policy (7-day validity)
  const { rows } = await query(
    `INSERT INTO policies
       (user_id, quote_id, plan_tier, final_premium, coverage_amount)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, quoteId, quote.plan_tier, quote.final_premium, quote.coverage_amount]
  );

  return rows[0];
};

export const getActivePoliciesByUser = async (userId) => {
  const { rows } = await query(
    `SELECT
       p.*,
       pq.work_type, pq.city, pq.pincode,
       pq.base_premium, pq.loc_risk_surcharge,
       pq.worker_exp_factor, pq.plan_surcharge,
       pq.discount_applied, pq.risk_band,
       z.zone_name, z.zone_code, z.risk_level
     FROM policies p
     JOIN pricing_quotes pq ON pq.id = p.quote_id
     JOIN zones z ON z.id = pq.zone_id
     WHERE p.user_id = $1
       AND p.status = 'active'
       AND p.valid_until > NOW()
     ORDER BY p.created_at DESC`,
    [userId]
  );
  return rows;
};
