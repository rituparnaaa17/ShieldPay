import { query } from "../config/db.js";
import crypto from "crypto";

const RISK_THRESHOLDS = {
  low: 20,
  medium: 40,
  high: 70,
  very_high: 90,
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. DEVICE & IP VERIFICATION
// ─────────────────────────────────────────────────────────────────────────────

export const checkVPNAndProxy = async (ipAddress) => {
  /**
   * Integration with IP quality service (AbuseIPDB, MaxMind, IPQualityScore)
   * Returns: { isVPN, isProxy, threat_score }
   *
   * For now, returning mock. In production:
   * const response = await fetch('https://api.abuseipdb.com/api/v2/check', {
   *   headers: { Key: process.env.ABUSEIPDB_API_KEY },
   *   body: { ipAddress }
   * });
   */

  // Mock implementation - replace with real API
  const blockedVPNRanges = ["8.8.8.0/24", "1.1.1.0/24"]; // Example
  const threatScore = Math.random() * 100;

  return {
    isVPN: threatScore > 70,
    isProxy: threatScore > 50,
    threatScore: Math.round(threatScore),
    provider: threatScore > 70 ? "NordVPN" : "Unknown",
  };
};

export const recordDeviceFingerprint = async (userId, deviceData) => {
  const {
    deviceId,
    deviceName,
    osName,
    browserName,
    ipAddress,
    ipCountry,
    ipCity,
  } = deviceData;

  const { isVPN, isProxy } = await checkVPNAndProxy(ipAddress);

  const hashedDeviceId = crypto
    .createHash("sha256")
    .update(deviceId)
    .digest("hex");

  const { rows } = await query(
    `INSERT INTO device_fingerprints
       (user_id, device_id, device_name, os_name, browser_name,
        ip_address, ip_country, ip_city, is_vpn, is_proxy)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (user_id, device_id) DO UPDATE
     SET last_seen = NOW()
     RETURNING *`,
    [
      userId,
      hashedDeviceId,
      deviceName,
      osName,
      browserName,
      ipAddress,
      ipCountry,
      ipCity,
      isVPN,
      isProxy,
    ],
  );

  return rows[0];
};

export const checkLocationMismatch = async (
  userId,
  currentCity,
  currentCountry,
  workerCity,
) => {
  const { rows } = await query(
    `SELECT ip_country, ip_city, last_seen FROM device_fingerprints
     WHERE user_id = $1
     ORDER BY last_seen DESC
     LIMIT 10`,
    [userId],
  );

  if (rows.length === 0) return { mismatch: false, warnings: [] };

  const lastLocation = rows[0];
  const warnings = [];
  let riskScore = 0;

  // Check country mismatch
  if (lastLocation.ip_country && lastLocation.ip_country !== currentCountry) {
    const timeDiff =
      (Date.now() - new Date(lastLocation.last_seen).getTime()) / 1000 / 3600; // hours
    // Impossible travel: if crossing countries in < 2 hours, it's suspicious
    if (timeDiff < 2) {
      warnings.push(
        `Impossible travel: ${lastLocation.ip_country} → ${currentCountry} in ${timeDiff.toFixed(1)}h`,
      );
      riskScore += 30;
    }
  }

  // Check if worker is claiming from different city than registered
  if (
    currentCity &&
    workerCity &&
    currentCity.toLowerCase() !== workerCity.toLowerCase()
  ) {
    warnings.push(
      `Location mismatch: Registered in ${workerCity}, accessing from ${currentCity}`,
    );
    riskScore += 15;
  }

  return {
    mismatch: warnings.length > 0,
    riskScore,
    warnings,
    lastLocation,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. IDENTITY DUPLICATION DETECTION
// ─────────────────────────────────────────────────────────────────────────────

export const checkIdentityDuplication = async (
  identifierHash,
  identifierType,
) => {
  /**
   * identifierType: 'aadhaar' | 'pan' | 'dl'
   * Returns: { isDuplicate, duplicateCount, otherUsers }
   */

  const columnName = `${identifierType}_hash`;

  const { rows } = await query(
    `SELECT COUNT(*) as count, user_id
     FROM identity_verification
     WHERE ${columnName} = $1 AND ${columnName} IS NOT NULL
     GROUP BY user_id`,
    [identifierHash],
  );

  const isDuplicate = rows.length > 1;
  const duplicateCount = rows.length;

  return {
    isDuplicate,
    duplicateCount,
    otherUsers: rows.filter((r) => r.user_id).map((r) => r.user_id),
  };
};

export const checkBeneficiaryFraud = async (userId, accountNumber) => {
  /**
   * Multiple workers using the same beneficiary account = red flag
   */

  const { rows } = await query(
    `SELECT COUNT(DISTINCT user_id) as unique_users, array_agg(DISTINCT user_id) as user_ids
     FROM beneficiary_accounts
     WHERE account_number = $1`,
    [accountNumber],
  );

  const uniqueUsers = rows[0]?.unique_users || 0;
  const userIds = rows[0]?.user_ids || [];

  return {
    isFraudRisk: uniqueUsers > 1,
    linkedUserCount: uniqueUsers,
    linkedUsers: userIds,
    riskScore: uniqueUsers > 1 ? (uniqueUsers - 1) * 20 : 0,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. CLAIM VELOCITY & POLICY STACKING
// ─────────────────────────────────────────────────────────────────────────────

export const checkClaimVelocity = async (userId, timeWindowDays = 30) => {
  /**
   * Flags if user is claiming too frequently (suspicious pattern)
   */

  const { rows: claimRows } = await query(
    `SELECT COUNT(*) as claim_count, MAX(submitted_at) as latest_claim
     FROM claim_activity
     WHERE user_id = $1
       AND submitted_at > NOW() - INTERVAL '${timeWindowDays} days'`,
    [userId],
  );

  const claimCount = parseInt(claimRows[0]?.claim_count || 0);
  const latestClaim = claimRows[0]?.latest_claim;

  // More than 2 claims in 30 days is suspicious
  const isSuspicious = claimCount > 2;
  const riskScore = Math.min(isSuspicious ? claimCount * 15 : 0, 40);

  return {
    claimCount,
    latestClaim,
    isSuspicious,
    riskScore,
    message: isSuspicious
      ? `${claimCount} claims in ${timeWindowDays} days`
      : "Normal claim frequency",
  };
};

export const checkPolicyStacking = async (userId) => {
  /**
   * Multiple active policies = potential fraud (policy stacking)
   */

  const { rows } = await query(
    `SELECT COUNT(*) as active_count, array_agg(id) as policy_ids
     FROM policies
     WHERE user_id = $1
       AND status = 'active'
       AND valid_until > NOW()`,
    [userId],
  );

  const activeCount = parseInt(rows[0]?.active_count || 0);
  const policyIds = rows[0]?.policy_ids || [];

  return {
    activeCount,
    policyIds,
    isStackingRisk: activeCount > 1,
    riskScore: activeCount > 1 ? (activeCount - 1) * 25 : 0,
  };
};

export const checkPolicyCoolingOff = async (policyId) => {
  /**
   * Claims within 48 hours of policy creation are flagged
   * (people buying policy right before filing claim)
   */

  const { rows } = await query(
    `SELECT p.created_at, NOW() - INTERVAL '48 hours' as older_than_48h
     FROM policies p
     WHERE p.id = $1`,
    [policyId],
  );

  if (!rows[0]) return { isWithinCoolingOff: false, riskScore: 0 };

  const createdAt = new Date(rows[0].created_at);
  const nowMinus48h = new Date(rows[0].older_than_48h);
  const isWithinCoolingOff = createdAt > nowMinus48h;

  return {
    isWithinCoolingOff,
    hoursSinceCreation: (Date.now() - createdAt) / 1000 / 3600,
    riskScore: isWithinCoolingOff ? 40 : 0,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. INCOME & PROFILE OUTLIER DETECTION
// ─────────────────────────────────────────────────────────────────────────────

export const checkIncomeOutlier = async (workType, reportedIncome) => {
  /**
   * Check if reported income is statistical outlier for work type
   * (catches people lying about income for discounts)
   */

  const { rows } = await query(
    `SELECT
       AVG(avg_weekly_income) as avg_income,
       STDDEV(avg_weekly_income) as stddev_income,
       COUNT(*) as sample_size
     FROM worker_profiles
     WHERE work_type = $1`,
    [workType],
  );

  if (!rows[0] || rows[0].sample_size < 50) {
    return { isOutlier: false, riskScore: 0, reason: "Insufficient data" };
  }

  const { avg_income, stddev_income, sample_size } = rows[0];
  const zScore = Math.abs((reportedIncome - avg_income) / stddev_income);

  // > 3 standard deviations = 99.7% confidence it's an outlier
  const isOutlier = zScore > 3;
  const riskScore = isOutlier ? Math.min(zScore * 10, 30) : 0;

  return {
    isOutlier,
    zScore: zScore.toFixed(2),
    avgIncomeForWorkType: Math.round(avg_income),
    reportedIncome,
    riskScore,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. KYC & VERIFICATION STATUS
// ─────────────────────────────────────────────────────────────────────────────

export const getKYCStatus = async (userId) => {
  const { rows } = await query(
    `SELECT kyc_status, verified_by, verification_date, rejection_reason
     FROM identity_verification
     WHERE user_id = $1`,
    [userId],
  );

  if (!rows[0]) {
    return {
      kycStatus: "pending",
      isVerified: false,
      riskScore: 30, // Unverified users get extra risk
    };
  }

  const { kyc_status, verified_by, verification_date } = rows[0];

  return {
    kycStatus: kyc_status,
    isVerified: kyc_status === "verified",
    verifiedBy: verified_by,
    verificationDate: verification_date,
    riskScore:
      kyc_status === "verified" ? 0 : kyc_status === "rejected" ? 50 : 20,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. COMPREHENSIVE FRAUD RISK SCORING
// ─────────────────────────────────────────────────────────────────────────────

export const calculateFraudRiskScore = async (userId, userContext = {}) => {
  const {
    currentCity = null,
    currentCountry = "IN",
    workerCity = null,
    planTier = "basic",
    income = null,
    workType = null,
  } = userContext;

  let scores = {
    kycScore: 0,
    locationScore: 0,
    deviceScore: 0,
    velocityScore: 0,
    duplicateScore: 0,
  };

  const flags = [];

  // 1. KYC Check
  const kycCheck = await getKYCStatus(userId);
  scores.kycScore = kycCheck.riskScore;
  if (!kycCheck.isVerified) {
    flags.push({
      type: "unverified_kyc",
      severity: "medium",
      desc: `KYC Status: ${kycCheck.kycStatus}`,
    });
  }

  // 2. Location Check
  if (currentCity && workerCity) {
    const locationCheck = await checkLocationMismatch(
      userId,
      currentCity,
      currentCountry,
      workerCity,
    );
    scores.locationScore = locationCheck.riskScore;
    if (locationCheck.mismatch) {
      flags.push({
        type: "location_mismatch",
        severity: locationCheck.riskScore > 25 ? "high" : "medium",
        desc: locationCheck.warnings.join("; "),
      });
    }
  }

  // 3. Device & VPN Check
  if (userContext.deviceData) {
    const fingerprint = await recordDeviceFingerprint(
      userId,
      userContext.deviceData,
    );
    if (fingerprint.is_vpn || fingerprint.is_proxy) {
      scores.deviceScore = 35;
      flags.push({
        type: "vpn_detected",
        severity: "high",
        desc: `VPN/Proxy detected: ${fingerprint.is_vpn ? "VPN" : "Proxy"}`,
      });
    }
  }

  // 4. Claim Velocity
  const velocityCheck = await checkClaimVelocity(userId, 30);
  scores.velocityScore = velocityCheck.riskScore;
  if (velocityCheck.isSuspicious) {
    flags.push({
      type: "claim_velocity",
      severity: "high",
      desc: velocityCheck.message,
    });
  }

  // 5. Policy Stacking
  const stackingCheck = await checkPolicyStacking(userId);
  if (stackingCheck.isStackingRisk) {
    scores.velocityScore += stackingCheck.riskScore;
    flags.push({
      type: "policy_stacking",
      severity: "high",
      desc: `${stackingCheck.activeCount} active policies detected`,
    });
  }

  // 6. Income Outlier
  if (income && workType) {
    const incomeCheck = await checkIncomeOutlier(workType, income);
    if (incomeCheck.isOutlier) {
      scores.duplicateScore += incomeCheck.riskScore; // Use this slot
      flags.push({
        type: "income_outlier",
        severity: "medium",
        desc: `Income ${incomeCheck.zScore}σ above mean for ${workType}`,
      });
    }
  }

  // Calculate overall score (weighted)
  const weights = {
    kycScore: 0.25,
    locationScore: 0.25,
    deviceScore: 0.2,
    velocityScore: 0.2,
    duplicateScore: 0.1,
  };

  const overallScore =
    scores.kycScore * weights.kycScore +
    scores.locationScore * weights.locationScore +
    scores.deviceScore * weights.deviceScore +
    scores.velocityScore * weights.velocityScore +
    scores.duplicateScore * weights.duplicateScore;

  // Determine risk level
  let riskLevel = "low";
  let actionRequired = null;

  if (overallScore >= RISK_THRESHOLDS.very_high) {
    riskLevel = "very_high";
    actionRequired = "block";
  } else if (overallScore >= RISK_THRESHOLDS.high) {
    riskLevel = "high";
    actionRequired = "request_verification";
  } else if (overallScore >= RISK_THRESHOLDS.medium) {
    riskLevel = "medium";
    actionRequired = flags.length > 0 ? "manual_review" : null;
  }

  // Save to database
  await query(
    `INSERT INTO fraud_risk_scores
       (user_id, overall_score, kyc_score, location_score, device_score,
        velocity_score, duplicate_score, risk_level, action_required)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (user_id) DO UPDATE SET
       overall_score = $2,
       kyc_score = $3,
       location_score = $4,
       device_score = $5,
       velocity_score = $6,
       duplicate_score = $7,
       risk_level = $8,
       action_required = $9,
       last_updated = NOW()`,
    [
      userId,
      Math.round(overallScore * 100) / 100,
      Math.round(scores.kycScore * 100) / 100,
      Math.round(scores.locationScore * 100) / 100,
      Math.round(scores.deviceScore * 100) / 100,
      Math.round(scores.velocityScore * 100) / 100,
      Math.round(scores.duplicateScore * 100) / 100,
      riskLevel,
      actionRequired,
    ],
  );

  return {
    userId,
    overallScore: Math.round(overallScore * 100) / 100,
    scores,
    riskLevel,
    actionRequired,
    flags,
    recommendation:
      actionRequired === "block"
        ? "❌ Policy blocked due to high fraud risk"
        : actionRequired === "request_verification"
          ? "⚠️ Require additional identity verification"
          : actionRequired === "manual_review"
            ? "🔍 Manual review recommended"
            : "✅ Low risk - proceed",
  };
};

export default {
  checkVPNAndProxy,
  recordDeviceFingerprint,
  checkLocationMismatch,
  checkIdentityDuplication,
  checkBeneficiaryFraud,
  checkClaimVelocity,
  checkPolicyStacking,
  checkPolicyCoolingOff,
  checkIncomeOutlier,
  getKYCStatus,
  calculateFraudRiskScore,
};
