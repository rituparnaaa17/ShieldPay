import { Router } from "express";
import {
  getFraudRiskProfile,
  submitKYCDocuments,
  verifyClaimFraudRisk,
  checkBeneficiaryLink,
  approveKYC,
  resolveFraudFlag,
} from "../controllers/fraudController.js";

const router = Router();

// ───────────────────────────────────────────────────────────────────
// User endpoints (can call their own risk profile)
// ───────────────────────────────────────────────────────────────────

// GET /api/fraud/risk-profile/:user_id
router.post("/risk-profile/:user_id", getFraudRiskProfile);

// POST /api/fraud/kyc/:user_id (submit documents)
router.post("/kyc/:user_id", submitKYCDocuments);

// POST /api/fraud/beneficiary-check (check if account is linked to others)
router.post("/beneficiary-check", checkBeneficiaryLink);

// ───────────────────────────────────────────────────────────────────
// Claim verification (called before approving claims)
// ───────────────────────────────────────────────────────────────────

// POST /api/fraud/verify-claim
router.post("/verify-claim", verifyClaimFraudRisk);

// ───────────────────────────────────────────────────────────────────
// Admin endpoints (require authentication)
// ───────────────────────────────────────────────────────────────────

// PATCH /api/fraud/kyc/:user_id/approve (admin reviews KYC)
router.patch("/kyc/:user_id/approve", approveKYC);

// PATCH /api/fraud/flag/:flag_id/resolve (admin resolves fraud flag)
router.patch("/flag/:flag_id/resolve", resolveFraudFlag);

export default router;
