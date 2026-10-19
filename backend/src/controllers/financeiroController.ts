import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middlewares/auth';


export const listFinanceiro = async (req: AuthRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    const userId = req.user?.id;

    let whereClause = {};

    if (userRole !== 'ADMIN') {
      // Pega unidades do responsável
      const unidadesDoResponsavel = await prisma.unidade.findMany({
        where: { responsavelId: userId },
        select: { id: true },
      });
      const ids = unidadesDoResponsavel.map((u) => u.id);
      
      // Filtra financeiro de clientes que pertencem às unidades do responsável
      whereClause = {
        cliente: {
          unidadeId: { in: ids },
        },
      };
    }

    const financeiro = await prisma.financeiro.findMany({
      where: { ...whereClause, deletedAt: null },
      include: {
        cliente: { 
          select: { 
            nomeFantasia: true,
            unidade: { select: { nome: true } }
          } 
        },
      },
      orderBy: { dataCompetencia: 'desc' },
    });

    res.json(financeiro);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar financeiro.' });
  }
};

  export const createLancamento = async (req: AuthRequest, res: Response) => {
    try {
      const { tipo, categoriaServico, descricao, valor, dataCompetencia, statusPagamento, clienteId } = req.body;
      
      // Verificação de segurança: checar se cliente existe e, se não for admin, se a unidade é do responsável
      const cliente = await prisma.cliente.findFirst({
        where: { id: clienteId, deletedAt: null },
        include: { unidade: true }
      });
  
      if (!cliente) {
        return res.status(404).json({ error: 'Cliente não encontrado.' });
      }
  
      if (req.user?.role !== 'ADMIN') {
        if (cliente.unidade.responsavelId !== req.user?.id) {
          return res.status(403).json({ error: 'Você não tem permissão para adicionar lançamento para este cliente.' });
        }
      }
      
      const lancamento = await prisma.financeiro.create({
        data: {
          tipo,
          categoriaServico,
          descricao,
          valor,
          dataCompetencia: new Date(dataCompetencia),
          statusPagamento,
          clienteId,
        },
      });
      res.status(201).json(lancamento);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar lançamento.' });
  }
};

export const deleteLancamento = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const lancamento = await prisma.financeiro.findFirst({
      where: { id, deletedAt: null },
      include: { cliente: { include: { unidade: true } } }
    });

    if (!lancamento) return res.status(404).json({ error: 'Lançamento não encontrado' });

    if (req.user?.role !== 'ADMIN' && lancamento.cliente.unidade.responsavelId !== req.user?.id) {
      return res.status(403).json({ error: 'Sem permissão' });
    }

    await prisma.financeiro.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    res.json({ message: 'Lançamento removido' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao remover lançamento' });
  }
};

export const updateLancamento = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { tipo, categoriaServico, descricao, valor, dataCompetencia, statusPagamento } = req.body;
    
    const lancamento = await prisma.financeiro.findFirst({
      where: { id, deletedAt: null },
      include: { cliente: { include: { unidade: true } } }
    });

    if (!lancamento) return res.status(404).json({ error: 'Lançamento não encontrado' });

    if (req.user?.role !== 'ADMIN' && lancamento.cliente.unidade.responsavelId !== req.user?.id) {
      return res.status(403).json({ error: 'Sem permissão para editar lançamento deste cliente' });
    }

    const atualizado = await prisma.financeiro.update({
      where: { id },
      data: {
        tipo,
        categoriaServico,
        descricao,
        valor,
        dataCompetencia: dataCompetencia ? new Date(dataCompetencia) : undefined,
        statusPagamento,
      }
    });

    res.json(atualizado);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar lançamento' });
  }
};
