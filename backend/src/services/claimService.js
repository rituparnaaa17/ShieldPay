import { query } from '../config/db.js';
import { createError } from '../utils/errorHandler.js';
import {
  doesWorkWindowOverlap,
  estimatePayout,
  hasExistingClaim,
  isPolicyActive,
  isTriggerCovered,
  getEligiblePolicyRowsForTrigger,
} from './eligibilityService.js';
import { listActiveTriggers } from './triggerService.js';

const round2 = (value) => Math.round(value * 100) / 100;

const loadOptionalModule = async (modulePath) => {
  try {
    return await import(modulePath);
  } catch {
    return null;
  }
};

const getFraudTrustHooks = async () => {
  const fraudModule = await loadOptionalModule('../services/fraudService.js');
  const spoofModule = await loadOptionalModule('../services/antiSpoofService.js');

  return {
    evaluateFraud: fraudModule?.evaluateFraud ?? fraudModule?.assessFraud ?? (async (context) => {
      const severity = Number(context.triggerEvent?.severity ?? 0);
      if (severity >= 80) return { fraudScore: 0.18, reviewReason: 'High severity event with verified telemetry' };
      if (severity >= 50) return { fraudScore: 0.35, reviewReason: 'Moderate severity event pending secondary checks' };
      return { fraudScore: 0.72, reviewReason: 'Low confidence event' };
    }),
    evaluateTrust: spoofModule?.evaluateTrust ?? spoofModule?.assessTrust ?? (async (context) => {
      const severity = Number(context.triggerEvent?.severity ?? 0);
      const workOverlap = context.workOverlap ? 12 : -10;
      const base = severity >= 80 ? 78 : severity >= 50 ? 66 : 44;
      return { trustScore: Math.max(0, Math.min(100, base + workOverlap)), reviewReason: 'Mock trust scoring pipeline' };
    }),
  };
};

const createPayoutHook = async ({ claim, policy, triggerEvent }) => {
  if (claim.claim_status === 'paid') {
    return { payoutReference: `PAY-${claim.id.slice(0, 8).toUpperCase()}`, skipped: true };
  }

  return {
    payoutReference: `PAY-${claim.id.slice(0, 8).toUpperCase()}`,
    payoutAmount: Math.min(Number(policy.coverage_amount), Number(claim.payout_amount)),
    triggerType: triggerEvent.trigger_type,
  };
};

const getPolicyPayload = async (policyId) => {
  const { rows } = await query(
    `SELECT
       p.*,
       pq.zone_id,
       pq.work_type,
       pq.city,
       pq.pincode,
       wp.avg_weekly_income,
       wp.daily_hours,
       wp.weekly_active_hours,
       wp.preferred_work_start,
       wp.preferred_work_end
     FROM policies p
     JOIN pricing_quotes pq ON pq.id = p.quote_id
     LEFT JOIN worker_profiles wp ON wp.user_id = p.user_id
     WHERE p.id = $1
     LIMIT 1`,
    [policyId]
  );
  return rows[0] ?? null;
};

const getTriggerPayload = async (triggerEventId) => {
  const { rows } = await query('SELECT * FROM trigger_events WHERE id = $1 LIMIT 1', [triggerEventId]);
  return rows[0] ?? null;
};

const insertClaim = async ({ userId, policyId, triggerEventId, estimatedIncomeLoss, payoutAmount }) => {
  const { rows } = await query(
    `INSERT INTO claims
       (user_id, policy_id, trigger_event_id, claim_status, estimated_income_loss, payout_amount)
     VALUES ($1, $2, $3, 'pending', $4, $5)
     RETURNING *`,
    [userId, policyId, triggerEventId, estimatedIncomeLoss, payoutAmount]
  );
  return rows[0];
};

