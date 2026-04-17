import {
  createPolicy,
  getActivePoliciesByUser,
  cancelPolicy,
  renewPolicy,
} from '../services/policyService.js';
import { asyncHandler, createError } from '../utils/errorHandler.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validateUUID = (val, field) => {
  if (!val)                    throw createError(`${field} is required.`);
  if (!UUID_REGEX.test(val))   throw createError(`${field} must be a valid UUID.`);
};

// ── POST /api/policies/create ─────────────────────────────────────────────────
export const createPolicyHandler = asyncHandler(async (req, res) => {
  const { quote_id, user_id } = req.body;
  validateUUID(quote_id, 'quote_id');
  validateUUID(user_id,  'user_id');

  const policy = await createPolicy({ quoteId: quote_id, userId: user_id });

  res.status(201).json({
    success: true,
    data: {
      policyId:       policy.id,
      policyNumber:   policy.policy_number,
      planTier:       policy.plan_tier,
      status:         policy.status,
      finalPremium:   parseFloat(policy.final_premium),
      coverageAmount: parseFloat(policy.coverage_amount),
      validFrom:      policy.valid_from,
      validUntil:     policy.valid_until,
      currency:       'INR',
    },
  });
});

// ── GET /api/policies/:userId ─────────────────────────────────────────────────
export const getUserPolicies = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  validateUUID(userId, 'userId');

  const policies = await getActivePoliciesByUser(userId);

  res.status(200).json({
    success: true,
    count: policies.length,
    data: policies.map((p) => ({
      policyId:           p.id,
      policyNumber:       p.policy_number,
      planTier:           p.plan_tier,
      status:             p.status,
      workType:           p.work_type,
      city:               p.city,
      pincode:            p.pincode,
      zoneName:           p.zone_name,
      riskLevel:          p.risk_level,
      riskBand:           p.risk_band,
      seasonalMultiplier: parseFloat(p.seasonal_multiplier ?? 1),
      finalPremium:       parseFloat(p.final_premium),
      coverageAmount:     parseFloat(p.coverage_amount),
      validFrom:          p.valid_from,
      validUntil:         p.valid_until,
      createdAt:          p.created_at,
    })),
  });
});

// ── PATCH /api/policies/:policyId/cancel ─────────────────────────────────────
export const cancelPolicyHandler = asyncHandler(async (req, res) => {
  const { policyId } = req.params;
  const { user_id }  = req.body;
  validateUUID(policyId, 'policyId');
  validateUUID(user_id,  'user_id');

  const result = await cancelPolicy({ policyId, userId: user_id });

  res.status(200).json({
    success: true,
    message: `Policy ${result.policy_number} has been cancelled.`,
    data: result,
  });
});

// ── PATCH /api/policies/:policyId/renew ──────────────────────────────────────
export const renewPolicyHandler = asyncHandler(async (req, res) => {
  const { policyId } = req.params;
  const { user_id }  = req.body;
  validateUUID(policyId, 'policyId');
  validateUUID(user_id,  'user_id');

  const renewed = await renewPolicy({ policyId, userId: user_id });

  res.status(200).json({
    success: true,
    message: 'Policy renewed for 7 days.',
    data: {
      policyId:       renewed.id,
      policyNumber:   renewed.policy_number,
      status:         renewed.status,
      validFrom:      renewed.valid_from,
      validUntil:     renewed.valid_until,
      finalPremium:   parseFloat(renewed.final_premium),
      coverageAmount: parseFloat(renewed.coverage_amount),
    },
  });
});
