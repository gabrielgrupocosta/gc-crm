import { Router } from 'express';
import { listClientes, createCliente, updateFase, deleteCliente, updateCliente, pontuarOperador } from '../controllers/clientesController';
import { authMiddleware } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { clienteSchema } from '../schemas';

const router = Router();

router.use(authMiddleware);

router.get('/', listClientes);
router.post('/', validate(clienteSchema), createCliente);
router.put('/:id', validate(clienteSchema), updateCliente);
router.put('/:id/fase', updateFase);
router.post('/:id/pontuar-operador', pontuarOperador);
router.delete('/:id', deleteCliente);

export default router;
