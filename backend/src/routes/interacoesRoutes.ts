import { Router } from 'express';
import { listInteracoes, createInteracao, deleteInteracao } from '../controllers/interacoesController';
import { authMiddleware } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { interacaoSchema } from '../schemas';

const router = Router();

router.use(authMiddleware);

router.get('/:clienteId', listInteracoes);
router.post('/', validate(interacaoSchema), createInteracao);
router.delete('/:id', deleteInteracao);

export default router;
