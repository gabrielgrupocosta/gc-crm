import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth';

const prisma = new PrismaClient();

export const listAnalises = async (req: AuthRequest, res: Response) => {
  try {
    const analises = await prisma.analiseCliente.findMany({
      where: { deletedAt: null },
      include: {
        cliente: { select: { nomeFantasia: true } },
      },
      orderBy: { mesReferencia: 'desc' }
    });
    res.json(analises);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar análises' });
  }
};

export const createAnalise = async (req: AuthRequest, res: Response) => {
  try {
    const { clienteId, mesReferencia, notaCSAT, riscos, planoAcao, classificacao } = req.body;

    const analise = await prisma.analiseCliente.create({
      data: {
        clienteId,
        mesReferencia: new Date(mesReferencia),
        notaCSAT,
        riscos,
        planoAcao,
        classificacao
      }
    });
    res.status(201).json(analise);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar análise' });
  }
};

export const deleteAnalise = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    if (req.user?.role === 'VENDEDOR' || req.user?.role === 'SDR_CLOSER') {
      return res.status(403).json({ error: 'Sem permissão' });
    }

    const analise = await prisma.analiseCliente.findFirst({ where: { id, deletedAt: null } });
    if (!analise) return res.status(404).json({ error: 'Análise não encontrada' });

    await prisma.analiseCliente.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
    res.json({ message: 'Análise removida' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao remover análise' });
  }
};

export const listCancelamentos = async (req: AuthRequest, res: Response) => {
  try {
    const cancelamentos = await prisma.cancelamento.findMany({
      where: { deletedAt: null },
      include: {
        cliente: { select: { nomeFantasia: true } },
      },
      orderBy: { dataCancelamento: 'desc' }
    });
    res.json(cancelamentos);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar cancelamentos' });
  }
};

export const createCancelamento = async (req: AuthRequest, res: Response) => {
  try {
    const { clienteId, motivo, tentativasRetencao, receitaPerdida } = req.body;

    const cancelamento = await prisma.cancelamento.create({
      data: {
        clienteId,
        motivo,
        tentativasRetencao,
        receitaPerdida,
      }
    });

    // Update Cliente status to CANCELADO
    await prisma.cliente.update({
      where: { id: clienteId },
      data: { status: 'CANCELADO' }
    });

    res.status(201).json(cancelamento);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao registrar cancelamento' });
  }
};

export const deleteCancelamento = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Apenas admin pode remover um cancelamento' });
    }

    await prisma.cancelamento.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
    res.json({ message: 'Cancelamento removido' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao remover cancelamento' });
  }
};
