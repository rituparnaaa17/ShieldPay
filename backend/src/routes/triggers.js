import { Router } from 'express';
import { getActiveTriggers, getTriggers } from '../controllers/triggerController.js';

const router = Router();

router.get('/active', getActiveTriggers);
router.get('/', getTriggers);

export default router;