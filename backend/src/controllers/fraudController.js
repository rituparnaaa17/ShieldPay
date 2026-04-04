import {
  calculateFraudRiskScore,
  checkClaimVelocity,
  checkPolicyCoolingOff,
  checkIdentityDuplication,
  checkBeneficiaryFraud,
} from "../services/fraudService.js";
import { asyncHandler, createError } from "../utils/errorHandler.js";
import { query } from "../config/db.js";
import crypto from "crypto";

// ─────────────────────────────────────────────────────────────────────────────
// Get full fraud risk profile
// ─────────────────────────────────────────────────────────────────────────────
export const getFraudRiskProfile = asyncHandler(async (req, res) => {
  const { user_id } = req.params;
  const { device_data, current_location } = req.body;

  // Validate user exists
  const userCheck = await query("SELECT * FROM users WHERE id = $1", [user_id]);
  if (userCheck.rows.length === 0) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  // Get worker profile for context
  const workerProfile = await query(
    `SELECT * FROM worker_profiles WHERE user_id = $1`,
    [user_id],
  );

  const context = {
    currentCity: current_location?.city,
    currentCountry: current_location?.country || "IN",
    workerCity: workerProfile.rows[0]?.work_type ? null : null,
    workType: workerProfile.rows[0]?.work_type,
    income: workerProfile.rows[0]?.avg_weekly_income,
    deviceData: device_data,
  };

  const riskProfile = await calculateFraudRiskScore(user_id, context);

  res.json({
    success: true,
    data: riskProfile,
    timestamp: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Verify KYC (Upload + verify documents)
// ─────────────────────────────────────────────────────────────────────────────
export const submitKYCDocuments = asyncHandler(async (req, res) => {
  const { user_id } = req.params;
  const { aadhaar_number, pan_number, dl_number } = req.body;

  if (!aadhaar_number && !pan_number && !dl_number) {
    throw createError(400, "Provide at least one document number");
  }

  // Hash the documents (never store raw numbers)
  const aadhaarHash = aadhaar_number
    ? crypto.createHash("sha256").update(aadhaar_number).digest("hex")
    : null;
  const panHash = pan_number
    ? crypto.createHash("sha256").update(pan_number).digest("hex")
    : null;
  const dlHash = dl_number
    ? crypto.createHash("sha256").update(dl_number).digest("hex")
    : null;

  // Check for duplicates
  if (aadhaarHash) {
    const dupCheck = await checkIdentityDuplication(aadhaarHash, "aadhaar");
    if (dupCheck.isDuplicate) {
      throw createError(
        409,
        `This Aadhaar is already registered to another user (${dupCheck.duplicateCount - 1} users)`,
      );
    }
  }

  if (panHash) {
    const dupCheck = await checkIdentityDuplication(panHash, "pan");
    if (dupCheck.isDuplicate) {
      throw createError(409, `This PAN is already registered`);
    }
  }

  // Insert/Update KYC record
  const { rows } = await query(
    `INSERT INTO identity_verification (user_id, kyc_status, aadhaar_hash, pan_hash, dl_hash)
     VALUES ($1, 'pending', $2, $3, $4)
     ON CONFLICT (user_id) DO UPDATE SET
       aadhaar_hash = COALESCE($2, aadhaar_hash),
       pan_hash = COALESCE($3, pan_hash),
       dl_hash = COALESCE($4, dl_hash),
       kyc_status = 'pending'
     RETURNING *`,
    [user_id, aadhaarHash, panHash, dlHash],
  );

  res.json({
    success: true,
    message: "KYC documents submitted for verification",
    data: {
      kycStatus: rows[0].kyc_status,
      submittedAt: rows[0].created_at,
      estimatedVerificationTime: "24-48 hours",
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Verify claim (check for fraud before approving claim)
// ─────────────────────────────────────────────────────────────────────────────
export const verifyClaimFraudRisk = asyncHandler(async (req, res) => {
  const { user_id, policy_id, claim_amount } = req.body;

  if (!user_id || !policy_id || !claim_amount) {
    throw createError(400, "user_id, policy_id, and claim_amount are required");
  }

  const checks = {
    coolingOff: await checkPolicyCoolingOff(policy_id),
    claimVelocity: await checkClaimVelocity(user_id, 30),
    riskScore: await calculateFraudRiskScore(user_id),
  };

  const fraudIndicators = [];
  let shouldBlock = false;

  // Check 1: Cooling-off period
  if (checks.coolingOff.isWithinCoolingOff) {
    fraudIndicators.push({
      indicator: "Claim within 48 hours of policy purchase",
      riskLevel: "medium",
      score: checks.coolingOff.riskScore,
    });
  }

  // Check 2: Claim velocity
  if (checks.claimVelocity.isSuspicious) {
    fraudIndicators.push({
      indicator: `${checks.claimVelocity.claimCount} claims in 30 days (suspicious frequency)`,
      riskLevel: "high",
      score: checks.claimVelocity.riskScore,
    });
  }

  // Check 3: Overall fraud risk
  if (checks.riskScore.overallScore > 70) {
    fraudIndicators.push({
      indicator: `Overall fraud risk score: ${checks.riskScore.overallScore}/100`,
      riskLevel: "very_high",
      score: checks.riskScore.overallScore,
    });
    shouldBlock = true;
  }

  const recommendation = shouldBlock
    ? "BLOCK - High fraud risk detected"
    : fraudIndicators.length > 0
      ? "MANUAL_REVIEW - Some fraud indicators present"
      : "APPROVE - Low fraud risk";

  res.json({
    success: true,
    claimVerification: {
      userId: user_id,
      policyId: policy_id,
      claimAmount: claim_amount,
      recommendation,
      fraudRiskDetected: fraudIndicators.length > 0,
      fraudIndicators,
      detailedScores: {
        overallRisk: checks.riskScore.overallScore,
        claimVelocity: checks.claimVelocity.riskScore,
        coolingOffRisk: checks.coolingOff.riskScore,
      },
    },
    timestamp: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Check beneficiary fraud (multiple workers same account)
// ─────────────────────────────────────────────────────────────────────────────
export const checkBeneficiaryLink = asyncHandler(async (req, res) => {
  const { user_id, account_number } = req.body;

  if (!user_id || !account_number) {
    throw createError(400, "user_id and account_number are required");
  }

  const beneficiaryCheck = await checkBeneficiaryFraud(user_id, account_number);

  res.json({
    success: true,
    data: {
      accountNumber: "****" + account_number.slice(-4), // Mask account number
      linkedWorkerCount: beneficiaryCheck.linkedUserCount,
      isFraudRisk: beneficiaryCheck.isFraudRisk,
      riskScore: beneficiaryCheck.riskScore,
      recommendation: beneficiaryCheck.isFraudRisk
        ? `⚠️ Warning: This account is linked to ${beneficiaryCheck.linkedUserCount} workers`
        : "✅ Account appears to be unique to this user",
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin endpoint: Manual KYC review & approval
// ─────────────────────────────────────────────────────────────────────────────
export const approveKYC = asyncHandler(async (req, res) => {
  const { user_id } = req.params;
  const { verified_by, reviewer_notes, approved } = req.body; // approved = true/false

  if (!verified_by || typeof approved !== "boolean") {
    throw createError(400, "verified_by and approved (boolean) are required");
  }

  const { rows } = await query(
    `UPDATE identity_verification
     SET kyc_status = $1,
         verified_by = $2,
         verification_date = NOW(),
         rejection_reason = $3
     WHERE user_id = $4
     RETURNING *`,
    [
      approved ? "verified" : "rejected",
      verified_by,
      approved ? null : reviewer_notes,
      user_id,
    ],
  );

  if (rows.length === 0) {
    throw createError(404, "KYC record not found for user");
  }

  // Recalculate fraud score after KYC update
  await calculateFraudRiskScore(user_id);

  res.json({
    success: true,
    message: `KYC ${approved ? "approved" : "rejected"}`,
    data: {
      userId: user_id,
      kycStatus: rows[0].kyc_status,
      verifiedBy: rows[0].verified_by,
      verificationDate: rows[0].verification_date,
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin endpoint: Dispute resolution & flag removal
// ─────────────────────────────────────────────────────────────────────────────
export const resolveFraudFlag = asyncHandler(async (req, res) => {
  const { flag_id } = req.params;
  const { resolution, admin_notes } = req.body;

  const { rows } = await query(
    `UPDATE fraud_flags
     SET is_active = FALSE,
         resolved_at = NOW(),
         metadata = jsonb_set(metadata, '{resolution}', $1::jsonb),
         metadata = jsonb_set(metadata, '{admin_notes}', to_jsonb($2::text))
     WHERE id = $3
     RETURNING *`,
    [JSON.stringify(resolution), admin_notes, flag_id],
  );

  if (rows.length === 0) {
    throw createError(404, "Fraud flag not found");
  }

  res.json({
    success: true,
    message: "Fraud flag resolved",
    data: rows[0],
  });
});

export default {
  getFraudRiskProfile,
  submitKYCDocuments,
  verifyClaimFraudRisk,
  checkBeneficiaryLink,
  approveKYC,
  resolveFraudFlag,
};
