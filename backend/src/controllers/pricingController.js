import { calculatePremium } from '../services/pricingService.js';
import { asyncHandler, createError } from '../utils/errorHandler.js';

const VALID_WORK_TYPES = ['construction', 'domestic', 'delivery', 'factory', 'agriculture', 'retail', 'other'];
const VALID_PLAN_TIERS = ['basic', 'standard', 'premium'];

export const getQuote = asyncHandler(async (req, res) => {
  const {
    city,
    pincode,
    work_type,
    daily_hours,
    avg_weekly_income,
    plan_tier,
    years_experience,
    user_id,
  } = req.body;

  // ── Coerce types (handles PowerShell/JSON number-as-string edge cases) ──
  const parsedHours   = Number(daily_hours);
  const parsedIncome  = Number(avg_weekly_income);
  const parsedExp     = Number(years_experience ?? 0);

  // ── Input validation ────────────────────────────────────────────────────
  const errors = [];

  if (!city && !pincode)
    errors.push('Provide at least city or pincode.');

  if (!work_type || !VALID_WORK_TYPES.includes(work_type))
    errors.push(`work_type must be one of: ${VALID_WORK_TYPES.join(', ')}.`);

  if (!daily_hours || isNaN(parsedHours) || parsedHours < 1 || parsedHours > 16)
    errors.push('daily_hours must be a number between 1 and 16.');

  if (!avg_weekly_income || isNaN(parsedIncome) || parsedIncome <= 0)
    errors.push('avg_weekly_income must be a positive number.');

  if (!plan_tier || !VALID_PLAN_TIERS.includes(plan_tier))
    errors.push(`plan_tier must be one of: ${VALID_PLAN_TIERS.join(', ')}.`);

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: 'Validation failed.', errors });
  }

  const result = await calculatePremium({
    city:            city?.trim() ?? null,
    pincode:         pincode?.toString().trim() ?? null,
    workType:        work_type,
    dailyHours:      parsedHours,
    avgWeeklyIncome: parsedIncome,
    planTier:        plan_tier,
    yearsExperience: parsedExp,
    userId:          user_id ?? null,
  });

  res.status(200).json({ success: true, data: result });
});
