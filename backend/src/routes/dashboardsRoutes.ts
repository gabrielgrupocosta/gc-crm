import { Router } from 'express';
import { getDashboardData } from '../controllers/dashboardsController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();
router.use(authMiddleware);

router.get('/', getDashboardData);

export default router;
