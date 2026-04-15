import { query } from '../config/db.js';
import { getQuoteById } from './pricingService.js';

// ─────────────────────────────────────────────────────────────────────────────
// CREATE POLICY
// FIX 8 — Duplicate guard: a user cannot hold two active policies
//          on the same plan_tier at the same time
// ─────────────────────────────────────────────────────────────────────────────
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

  // 4. FIX 8 — Duplicate guard: reject if active policy exists for same plan_tier
  const { rows: existing } = await query(
    `SELECT id, policy_number, valid_until
     FROM policies
     WHERE user_id = $1
       AND plan_tier = $2
       AND status = 'active'
       AND valid_until > NOW()
     LIMIT 1`,
    [userId, quote.plan_tier]
  );

  if (existing.length > 0) {
    const err = new Error(
      `You already have an active ${quote.plan_tier} policy (${existing[0].policy_number}), ` +
      `valid until ${new Date(existing[0].valid_until).toLocaleDateString('en-IN')}. ` +
      `Cancel it first or wait for it to expire.`
    );
    err.statusCode = 409;
    err.existingPolicy = existing[0];
    throw err;
  }

  // 5. Create policy (7-day validity)
  const { rows } = await query(
    `INSERT INTO policies
       (user_id, quote_id, plan_tier, final_premium, coverage_amount)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, quoteId, quote.plan_tier, quote.final_premium, quote.coverage_amount]
  );

  return rows[0];
};

// ─────────────────────────────────────────────────────────────────────────────
// GET ACTIVE POLICIES FOR USER
// ─────────────────────────────────────────────────────────────────────────────
export const getActivePoliciesByUser = async (userId) => {
  const { rows } = await query(
    `SELECT
       p.*,
       pq.work_type, pq.city, pq.pincode,
       pq.base_premium, pq.loc_risk_surcharge,
       pq.worker_exp_factor, pq.plan_surcharge,
       pq.discount_applied, pq.risk_band,
       pq.seasonal_multiplier,
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

// ─────────────────────────────────────────────────────────────────────────────
// FIX 9 — CANCEL POLICY
// Sets status → 'cancelled'. Does not refund (out of scope here).
// ─────────────────────────────────────────────────────────────────────────────
export const cancelPolicy = async ({ policyId, userId }) => {
  // Verify policy belongs to user and is still active
  const { rows: existing } = await query(
    `SELECT id, status, policy_number FROM policies
     WHERE id = $1 AND user_id = $2`,
    [policyId, userId]
  );

  if (existing.length === 0) {
    const err = new Error('Policy not found.');
    err.statusCode = 404;
    throw err;
  }

  if (existing[0].status !== 'active') {
    const err = new Error(
      `Policy ${existing[0].policy_number} is already ${existing[0].status}.`
    );
    err.statusCode = 409;
    throw err;
  }

  const { rows } = await query(
    `UPDATE policies
     SET status = 'cancelled', updated_at = NOW()
     WHERE id = $1
     RETURNING id, policy_number, status, updated_at`,
    [policyId]
  );

  return rows[0];
};

// ─────────────────────────────────────────────────────────────────────────────
// FIX 10 — RENEW POLICY
// Renews an active or recently expired policy by extending valid_until by 7 days
// from today (not from old expiry — avoids gaps or overlaps).
// Does NOT require a new quote — carries forward the same premium.
// ─────────────────────────────────────────────────────────────────────────────
export const renewPolicy = async ({ policyId, userId }) => {
  // Fetch the policy
  const { rows: existing } = await query(
    `SELECT p.*, pq.plan_tier AS q_plan_tier
     FROM policies p
     JOIN pricing_quotes pq ON pq.id = p.quote_id
     WHERE p.id = $1 AND p.user_id = $2`,
    [policyId, userId]
  );

  if (existing.length === 0) {
    const err = new Error('Policy not found.');
    err.statusCode = 404;
    throw err;
  }

  const policy = existing[0];

  if (policy.status === 'cancelled') {
    const err = new Error('Cancelled policies cannot be renewed. Create a new quote instead.');
    err.statusCode = 409;
    throw err;
  }

  // Only allow renewal if within 2 days of expiry OR already expired (≤ 3 days ago)
  const now        = new Date();
  const validUntil = new Date(policy.valid_until);
  const diffDays   = (validUntil - now) / (1000 * 60 * 60 * 24);

  if (diffDays > 2) {
    const err = new Error(
      `Policy can only be renewed within 2 days of expiry. ` +
      `Your policy is valid for ${Math.ceil(diffDays)} more days.`
    );
    err.statusCode = 409;
    throw err;
  }

  if (diffDays < -3) {
    const err = new Error(
      'Policy expired more than 3 days ago. Please generate a new quote.'
    );
    err.statusCode = 410;
    throw err;
  }

  // Extend 7 days from today
  const { rows } = await query(
    `UPDATE policies
     SET status     = 'active',
         valid_from = NOW(),
         valid_until = NOW() + INTERVAL '7 days',
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [policyId]
  );

  return rows[0];
};
