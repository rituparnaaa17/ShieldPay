import { query } from "../config/db.js";
import { resolveZone } from "./zoneService.js";

// ─────────────────────────────────────────────────────────────────────────────
// PLAN CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────
const PLAN_CONFIG = {
  basic: {
    surcharge: 0,
    coverageMultiplier: 10,
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

const calcWorkerExpFactor = (yearsExperience = 0) => {
  if (yearsExperience >= 10) return -10;
  if (yearsExperience >= 5) return -5;
  if (yearsExperience >= 2) return 0;
  return 10;
};

const calcIncomeFactor = (avgWeeklyIncome) => {
  if (avgWeeklyIncome <= 2000) return 1.2;
  if (avgWeeklyIncome <= 4000) return 1.1;
  if (avgWeeklyIncome <= 6000) return 1.0;
  if (avgWeeklyIncome <= 10000) return 0.95;
  return 0.9;
};

const calcHoursFactor = (dailyHours) => {
  if (dailyHours <= 4) return 0.85;
  if (dailyHours <= 6) return 0.95;
  if (dailyHours <= 8) return 1.0;
  if (dailyHours <= 10) return 1.1;
  return 1.2;
};

const getRiskBand = (score) => {
  if (score < 1.0) return "very_low";
  if (score < 1.25) return "low";
  if (score < 1.5) return "medium";
  if (score < 1.75) return "high";
  return "very_high";
};

const round2 = (n) => Math.round(n * 100) / 100;

const buildExplanation = ({
  zone,
  resolvedBy,
  confidence,
  warning,
  fallbackUsed,
  normalizedCity,
  matchedDistanceKm,
  workType,
  workTypeFactor,
  incomeFactor,
  hoursFactor,
  workerExpFactor,
  plan,
  planSurcharge,
  discountApplied,
  finalPremium,
  riskBand,
}) => {
  const drivers = [
    `Zone "${zone.zone_name}" in ${zone.city} with risk factor ${parseFloat(zone.risk_factor).toFixed(2)}`,
    `Work type "${workType}" applied factor ${workTypeFactor.toFixed(2)}`,
    `Income factor ${incomeFactor.toFixed(2)} and hours factor ${hoursFactor.toFixed(2)}`,
  ];

  if (workerExpFactor > 0) {
    drivers.push(`New-worker surcharge of ₹${workerExpFactor} applied`);
  } else if (workerExpFactor < 0) {
    drivers.push(
      `Experience discount of ₹${Math.abs(workerExpFactor)} applied`,
    );
  } else {
    drivers.push("No experience adjustment applied");
  }

  if (planSurcharge > 0) {
    drivers.push(`${plan.label} plan surcharge of ₹${planSurcharge} applied`);
  } else {
    drivers.push(`${plan.label} plan has no surcharge`);
  }

  if (discountApplied > 0) {
    drivers.push(`Discount of ₹${discountApplied} applied`);
  }

  const notes = [];

  if (resolvedBy === "pincode") {
    notes.push(
      "Zone was resolved directly from pincode, which is the highest-confidence lookup.",
    );
  }

  if (resolvedBy === "city" && normalizedCity && normalizedCity !== zone.city) {
    notes.push(
      `Input city was normalized to "${normalizedCity}" before pricing.`,
    );
  }

  if (warning) {
    notes.push(warning);
  }

  if (fallbackUsed) {
    notes.push(
      "A fallback resolution path was used instead of an exact pincode match.",
    );
  }

  if (matchedDistanceKm != null) {
    notes.push(
      `Nearest-city centroid match distance: ${matchedDistanceKm} km.`,
    );
  }

  return {
    summary: `Weekly premium is ₹${finalPremium} under the ${plan.label} plan. Zone resolution used ${resolvedBy} lookup with ${confidence ?? "unknown"} confidence, and the final risk band is "${riskBand}".`,
    drivers,
    notes,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PRICING FORMULA
// ─────────────────────────────────────────────────────────────────────────────
export const calculatePremium = async ({
  city,
  pincode,
  lat = null,
  lng = null,
  workType,
  dailyHours,
  avgWeeklyIncome,
  planTier,
  yearsExperience = 0,
  userId = null,
}) => {
  const {
    zone,
    resolvedBy,
    confidence = null,
    warning = null,
    fallbackUsed = false,
    matchedDistanceKm = null,
    normalizedCity = null,
  } = await resolveZone({ city, pincode, lat, lng });

  const plan = PLAN_CONFIG[planTier];
  if (!plan) {
    const err = new Error(`Invalid plan tier: ${planTier}`);
    err.statusCode = 400;
    throw err;
  }

  const workTypeFactor = WORK_TYPE_FACTORS[workType] ?? WORK_TYPE_FACTORS.other;
  const incomeFactor = calcIncomeFactor(avgWeeklyIncome);
  const hoursFactor = calcHoursFactor(dailyHours);

  const basePremium = round2(
    parseFloat(zone.base_premium) * workTypeFactor * incomeFactor * hoursFactor,
  );

  const locRiskSurcharge = round2(
    parseFloat(zone.base_premium) * (parseFloat(zone.risk_factor) - 1),
  );

  const workerExpFactor = calcWorkerExpFactor(yearsExperience);
  const planSurcharge = plan.surcharge;

  const subTotal =
    basePremium + locRiskSurcharge + workerExpFactor + planSurcharge;

  const discountCap = round2((basePremium + locRiskSurcharge) * 0.2);
  let discountApplied = 0;

  if (yearsExperience >= 5) discountApplied += round2(subTotal * 0.05);
  if (avgWeeklyIncome <= 2000) discountApplied += round2(subTotal * 0.03);

  discountApplied = round2(Math.min(discountApplied, discountCap));

  const finalPremium = round2(Math.max(subTotal - discountApplied, 10));

  const coverageAmount = round2(
    Math.min(finalPremium * plan.coverageMultiplier, plan.maxCoverage),
  );

  const riskScore = round2(
    parseFloat(zone.risk_factor) * workTypeFactor * hoursFactor,
  );
  const riskBand = getRiskBand(riskScore);

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
      userId,
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

  const explanation = buildExplanation({
    zone,
    resolvedBy,
    confidence,
    warning,
    fallbackUsed,
    normalizedCity,
    matchedDistanceKm,
    workType,
    workTypeFactor,
    incomeFactor,
    hoursFactor,
    workerExpFactor,
    plan,
    planSurcharge,
    discountApplied,
    finalPremium,
    riskBand,
  });

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
      confidence,
      warning,
      fallbackUsed,
      matchedDistanceKm,
      normalizedCity,
    },
    input: {
      city,
      pincode,
      lat,
      lng,
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
    explanation,
    result: {
      finalPremium,
      coverageAmount,
      planLabel: plan.label,
      currency: "INR",
      period: "weekly",
    },
  };
};

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
