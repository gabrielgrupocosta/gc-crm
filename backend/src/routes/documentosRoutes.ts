import { Router } from 'express';
import { listDocumentos, uploadDocumento, deleteDocumento, updateDocumento } from '../controllers/documentosController';
import { authMiddleware } from '../middlewares/auth';
import { upload } from '../utils/upload';

const router = Router();

router.use(authMiddleware);

router.get('/:clienteId', listDocumentos);
router.post('/', upload.single('arquivo'), uploadDocumento);
router.delete('/:id', deleteDocumento);
router.put('/:id', updateDocumento);

export default router;
