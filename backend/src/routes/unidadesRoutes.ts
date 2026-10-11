import { Router } from 'express';
import { listUnidades, createUnidade, deleteUnidade } from '../controllers/unidadesController';
import { authMiddleware, adminMiddleware } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { unidadeSchema } from '../schemas';

const router = Router();

router.use(authMiddleware);

// Responsáveis e Admins podem listar (o controller filtra o acesso)
router.get('/', listUnidades);

// Apenas Admin pode criar novas unidades
router.post('/', adminMiddleware, validate(unidadeSchema), createUnidade);

// Apenas Admin pode deletar unidades
router.delete('/:id', adminMiddleware, deleteUnidade);

export default router;
