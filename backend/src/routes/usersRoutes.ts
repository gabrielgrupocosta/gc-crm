import { Router } from 'express';
import { listUsers, createUser, deleteUser, updateUser, updateUserPermissions } from '../controllers/usersController';
import { authMiddleware, adminMiddleware } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { userSchema } from '../schemas';

const router = Router();

router.use(authMiddleware);
router.use(adminMiddleware); // Apenas admins gerenciam usuários

router.get('/', listUsers);
router.post('/', validate(userSchema), createUser);
router.put('/:id', updateUser);
router.put('/:id/permissoes', updateUserPermissions);
router.delete('/:id', deleteUser);

export default router;
