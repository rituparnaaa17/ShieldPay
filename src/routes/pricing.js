import { Router } from 'express';
import { getQuote } from '../controllers/pricingController.js';

const router = Router();

// POST /api/pricing/quote
router.post('/quote', getQuote);

export default router;
