import { Router } from 'express';
import { login, registerFirstAdmin } from '../controllers/authController';

const router = Router();

router.post('/login', login);
router.post('/setup-admin', registerFirstAdmin); // Rota provisória para criar o primeiro usuário

export default router;
