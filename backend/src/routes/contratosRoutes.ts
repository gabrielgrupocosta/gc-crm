import { Router } from 'express';
import { listPropostas, createProposta, deleteProposta, uploadContratoPDF, updatePropostaStatus } from '../controllers/contratosController';
import { upload } from '../utils/upload';
import { authMiddleware } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { propostaSchema } from '../schemas';

const router = Router();
router.use(authMiddleware);

router.get('/', listPropostas);
router.post('/', validate(propostaSchema), createProposta);
router.post('/:id/upload', upload.single('file'), uploadContratoPDF);
router.patch('/:id/status', updatePropostaStatus);
router.delete('/:id', deleteProposta);

export default router;
