import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth';

const prisma = new PrismaClient();

export const getAlertas = async (req: AuthRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    const userId = req.user?.id;

    let unidadeIds: string[] = [];

    if (userRole !== 'ADMIN') {
      const unidades = await prisma.unidade.findMany({ where: { responsavelId: userId } });
      unidadeIds = unidades.map(u => u.id);
    }

    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    // Filtros de unidades
    const clienteWhere = userRole === 'ADMIN' ? { deletedAt: null } : { unidadeId: { in: unidadeIds }, deletedAt: null };

    // 1. Lançamentos Atrasados (Data < hoje E PENDENTE ou ATRASADO)
    const lancamentosAtrasados = await prisma.financeiro.findMany({
      where: {
        cliente: clienteWhere,
        dataCompetencia: { lt: today },
        statusPagamento: { in: ['PENDENTE', 'ATRASADO'] },
        deletedAt: null
      },
      include: { cliente: { select: { nomeFantasia: true } } }
    });

    // 2. Contratos próximos do vencimento (<= 30 dias)
    const contratosVencendo = await prisma.cliente.findMany({
      where: {
        ...clienteWhere,
        dataVencimentoContrato: {
          gte: today,
          lte: thirtyDaysFromNow
        }
      },
      select: { id: true, nomeFantasia: true, dataVencimentoContrato: true }
    });

    res.json({
      lancamentosAtrasados,
      contratosVencendo
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar alertas' });
  }
};