const updateClaim = async (claimId, patch) => {
  const assignments = [];
  const values = [];

  for (const [key, value] of Object.entries(patch)) {
    values.push(value);
    assignments.push(`${key} = $${values.length}`);
  }

  values.push(claimId);
  const { rows } = await query(
    `UPDATE claims
     SET ${assignments.join(', ')}, updated_at = NOW()
     WHERE id = $${values.length}
     RETURNING *`,
    values
  );

  return rows[0];
};

const evaluateClaimDecision = async ({ claim, policy, triggerEvent, profile, workOverlap }) => {
  const hooks = await getFraudTrustHooks();
  const fraudResult = await hooks.evaluateFraud({ claim, policy, triggerEvent, profile, workOverlap });
  const trustResult = await hooks.evaluateTrust({ claim, policy, triggerEvent, profile, workOverlap });

  const fraudScore = Number(fraudResult?.fraudScore ?? fraudResult?.score ?? 0);
  const trustScore = Number(trustResult?.trustScore ?? trustResult?.score ?? 0);
  const reviewReason = fraudResult?.reviewReason || trustResult?.reviewReason || 'Mock decision pipeline';

  let claimStatus = 'under_review';
  if (trustScore >= 80 && fraudScore < 0.3) {
    claimStatus = 'approved';
  } else if (trustScore >= 50 && trustScore <= 79) {
    claimStatus = 'soft_verification';
  }

  const patch = {
    trust_score: round2(trustScore),
    fraud_score: round2(fraudScore),
    review_reason: reviewReason,
    claim_status: claimStatus,
  };

  let updatedClaim = await updateClaim(claim.id, patch);

  if (claimStatus === 'approved' && updatedClaim.claim_status !== 'paid') {
    const payout = await createPayoutHook({ claim: updatedClaim, policy, triggerEvent });
    updatedClaim = await updateClaim(updatedClaim.id, {
      claim_status: 'paid',
      payout_amount: payout.payoutAmount ?? updatedClaim.payout_amount,
      review_reason: `${reviewReason} | payout:${payout.payoutReference}`,
    });
  }

  return updatedClaim;
};

export const createClaimCandidateForTrigger = async (triggerEvent) => {
  const eligiblePolicies = await getEligiblePolicyRowsForTrigger(triggerEvent.zone_id, triggerEvent.trigger_type);
  const createdClaims = [];

  for (const policy of eligiblePolicies) {
    if (!isPolicyActive(policy, new Date())) continue;
    if (!isTriggerCovered(policy, triggerEvent.trigger_type)) continue;

    const profile = {
      avg_weekly_income: policy.avg_weekly_income,
      daily_hours: policy.daily_hours,
      weekly_active_hours: policy.weekly_active_hours,
      preferred_work_start: policy.preferred_work_start,
      preferred_work_end: policy.preferred_work_end,
    };

    const triggerStart = new Date(triggerEvent.start_time);
    const triggerEnd = new Date(triggerEvent.end_time ?? triggerEvent.updated_at ?? triggerEvent.created_at);
    const workOverlap = doesWorkWindowOverlap(profile, triggerStart, triggerEnd);
    if (!workOverlap) continue;

    const duplicate = await hasExistingClaim(policy.id, triggerEvent.id);
    if (duplicate) continue;

    const { estimatedIncomeLoss, payoutAmount } = estimatePayout(profile, policy, triggerEvent);
    const claim = await insertClaim({
      userId: policy.user_id,
      policyId: policy.id,
      triggerEventId: triggerEvent.id,
      estimatedIncomeLoss,
      payoutAmount,
    });

    const decision = await evaluateClaimDecision({
      claim,
      policy,
      triggerEvent,
      profile,
      workOverlap,
    });

    createdClaims.push(decision);
  }

  return createdClaims;
};

