import { Router } from 'express';
import { getAlertas } from '../controllers/alertasController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', getAlertas);

export default router;
