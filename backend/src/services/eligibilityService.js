import { query } from '../config/db.js';

const toMinutes = (timeValue) => {
  if (!timeValue) return null;
  const [hours, minutes = '0'] = String(timeValue).split(':');
  return Number(hours) * 60 + Number(minutes);
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const isPolicyActive = (policy, now = new Date()) => {
  if (!policy) return false;
  if (policy.status !== 'active') return false;
  return new Date(policy.valid_from) <= now && new Date(policy.valid_until) >= now;
};

export const isTriggerCovered = (policy, triggerType) => {
  const coverageTriggers = policy?.coverage_triggers ?? [];
  return Array.isArray(coverageTriggers) && coverageTriggers.includes(triggerType);
};

export const doesWorkWindowOverlap = (profile, triggerStart, triggerEnd) => {
  if (!profile) return true;

  const startMinutes = toMinutes(profile.preferred_work_start);
  const endMinutes = toMinutes(profile.preferred_work_end);

  if (startMinutes === null || endMinutes === null) return true;

  const triggerStartMinutes = triggerStart.getHours() * 60 + triggerStart.getMinutes();
  const triggerEndMinutes = triggerEnd.getHours() * 60 + triggerEnd.getMinutes();

  if (endMinutes >= startMinutes) {
    return triggerStartMinutes < endMinutes && triggerEndMinutes > startMinutes;
  }

  return triggerStartMinutes >= startMinutes || triggerEndMinutes <= endMinutes;
};

export const hasExistingClaim = async (policyId, triggerEventId) => {
  const { rows } = await query(
    `SELECT id
     FROM claims
     WHERE policy_id = $1
       AND trigger_event_id = $2
     LIMIT 1`,
    [policyId, triggerEventId]
  );
  return rows.length > 0;
};

export const estimateHourlyIncome = (profile) => {
  if (!profile) return 0;
  const weeklyActiveHours = Number(profile.weekly_active_hours ?? profile.daily_hours * 7 ?? 1);
  if (weeklyActiveHours <= 0) return 0;
  return Number(profile.avg_weekly_income) / weeklyActiveHours;
};

export const estimatePayout = (profile, policy, triggerEvent) => {
  const hourlyIncome = estimateHourlyIncome(profile);
  if (!hourlyIncome) {
    return {
      estimatedIncomeLoss: 0,
      payoutAmount: 0,
    };
  }

  const triggerStart = new Date(triggerEvent.start_time);
  const triggerEnd = new Date(triggerEvent.end_time ?? triggerEvent.updated_at ?? triggerEvent.created_at);
  const durationHours = clamp((triggerEnd.getTime() - triggerStart.getTime()) / (1000 * 60 * 60), 0.25, 12);
  const severityFactor = clamp(Number(triggerEvent.severity ?? 0) / 100, 0.5, 1.5);
  const estimatedIncomeLoss = Math.round(hourlyIncome * durationHours * severityFactor * 100) / 100;
  const payoutAmount = Math.round(Math.min(estimatedIncomeLoss, Number(policy.coverage_amount)) * 100) / 100;

  return {
    estimatedIncomeLoss,
    payoutAmount,
  };
};

export const getEligiblePolicyRowsForTrigger = async (zoneId, triggerType) => {
  const { rows } = await query(
    `SELECT
       p.*,
       wp.avg_weekly_income,
       wp.daily_hours,
       wp.weekly_active_hours,
       wp.preferred_work_start,
       wp.preferred_work_end
     FROM policies p
     JOIN pricing_quotes pq ON pq.id = p.quote_id
     JOIN users u ON u.id = p.user_id
     LEFT JOIN worker_profiles wp ON wp.user_id = u.id
     WHERE pq.zone_id = $1
       AND p.status = 'active'
       AND p.valid_until > NOW()`,
    [zoneId]
  );

  return rows.filter((policy) => isTriggerCovered(policy, triggerType));
};