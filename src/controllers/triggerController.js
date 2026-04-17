import { asyncHandler } from '../utils/errorHandler.js';
import { listActiveTriggers, listAllTriggers } from '../services/triggerService.js';

export const getActiveTriggers = asyncHandler(async (req, res) => {
  const { zone_id } = req.query;
  const triggers = await listActiveTriggers({ zoneId: zone_id ?? null });

  res.status(200).json({
    success: true,
    count: triggers.length,
    data: triggers,
  });
});

export const getTriggers = asyncHandler(async (_req, res) => {
  const triggers = await listAllTriggers();

  res.status(200).json({
    success: true,
    count: triggers.length,
    data: triggers,
  });
});