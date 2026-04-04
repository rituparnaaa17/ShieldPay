import { query } from "../config/db.js";
import { resolveZone } from "./zoneService.js";

// ─────────────────────────────────────────────────────────────────────────────
// PLAN CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────
const PLAN_CONFIG = {
  basic: {
    surcharge: 0,
    coverageMultiplier: 10, // coverage = finalPremium × multiplier
    maxCoverage: 50000,
    label: "Basic",
  },
  standard: {
    surcharge: 25,
    coverageMultiplier: 20,
    maxCoverage: 150000,
    label: "Standard",
  },
  premium: {
    surcharge: 60,
    coverageMultiplier: 35,
    maxCoverage: 500000,
    label: "Premium",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// WORK TYPE RISK FACTORS
// ─────────────────────────────────────────────────────────────────────────────
const WORK_TYPE_FACTORS = {
  construction: 1.4,
  factory: 1.25,
  agriculture: 1.15,
  delivery: 1.1,
  retail: 1.0,
  domestic: 0.9,
  other: 1.05,
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Returns experience adjustment: senior workers get a slight discount */
const calcWorkerExpFactor = (yearsExperience = 0) => {
  if (yearsExperience >= 10) return -10; // ₹10 discount — experienced
  if (yearsExperience >= 5) return -5;
  if (yearsExperience >= 2) return 0;
  return 10; // ₹10 surcharge — new worker, higher risk
};

/** Income factor: lower income → proportionally higher premium need */
const calcIncomeFactor = (avgWeeklyIncome) => {
  if (avgWeeklyIncome <= 2000) return 1.2;
  if (avgWeeklyIncome <= 4000) return 1.1;
  if (avgWeeklyIncome <= 6000) return 1.0;
  if (avgWeeklyIncome <= 10000) return 0.95;
  return 0.9;
};

/** Hours factor: more hours → more exposure */
const calcHoursFactor = (dailyHours) => {
  if (dailyHours <= 4) return 0.85;
  if (dailyHours <= 6) return 0.95;
  if (dailyHours <= 8) return 1.0;
  if (dailyHours <= 10) return 1.1;
  return 1.2;
};

/** Risk band label from final risk score */
const getRiskBand = (score) => {
  if (score < 1.0) return "very_low";
  if (score < 1.25) return "low";
  if (score < 1.5) return "medium";
  if (score < 1.75) return "high";
  return "very_high";
};

const round2 = (n) => Math.round(n * 100) / 100;

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PRICING FORMULA
//
// Weekly Premium = BASE + LOC_RISK + WORKER_EXP + PLAN_SURCHARGE - DISCOUNTS
//
// Where:
//   BASE          = zone.base_premium × work_type_factor × income_factor × hours_factor
//   LOC_RISK      = zone.base_premium × (zone.risk_factor - 1)
//   WORKER_EXP    = flat ±10 based on experience
//   PLAN_SURCHARGE = plan config flat add-on
//   DISCOUNT      = capped at 20% of (BASE + LOC_RISK)
// ─────────────────────────────────────────────────────────────────────────────
export const calculatePremium = async ({
  city,
  pincode,
  workType,
  dailyHours,
  avgWeeklyIncome,
  planTier,
  yearsExperience = 0,
  userId = null,
}) => {
  // ── 1. Resolve zone ──────────────────────────────────────────────────────
  const { zone, resolvedBy } = await resolveZone({ city, pincode });

  const plan = PLAN_CONFIG[planTier];
  if (!plan) {
    const err = new Error(`Invalid plan tier: ${planTier}`);
    err.statusCode = 400;
    throw err;
  }

  // ── 2. Work type factor ───────────────────────────────────────────────────
  const workTypeFactor = WORK_TYPE_FACTORS[workType] ?? WORK_TYPE_FACTORS.other;

  // ── 3. Adjustment factors ─────────────────────────────────────────────────
  const incomeFactor = calcIncomeFactor(avgWeeklyIncome);
  const hoursFactor = calcHoursFactor(dailyHours);

  // ── 4. BASE component ─────────────────────────────────────────────────────
  const basePremium = round2(
    parseFloat(zone.base_premium) * workTypeFactor * incomeFactor * hoursFactor,
  );

  // ── 5. LOC_RISK surcharge ─────────────────────────────────────────────────
  const locRiskSurcharge = round2(
    parseFloat(zone.base_premium) * (parseFloat(zone.risk_factor) - 1),
  );

  // ── 6. WORKER_EXP adjustment ──────────────────────────────────────────────
  const workerExpFactor = calcWorkerExpFactor(yearsExperience);

  // ── 7. PLAN surcharge ─────────────────────────────────────────────────────
  const planSurcharge = plan.surcharge;

  // ── 8. Sub-total before discounts ─────────────────────────────────────────
  const subTotal =
    basePremium + locRiskSurcharge + workerExpFactor + planSurcharge;

  // ── 9. Discount (max 20% of base + loc_risk) ─────────────────────────────
  const discountCap = round2((basePremium + locRiskSurcharge) * 0.2);
  let discountApplied = 0;

  // Example discount rules (extend as needed)
  if (yearsExperience >= 5) discountApplied += round2(subTotal * 0.05); // 5% loyalty
  if (avgWeeklyIncome <= 2000) discountApplied += round2(subTotal * 0.03); // 3% low-income relief

  discountApplied = round2(Math.min(discountApplied, discountCap));

  // ── 10. Final premium ─────────────────────────────────────────────────────
  const finalPremium = round2(Math.max(subTotal - discountApplied, 10)); // floor ₹10

  // ── 11. Coverage amount ───────────────────────────────────────────────────
  const coverageAmount = round2(
    Math.min(finalPremium * plan.coverageMultiplier, plan.maxCoverage),
  );

  // ── 12. Risk band (based on zone risk level + work type adjustment) ────────
  // Start with zone's risk_level, adjust based on work type and hours
  let riskBand = zone.risk_level; // low, medium, high, very_high

  // If construction/factory (higher risk work), bump up one level
  if (
    (workType === "construction" || workType === "factory") &&
    zone.risk_level !== "very_high"
  ) {
    const riskLevelsUp = ["low", "medium", "high", "very_high"];
    const currentIndex = riskLevelsUp.indexOf(zone.risk_level);
    if (currentIndex !== -1 && currentIndex < 3) {
      riskBand = riskLevelsUp[currentIndex + 1];
    }
  }

  // If high daily hours (>10h), and not already very_high, bump up
  if (dailyHours > 10 && riskBand !== "very_high") {
    const riskLevelsUp = ["low", "medium", "high", "very_high"];
    const currentIndex = riskLevelsUp.indexOf(riskBand);
    if (currentIndex !== -1 && currentIndex < 3) {
      riskBand = riskLevelsUp[currentIndex + 1];
    }
  }

  // ── 13. Persist quote ─────────────────────────────────────────────────────
  // Only use userId if it's a valid UUID (optional for quotes)
  const isValidUUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      userId,
    );
  const userIdForDb = isValidUUID ? userId : null;

  const { rows } = await query(
    `INSERT INTO pricing_quotes
       (user_id, zone_id, city, pincode, work_type, daily_hours,
        avg_weekly_income, plan_tier,
        base_premium, loc_risk_surcharge, worker_exp_factor,
        plan_surcharge, discount_applied, final_premium,
        coverage_amount, risk_band)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING id, created_at`,
    [
      userIdForDb,
      zone.id,
      city ?? zone.city,
      pincode ?? null,
      workType,
      dailyHours,
      avgWeeklyIncome,
      planTier,
      basePremium,
      locRiskSurcharge,
      workerExpFactor,
      planSurcharge,
      discountApplied,
      finalPremium,
      coverageAmount,
      riskBand,
    ],
  );

  const savedQuote = rows[0];

  // ── 14. Return full breakdown ──────────────────────────────────────────────
  return {
    quoteId: savedQuote.id,
    createdAt: savedQuote.created_at,
    zone: {
      id: zone.id,
      name: zone.zone_name,
      code: zone.zone_code,
      city: zone.city,
      state: zone.state,
      riskLevel: zone.risk_level,
      riskFactor: parseFloat(zone.risk_factor),
      resolvedBy,
    },
    input: {
      city,
      pincode,
      workType,
      dailyHours,
      avgWeeklyIncome,
      planTier,
      yearsExperience,
    },
    factors: {
      workTypeFactor,
      incomeFactor,
      hoursFactor,
      riskScore,
      riskBand,
    },
    breakdown: {
      basePremium,
      locRiskSurcharge,
      workerExpAdjustment: workerExpFactor,
      planSurcharge,
      discountApplied,
    },
    result: {
      finalPremium,
      coverageAmount,
      planLabel: plan.label,
      currency: "INR",
      period: "weekly",
    },
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// FETCH QUOTE by ID (used by policy creation)
// ─────────────────────────────────────────────────────────────────────────────
export const getQuoteById = async (quoteId) => {
  const { rows } = await query(
    `SELECT pq.*, z.zone_name, z.zone_code, z.city AS zone_city, z.risk_level
     FROM pricing_quotes pq
     JOIN zones z ON z.id = pq.zone_id
     WHERE pq.id = $1`,
    [quoteId],
  );
  return rows[0] ?? null;
};
