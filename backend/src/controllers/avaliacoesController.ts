import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middlewares/auth';


export const listAvaliacoes = async (req: AuthRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    const userId = req.user?.id;

    let whereClause: any = { deletedAt: null };

    // Gestores veem os liderados, Colaborador vê a própria.
    if (userRole === 'COLABORADOR' || userRole === 'VENDEDOR' || userRole === 'SDR_CLOSER') {
      whereClause.colaboradorId = userId;
    } else if (userRole === 'GESTOR_PL') {
      const liderados = await prisma.user.findMany({ where: { gestorId: userId, deletedAt: null }, select: { id: true } });
      whereClause.colaboradorId = { in: liderados.map(l => l.id) };
    }

    const avaliacoes = await prisma.avaliacaoDesempenho.findMany({
      where: whereClause,
      include: {
        colaborador: { select: { nome: true } },
        avaliador: { select: { nome: true } },
      },
      orderBy: { mesReferencia: 'desc' }
    });
    res.json(avaliacoes);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar avaliações' });
  }
};

export const listMyFeedbacks = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const feedbacks = await prisma.avaliacaoDesempenho.findMany({
      where: { colaboradorId: userId, deletedAt: null },
      include: {
        avaliador: { select: { nome: true } }
      },
      orderBy: { mesReferencia: 'desc' }
    });
    res.json(feedbacks);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar meus feedbacks' });
  }
};

export const createAvaliacao = async (req: AuthRequest, res: Response) => {
  try {
    const { colaboradorId, mesReferencia, notas, feedback, notaGeral, feedbackTexto } = req.body;
    const avaliadorId = req.user!.id;

    if (req.user?.role === 'COLABORADOR' || req.user?.role === 'VENDEDOR') {
      return res.status(403).json({ error: 'Apenas Gestores podem avaliar.' });
    }

    const avaliacao = await prisma.avaliacaoDesempenho.create({
      data: {
        colaboradorId,
        avaliadorId,
        mesReferencia: new Date(mesReferencia),
        notas,
        feedback,
        notaGeral,
        feedbackTexto
      }
    });
    res.status(201).json(avaliacao);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar avaliação' });
  }
};

export const deleteAvaliacao = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    if (req.user?.role !== 'ADMIN' && req.user?.role !== 'GESTOR_PL') {
      return res.status(403).json({ error: 'Sem permissão' });
    }

    const avaliacao = await prisma.avaliacaoDesempenho.findFirst({ where: { id, deletedAt: null } });
    if (!avaliacao) return res.status(404).json({ error: 'Avaliação não encontrada' });

    await prisma.avaliacaoDesempenho.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
    res.json({ message: 'Avaliação removida' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao remover avaliação' });
  }
};
