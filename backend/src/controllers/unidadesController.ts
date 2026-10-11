import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth';

const prisma = new PrismaClient();

export const listUnidades = async (req: AuthRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    const userId = req.user?.id;

    // Se admin, vê todas. Se responsável, vê apenas as suas.
    const whereClause = userRole === 'ADMIN' ? { deletedAt: null } : { responsavelId: userId, deletedAt: null };

    const unidades = await prisma.unidade.findMany({
      where: whereClause,
      include: {
        responsavel: { select: { nome: true, email: true } },
        _count: { select: { clientes: { where: { deletedAt: null } } } },
      },
    });

    res.json(unidades);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar unidades.' });
  }
};

export const createUnidade = async (req: Request, res: Response) => {
  try {
    const { nome, cnpj, endereco, responsavelId } = req.body;
    const unidade = await prisma.unidade.create({
      data: { nome, cnpj, endereco, responsavelId },
    });
    res.status(201).json(unidade);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar unidade.' });
  }
};

export const deleteUnidade = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    // Apenas admin pode deletar unidade (regra sugerida)
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Sem permissão' });
    }

    const unidade = await prisma.unidade.findFirst({ where: { id, deletedAt: null } });
    if (!unidade) return res.status(404).json({ error: 'Unidade não encontrada' });

    await prisma.unidade.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    res.json({ message: 'Unidade removida' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao remover unidade.' });
  }
};
