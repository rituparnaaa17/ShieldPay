import { Router } from 'express';
import {
  createPolicyHandler,
  getUserPolicies,
  cancelPolicyHandler,
  renewPolicyHandler,
} from '../controllers/policyController.js';

const router = Router();

router.post('/create',                    createPolicyHandler);   // create
router.get('/:userId',                    getUserPolicies);       // list active
router.patch('/:policyId/cancel',         cancelPolicyHandler);   // cancel   FIX 9
router.patch('/:policyId/renew',          renewPolicyHandler);    // renew    FIX 10

export default router;
