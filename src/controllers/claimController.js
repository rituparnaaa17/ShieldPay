import { asyncHandler, createError } from '../utils/errorHandler.js';
import { getAllClaims, getClaimsForUser, softConfirmClaim } from '../services/claimService.js';

export const getMyClaims = asyncHandler(async (req, res) => {
  const userId = req.headers['x-user-id'] || req.query.user_id;
  if (!userId) throw createError('x-user-id header or user_id query param is required.', 400);

  const claims = await getClaimsForUser(String(userId));

  res.status(200).json({
    success: true,
    count: claims.length,
    data: claims,
  });
});

export const postSoftConfirmClaim = asyncHandler(async (req, res) => {
  const { claim_id, confirmation } = req.body;

  if (!claim_id) throw createError('claim_id is required.', 400);
  if (typeof confirmation !== 'boolean') throw createError('confirmation must be a boolean.', 400);

  const claim = await softConfirmClaim({ claimId: claim_id, confirmation });

  res.status(200).json({
    success: true,
    data: claim,
  });
});

export const getAllClaimsHandler = asyncHandler(async (_req, res) => {
  const claims = await getAllClaims();

  res.status(200).json({
    success: true,
    count: claims.length,
    data: claims,
  });
});