import { Router } from 'express';
import { listAnalises, createAnalise, deleteAnalise, listCancelamentos, createCancelamento, deleteCancelamento } from '../controllers/csController';
import { authMiddleware } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { analiseSchema, cancelamentoSchema } from '../schemas';

const router = Router();
router.use(authMiddleware);

// Análises de Cliente (Saúde)
router.get('/analises', listAnalises);
router.post('/analises', validate(analiseSchema), createAnalise);
router.delete('/analises/:id', deleteAnalise);

// Cancelamentos (Churn)
router.get('/cancelamentos', listCancelamentos);
router.post('/cancelamentos', validate(cancelamentoSchema), createCancelamento);
router.delete('/cancelamentos/:id', deleteCancelamento);

export default router;
