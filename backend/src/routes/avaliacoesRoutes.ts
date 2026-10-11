import { Router } from 'express';
import { listAvaliacoes, createAvaliacao, deleteAvaliacao, listMyFeedbacks } from '../controllers/avaliacoesController';
import { authMiddleware } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { avaliacaoSchema } from '../schemas';

const router = Router();
router.use(authMiddleware);

router.get('/meus', listMyFeedbacks);
router.get('/', listAvaliacoes);
router.post('/', validate(avaliacaoSchema), createAvaliacao);
router.delete('/:id', deleteAvaliacao);

export default router;
