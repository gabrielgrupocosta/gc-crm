import { Router } from 'express';
import { listFinanceiro, createLancamento, deleteLancamento, updateLancamento } from '../controllers/financeiroController';
import { authMiddleware } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { financeiroSchema } from '../schemas';

const router = Router();

router.use(authMiddleware);

router.get('/', listFinanceiro);
router.post('/', validate(financeiroSchema), createLancamento);
router.put('/:id', validate(financeiroSchema), updateLancamento);
router.delete('/:id', deleteLancamento);

export default router;
