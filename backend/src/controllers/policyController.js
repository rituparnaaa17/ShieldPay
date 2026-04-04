import { createPolicy, getActivePoliciesByUser } from '../services/policyService.js';
import { asyncHandler, createError } from '../utils/errorHandler.js';

// UUID v4 pattern validator
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const createPolicyHandler = asyncHandler(async (req, res) => {
  const { quote_id, user_id } = req.body;

  if (!quote_id)               throw createError('quote_id is required.');
  if (!UUID_REGEX.test(quote_id)) throw createError('quote_id must be a valid UUID.');
  if (!user_id)                throw createError('user_id is required.');
  if (!UUID_REGEX.test(user_id))  throw createError('user_id must be a valid UUID.');

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

export const getUserPolicies = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!userId) throw createError('userId param is required.', 400);

  const policies = await getActivePoliciesByUser(userId);

  res.status(200).json({
    success: true,
    count: policies.length,
    data: policies.map((p) => ({
      policyId:       p.id,
      policyNumber:   p.policy_number,
      planTier:       p.plan_tier,
      status:         p.status,
      workType:       p.work_type,
      city:           p.city,
      pincode:        p.pincode,
      zoneName:       p.zone_name,
      riskLevel:      p.risk_level,
      riskBand:       p.risk_band,
      coverageTriggers: p.coverage_triggers,
      finalPremium:   parseFloat(p.final_premium),
      coverageAmount: parseFloat(p.coverage_amount),
      validFrom:      p.valid_from,
      validUntil:     p.valid_until,
      createdAt:      p.created_at,
    })),
  });
});
