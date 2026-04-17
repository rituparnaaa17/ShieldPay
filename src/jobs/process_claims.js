import { processClaimsForActiveTriggers } from '../services/claimService.js';

export const processClaims = async () => processClaimsForActiveTriggers();