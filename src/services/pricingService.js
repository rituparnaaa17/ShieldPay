import { query } from "../config/db.js";
import { resolveZone } from "./zoneService.js";

// ─────────────────────────────────────────────────────────────────────────────
// PLAN CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────
const PLAN_CONFIG = {
  basic: {
    surcharge: 0,
    coverageMultiplier: 10,
    maxCoverage: 50_000,
    premiumFloor: 40, // FIX 5 — tier-specific floor, not a flat ₹10
    premiumCeil: 75,
    label: "Basic",
  },
  standard: {
    surcharge: 25,
    coverageMultiplier: 20,
    maxCoverage: 150_000,
    premiumFloor: 80,
    premiumCeil: 130,
    label: "Standard",
  },
  premium: {
    surcharge: 60,
    coverageMultiplier: 35,
    maxCoverage: 500_000,
    premiumFloor: 120,
    premiumCeil: 200,
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
// FIX 4 — SEASONAL MULTIPLIER
// India has 3 distinct risk seasons that directly affect gig workers
// ─────────────────────────────────────────────────────────────────────────────
const SEASON_PROFILES = {
  // Southwest monsoon — heavy rain, flooding, delivery/construction badly hit
  monsoon_sw: {
    months: [6, 7, 8, 9],
    multiplier: 1.3,
    label: "Southwest Monsoon",
  },
  // Northeast monsoon — affects Chennai + coastal AP/TN
  monsoon_ne: { months: [10, 11], multiplier: 1.2, label: "Northeast Monsoon" },
  // Winter smog — Delhi, NCR, North India. AQI spikes reduce outdoor worker hours
  smog: { months: [11, 12, 1], multiplier: 1.15, label: "Winter Smog" },
  // Peak summer heat — outdoor work becomes dangerous, heat-stroke risk
  heat: { months: [4, 5], multiplier: 1.1, label: "Summer Heat" },
};

// Cities most affected by each season
const CITY_SEASON_MAP = {
  Delhi: ["smog", "monsoon_sw", "heat"],
  Mumbai: ["monsoon_sw"],
  Chennai: ["monsoon_ne", "heat"],
  Bangalore: ["monsoon_sw"],
  Kolkata: ["monsoon_sw"],
  Pune: ["monsoon_sw"],
  Hyderabad: ["monsoon_sw", "heat"],
};

const getSeasonalMultiplier = (city, month = new Date().getMonth() + 1) => {
  const applicableSeasons = CITY_SEASON_MAP[city] ?? ["monsoon_sw"];
  let highest = 1.0;
  let activeLabel = "Off-Season";

  for (const seasonKey of applicableSeasons) {
    const season = SEASON_PROFILES[seasonKey];
    if (season && season.months.includes(month)) {
      if (season.multiplier > highest) {
        highest = season.multiplier;
        activeLabel = season.label;
      }
    }
  }
  return { multiplier: highest, label: activeLabel };
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

// FIX 6 — Experience adjustment scaled to income (not flat ±₹10)
// A flat ₹10 on a ₹10,000/week worker is 0.1% — meaningless.
// Scale it as a % of base so the adjustment is proportional.
const calcWorkerExpFactor = (yearsExperience = 0, basePremium = 100) => {
  if (yearsExperience >= 10) return round2(basePremium * -0.08); // 8% discount
  if (yearsExperience >= 5) return round2(basePremium * -0.04); // 4% discount
  if (yearsExperience >= 2) return 0;
  return round2(basePremium * 0.07); // 7% surcharge for new workers
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

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PRICING FORMULA
//
// Weekly Premium = (BASE × SEASONAL) + LOC_RISK + WORKER_EXP + PLAN_SURCHARGE
//                 - DISCOUNTS
//                 → clamped to [plan.premiumFloor, plan.premiumCeil]
//
// FIX 4 — SEASONAL multiplier now applied to BASE before everything else,
//          so location + season compound correctly.
// ─────────────────────────────────────────────────────────────────────────────
export const calculatePremium = async ({
  city,
  pincode,
  lat,
  lng,
  workType,
  dailyHours,
  avgWeeklyIncome,
  planTier,
  yearsExperience = 0,
  userId = null,
}) => {
  // ── 1. Resolve zone (now uses cache + lat/lng) ────────────────────────────
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

  // ── 2. Work type + adjustment factors ─────────────────────────────────────
  const workTypeFactor = WORK_TYPE_FACTORS[workType] ?? WORK_TYPE_FACTORS.other;
  const incomeFactor = calcIncomeFactor(avgWeeklyIncome);
  const hoursFactor = calcHoursFactor(dailyHours);

  // ── 3. BASE component ─────────────────────────────────────────────────────
  const rawBase = round2(
    parseFloat(zone.base_premium) * workTypeFactor * incomeFactor * hoursFactor,
  );

  // ── 4. FIX 4 — Apply seasonal multiplier to BASE ──────────────────────────
  const currentMonth = new Date().getMonth() + 1;
  const { multiplier: seasonalMultiplier, label: seasonLabel } =
    getSeasonalMultiplier(zone.city, currentMonth);

  const basePremium = round2(rawBase * seasonalMultiplier);

  // ── 5. LOC_RISK surcharge ─────────────────────────────────────────────────
  const locRiskSurcharge = round2(
    parseFloat(zone.base_premium) * (parseFloat(zone.risk_factor) - 1),
  );

  // ── 6. FIX 6 — Income-scaled experience adjustment ────────────────────────
  const workerExpFactor = calcWorkerExpFactor(yearsExperience, basePremium);

  // ── 7. Plan surcharge ─────────────────────────────────────────────────────
  const planSurcharge = plan.surcharge;

  // ── 8. Sub-total ──────────────────────────────────────────────────────────
  const subTotal = round2(
    basePremium + locRiskSurcharge + workerExpFactor + planSurcharge,
  );

  // ── 9. Discounts (capped at 20% of base + loc_risk) ──────────────────────
  const discountCap = round2((basePremium + locRiskSurcharge) * 0.2);
  let discountApplied = 0;

  if (yearsExperience >= 5) discountApplied += round2(subTotal * 0.05); // loyalty
  if (avgWeeklyIncome <= 2000) discountApplied += round2(subTotal * 0.03); // low-income relief
  if (seasonalMultiplier === 1.0) discountApplied += round2(subTotal * 0.02); // off-season bonus

  discountApplied = round2(Math.min(discountApplied, discountCap));

  // ── 10. FIX 5 — Tier-specific premium floor + ceiling ────────────────────
  let finalPremium = round2(subTotal - discountApplied);
  finalPremium = Math.max(finalPremium, plan.premiumFloor);
  finalPremium = Math.min(finalPremium, plan.premiumCeil);

  // ── 11. Coverage amount ───────────────────────────────────────────────────
  const coverageAmount = round2(
    Math.min(finalPremium * plan.coverageMultiplier, plan.maxCoverage),
  );

  // ── 12. Risk score + band ─────────────────────────────────────────────────
  const riskScore = round2(
    parseFloat(zone.risk_factor) * workTypeFactor * hoursFactor,
  );
  const riskBand = getRiskBand(riskScore);

  // ── 13. FIX 7 — Persist quote WITH seasonal_multiplier for audit ──────────
  const { rows } = await query(
    `INSERT INTO pricing_quotes
       (user_id, zone_id, city, pincode, work_type, daily_hours,
        avg_weekly_income, plan_tier,
        base_premium, loc_risk_surcharge, worker_exp_factor,
        plan_surcharge, discount_applied, final_premium,
        coverage_amount, risk_band, seasonal_multiplier)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
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
      seasonalMultiplier,
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
      seasonalMultiplier,
      seasonLabel,
      riskScore,
      riskBand,
    },

    breakdown: {
      rawBase,
      basePremium, // rawBase × seasonalMultiplier
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
// FETCH QUOTE by ID
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