export const processClaimsForActiveTriggers = async () => {
  const triggers = await listActiveTriggers();
  const results = [];

  for (const triggerEvent of triggers) {
    const claims = await createClaimCandidateForTrigger(triggerEvent);
    results.push({ triggerEventId: triggerEvent.id, claims });
  }

  const { rows: pendingClaims } = await query(
    `SELECT * FROM claims
     WHERE claim_status = 'pending'
     ORDER BY created_at ASC`
  );

  for (const claim of pendingClaims) {
    const policy = await getPolicyPayload(claim.policy_id);
    const triggerEvent = await getTriggerPayload(claim.trigger_event_id);
    if (!policy || !triggerEvent) continue;

    const profile = {
      avg_weekly_income: policy.avg_weekly_income,
      daily_hours: policy.daily_hours,
      weekly_active_hours: policy.weekly_active_hours,
      preferred_work_start: policy.preferred_work_start,
      preferred_work_end: policy.preferred_work_end,
    };

    const workOverlap = doesWorkWindowOverlap(profile, new Date(triggerEvent.start_time), new Date(triggerEvent.end_time ?? triggerEvent.updated_at ?? triggerEvent.created_at));
    const updated = await evaluateClaimDecision({ claim, policy, triggerEvent, profile, workOverlap });
    results.push({ claimId: updated.id, status: updated.claim_status });
  }

  return results;
};

export const getClaimsForUser = async (userId) => {
  const { rows } = await query(
    `SELECT c.*, te.trigger_type, te.severity, te.zone_id, z.zone_name, z.zone_code
     FROM claims c
     JOIN trigger_events te ON te.id = c.trigger_event_id
     JOIN policies p ON p.id = c.policy_id
     JOIN pricing_quotes pq ON pq.id = p.quote_id
     JOIN zones z ON z.id = pq.zone_id
     WHERE c.user_id = $1
     ORDER BY c.created_at DESC`,
    [userId]
  );
  return rows;
};

export const getAllClaims = async () => {
  const { rows } = await query(
    `SELECT c.*, te.trigger_type, te.severity, te.zone_id, z.zone_name, z.zone_code
     FROM claims c
     JOIN trigger_events te ON te.id = c.trigger_event_id
     JOIN policies p ON p.id = c.policy_id
     JOIN pricing_quotes pq ON pq.id = p.quote_id
     JOIN zones z ON z.id = pq.zone_id
     ORDER BY c.created_at DESC`
  );
  return rows;
};

export const softConfirmClaim = async ({ claimId, confirmation }) => {
  const { rows } = await query('SELECT * FROM claims WHERE id = $1 LIMIT 1', [claimId]);
  const claim = rows[0];
  if (!claim) throw createError('Claim not found.', 404);

  if (claim.claim_status !== 'soft_verification') {
    throw createError('Claim is not awaiting soft verification.', 409);
  }

  const policy = await getPolicyPayload(claim.policy_id);
  const triggerEvent = await getTriggerPayload(claim.trigger_event_id);
  if (!policy || !triggerEvent) {
    throw createError('Related policy or trigger is missing.', 404);
  }

  if (!confirmation) {
    return updateClaim(claim.id, {
      claim_status: 'under_review',
      review_reason: 'User did not confirm soft verification',
    });
  }

  const trustScore = Number(claim.trust_score ?? 0);
  const fraudScore = Number(claim.fraud_score ?? 0);

  if (trustScore >= 80 && fraudScore < 0.3) {
    const updated = await updateClaim(claim.id, { claim_status: 'approved', review_reason: 'User confirmed soft verification' });
    return updateClaim(updated.id, {
      claim_status: 'paid',
      review_reason: `${updated.review_reason ?? 'User confirmed soft verification'} | payout-confirmed`,
    });
  }

  return updateClaim(claim.id, {
    claim_status: 'under_review',
    review_reason: 'User confirmation received, but claim requires manual review',
  });
};

export const getClaimById = async (claimId) => {
  const { rows } = await query('SELECT * FROM claims WHERE id = $1 LIMIT 1', [claimId]);
  return rows[0] ?? null;
};