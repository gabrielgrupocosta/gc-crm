import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middlewares/auth';


export const listInteracoes = async (req: AuthRequest, res: Response) => {
  try {
    const { clienteId } = req.params;
    const interacoes = await prisma.interacao.findMany({
      where: { clienteId, deletedAt: null },
      include: { responsavel: { select: { nome: true } } },
      orderBy: { dataInteracao: 'desc' }
    });
    res.json(interacoes);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar interações' });
  }
};

export const createInteracao = async (req: AuthRequest, res: Response) => {
  try {
    const { clienteId, tipo, descricao } = req.body;
    const responsavelId = req.user!.id;

    // Verificar se o cliente pertence à unidade do responsável (se não for admin)
    const cliente = await prisma.cliente.findFirst({ where: { id: clienteId, deletedAt: null }, include: { unidade: true } });
    if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado' });

    if (req.user?.role !== 'ADMIN' && cliente.unidade.responsavelId !== responsavelId) {
      return res.status(403).json({ error: 'Sem permissão' });
    }

    const interacao = await prisma.interacao.create({
      data: {
        clienteId,
        responsavelId,
        tipo,
        descricao
      }
    });
    res.status(201).json(interacao);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao registrar interação' });
  }
};

export const deleteInteracao = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const interacao = await prisma.interacao.findFirst({
      where: { id, deletedAt: null },
      include: { cliente: { include: { unidade: true } } }
    });

    if (!interacao) return res.status(404).json({ error: 'Interação não encontrada' });

    if (req.user?.role !== 'ADMIN' && interacao.cliente.unidade.responsavelId !== req.user?.id) {
      return res.status(403).json({ error: 'Sem permissão' });
    }

    await prisma.interacao.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    res.json({ message: 'Interação removida' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao remover interação' });
  }
};
