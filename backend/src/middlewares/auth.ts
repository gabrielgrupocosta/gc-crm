import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido ou inválido.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyToken(token) as { id: string; role: string };
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token expirado ou inválido.' });
  }
};

export const adminMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
  }
  next();
};

export const permissionGuard = (modulo: string, acao: 'ler' | 'criar' | 'editar' | 'excluir') => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado.' });
      }

      // Se for ADMIN, passa direto (opcional, de acordo com o pedido Super Admin parametrizar, mas ADMIN geralmente tem tudo)
      if (req.user.role === 'ADMIN') {
        return next();
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { permissoes: true }
      });

      if (!user) {
        return res.status(401).json({ error: 'Usuário não encontrado.' });
      }

      const permissoes = user.permissoes as Record<string, any>;

      // Verifica se existe a permissão para o módulo e ação
      if (!permissoes || !permissoes[modulo] || permissoes[modulo][acao] !== true) {
        return res.status(403).json({ error: `Acesso negado. Permissão necessária: ${modulo}.${acao}` });
      }

      next();
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erro ao verificar permissões.' });
    }
  };
};
