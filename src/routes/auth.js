import { Router } from 'express';
import { register, login, getSettings, updateSettings } from '../controllers/authController.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/settings/:userId', getSettings);
router.put('/settings/:userId', updateSettings);

export default router;
