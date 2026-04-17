import { query, getClient } from "../config/db.js";

const UNIQUE_VIOLATION = "23505";

const createHttpError = (message, statusCode, extra = {}) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
};

const mapConstraintError = (error) => {
  if (error?.code !== UNIQUE_VIOLATION) return error;

  if (error.constraint === "idx_policies_quote_id_unique") {
    return createHttpError(
      "This quote has already been used to create a policy.",
      409,
    );
  }

  if (error.constraint === "idx_policies_one_active_per_plan") {
    return createHttpError(
      "You already have an active policy for this plan tier.",
      409,
    );
  }

  return error;
};

// ─────────────────────────────────────────────────────────────────────────────
// CREATE POLICY
// Production hardening:
// - transaction-safe
// - quote row locked
// - quote can only be used once ever
// - optional anonymous quote gets bound to first claimant
// ─────────────────────────────────────────────────────────────────────────────
export const createPolicy = async ({ quoteId, userId }) => {
  const client = await getClient();

  try {
    await client.query("BEGIN");

    // Lock the quote row so concurrent requests cannot race on the same quote
    const { rows: quoteRows } = await client.query(
      `
      SELECT
        id,
        user_id,
        plan_tier,
        final_premium,
        coverage_amount,
        expires_at,
        quote_used_at
      FROM pricing_quotes
      WHERE id = $1
      FOR UPDATE
      `,
      [quoteId],
    );

    if (quoteRows.length === 0) {
      throw createHttpError(`Quote not found: ${quoteId}`, 404);
    }

    const quote = quoteRows[0];

    if (new Date(quote.expires_at) < new Date()) {
      throw createHttpError(
        "Quote has expired. Please generate a new quote.",
        410,
      );
    }

    // If quote already belongs to someone else, reject
    if (quote.user_id && quote.user_id !== userId) {
      throw createHttpError("Quote does not belong to this user.", 403);
    }

    // If quote is anonymous, bind it to the first user who creates a policy from it
    if (!quote.user_id) {
      await client.query(
        `
        UPDATE pricing_quotes
        SET user_id = $1
        WHERE id = $2 AND user_id IS NULL
        `,
        [userId, quoteId],
      );
      quote.user_id = userId;
    }

    // Hard stop: once used, always used
    if (quote.quote_used_at) {
      throw createHttpError(
        "This quote has already been used to create a policy.",
        409,
      );
    }

    // Lock matching active policy rows for this user+plan if present
    const { rows: existing } = await client.query(
      `
      SELECT id, policy_number, valid_until
      FROM policies
      WHERE user_id = $1
        AND plan_tier = $2
        AND status = 'active'
        AND valid_until > NOW()
      LIMIT 1
      FOR UPDATE
      `,
      [userId, quote.plan_tier],
    );

    if (existing.length > 0) {
      throw createHttpError(
        `You already have an active ${quote.plan_tier} policy (${existing[0].policy_number}), valid until ${new Date(existing[0].valid_until).toLocaleDateString("en-IN")}. Cancel it first or wait for it to expire.`,
        409,
        { existingPolicy: existing[0] },
      );
    }

    const { rows: inserted } = await client.query(
      `
      INSERT INTO policies
        (user_id, quote_id, plan_tier, final_premium, coverage_amount)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [
        userId,
        quoteId,
        quote.plan_tier,
        quote.final_premium,
        quote.coverage_amount,
      ],
    );

    const policy = inserted[0];

    // Mark quote as consumed forever
    await client.query(
      `
      UPDATE pricing_quotes
      SET quote_used_at = NOW()
      WHERE id = $1
      `,
      [quoteId],
    );

    await client.query("COMMIT");
    return policy;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw mapConstraintError(error);
  } finally {
    client.release();
  }
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
    [userId],
  );
  return rows;
};

// ─────────────────────────────────────────────────────────────────────────────
// CANCEL POLICY
// ─────────────────────────────────────────────────────────────────────────────
export const cancelPolicy = async ({ policyId, userId }) => {
  const { rows: existing } = await query(
    `SELECT id, status, policy_number
     FROM policies
     WHERE id = $1 AND user_id = $2`,
    [policyId, userId],
  );

  if (existing.length === 0) {
    throw createHttpError("Policy not found.", 404);
  }

  if (existing[0].status !== "active") {
    throw createHttpError(
      `Policy ${existing[0].policy_number} is already ${existing[0].status}.`,
      409,
    );
  }

  const { rows } = await query(
    `UPDATE policies
     SET status = 'cancelled',
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, policy_number, status, updated_at`,
    [policyId],
  );

  return rows[0];
};

// ─────────────────────────────────────────────────────────────────────────────
// RENEW POLICY
// ─────────────────────────────────────────────────────────────────────────────
export const renewPolicy = async ({ policyId, userId }) => {
  const { rows: existing } = await query(
    `SELECT p.*, pq.plan_tier AS q_plan_tier
     FROM policies p
     JOIN pricing_quotes pq ON pq.id = p.quote_id
     WHERE p.id = $1 AND p.user_id = $2`,
    [policyId, userId],
  );

  if (existing.length === 0) {
    throw createHttpError("Policy not found.", 404);
  }

  const policy = existing[0];

  if (policy.status === "cancelled") {
    throw createHttpError(
      "Cancelled policies cannot be renewed. Create a new quote instead.",
      409,
    );
  }

  const now = new Date();
  const validUntil = new Date(policy.valid_until);
  const diffDays = (validUntil - now) / (1000 * 60 * 60 * 24);

  if (diffDays > 2) {
    throw createHttpError(
      `Policy can only be renewed within 2 days of expiry. Your policy is valid for ${Math.ceil(diffDays)} more days.`,
      409,
    );
  }

  if (diffDays < -3) {
    throw createHttpError(
      "Policy expired more than 3 days ago. Please generate a new quote.",
      410,
    );
  }

  const { rows } = await query(
    `UPDATE policies
     SET status = 'active',
         valid_from = NOW(),
         valid_until = NOW() + INTERVAL '7 days',
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [policyId],
  );

  return rows[0];
};
