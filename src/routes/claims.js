import { Router } from 'express';
import { getAllClaimsHandler, getMyClaims, postSoftConfirmClaim } from '../controllers/claimController.js';

const router = Router();

router.get('/my-claims', getMyClaims);
router.post('/soft-confirm', postSoftConfirmClaim);
router.get('/all', getAllClaimsHandler);

export default router;