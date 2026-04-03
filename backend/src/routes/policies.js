import { Router } from 'express';
import { createPolicyHandler, getUserPolicies } from '../controllers/policyController.js';

const router = Router();

// POST /api/policies/create
router.post('/create', createPolicyHandler);

// GET /api/policies/:userId
router.get('/:userId', getUserPolicies);

export default router;
