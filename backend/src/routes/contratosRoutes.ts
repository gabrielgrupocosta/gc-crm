import { Router } from 'express';
import { listPropostas, createProposta, deleteProposta, uploadContratoPDF, updatePropostaStatus } from '../controllers/contratosController';
import multer from 'multer';
import path from 'path';

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads')),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });
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
