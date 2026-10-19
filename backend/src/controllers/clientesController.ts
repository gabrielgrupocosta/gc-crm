import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middlewares/auth';


export const listClientes = async (req: AuthRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    const userId = req.user?.id;

    let whereClause = {};

    // Se não for admin, filtra pelas unidades vinculadas ao responsável
    if (userRole !== 'ADMIN') {
      const unidadesDoResponsavel = await prisma.unidade.findMany({
        where: { responsavelId: userId },
        select: { id: true },
      });
      const ids = unidadesDoResponsavel.map((u) => u.id);
      whereClause = { unidadeId: { in: ids } };
    }

    const clientes = await prisma.cliente.findMany({
      where: { ...whereClause, deletedAt: null },
      include: {
        unidade: { select: { nome: true } },
      },
    });

    res.json(clientes);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar clientes.' });
  }
};

  export const createCliente = async (req: AuthRequest, res: Response) => {
    try {
      const { razaoSocial, nomeFantasia, cnpjCpf, email, telefone, unidadeId, status, faseFunil, dataVencimentoContrato } = req.body;
      
      // Verificação de segurança: Se for RESPONSAVEL, ele só pode criar clientes para as SUAS unidades
      if (req.user?.role !== 'ADMIN') {
        const unidade = await prisma.unidade.findUnique({ where: { id: unidadeId } });
        if (!unidade || unidade.responsavelId !== req.user?.id) {
          return res.status(403).json({ error: 'Você não tem permissão para cadastrar nesta unidade.' });
        }
      }
  
      const cliente = await prisma.cliente.create({
        data: { 
          razaoSocial, 
          nomeFantasia, 
          cnpjCpf, 
          email, 
          telefone, 
          unidadeId,
          status,
          faseFunil,
          dataVencimentoContrato: dataVencimentoContrato ? new Date(dataVencimentoContrato) : null,
        },
      });
      res.status(201).json(cliente);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar cliente.' });
  }
};

export const updateFase = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { faseFunil } = req.body;
    
    const cliente = await prisma.cliente.findFirst({ where: { id, deletedAt: null }, include: { unidade: true } });
    if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado' });
    
    if (req.user?.role !== 'ADMIN' && cliente.unidade.responsavelId !== req.user?.id) {
      return res.status(403).json({ error: 'Sem permissão' });
    }
    
    const atualizado = await prisma.cliente.update({
      where: { id },
      data: { faseFunil }
    });
    
    res.json(atualizado);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar fase' });
  }
};

export const deleteCliente = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const cliente = await prisma.cliente.findFirst({ where: { id, deletedAt: null }, include: { unidade: true } });
    if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado' });
    
    if (req.user?.role !== 'ADMIN' && cliente.unidade.responsavelId !== req.user?.id) {
      return res.status(403).json({ error: 'Sem permissão' });
    }
    
    await prisma.cliente.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
    
    res.json({ message: 'Cliente removido' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao remover cliente' });
  }
};

export const updateCliente = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { razaoSocial, nomeFantasia, cnpjCpf, email, telefone, unidadeId, status, faseFunil, dataVencimentoContrato } = req.body;
    
    const cliente = await prisma.cliente.findFirst({ where: { id, deletedAt: null }, include: { unidade: true } });
    if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado' });
    
    if (req.user?.role !== 'ADMIN' && cliente.unidade.responsavelId !== req.user?.id) {
      return res.status(403).json({ error: 'Sem permissão para editar este cliente' });
    }
    
    // Se estiver mudando de unidade, valida permissão
    if (unidadeId && unidadeId !== cliente.unidadeId && req.user?.role !== 'ADMIN') {
        const novaUnidade = await prisma.unidade.findUnique({ where: { id: unidadeId } });
        if (!novaUnidade || novaUnidade.responsavelId !== req.user?.id) {
          return res.status(403).json({ error: 'Sem permissão para mover para esta unidade' });
        }
    }

    const atualizado = await prisma.cliente.update({
      where: { id },
      data: {
        razaoSocial,
        nomeFantasia,
        cnpjCpf,
        email,
        telefone,
        unidadeId,
        status,
        faseFunil,
        dataVencimentoContrato: dataVencimentoContrato ? new Date(dataVencimentoContrato) : null,
      }
    });
    
    res.json(atualizado);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar cliente' });
  }
};

export const pontuarOperador = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { notaOperador, mesReferencia } = req.body;
    
    if (req.user?.role !== 'ADMIN' && req.user?.role !== 'GESTOR_PL') {
      return res.status(403).json({ error: 'Sem permissão para pontuar operador' });
    }

    const cliente = await prisma.cliente.findFirst({ where: { id, deletedAt: null }, include: { unidade: true } });
    if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado' });

    if (req.user?.role !== 'ADMIN' && cliente.unidade.responsavelId !== req.user?.id) {
      return res.status(403).json({ error: 'Você só pode avaliar a operação de clientes da sua própria unidade' });
    }

    // Procura se já tem uma análise para o mês, ou cria uma nova se não tiver.
    const refDate = mesReferencia ? new Date(mesReferencia) : new Date();
    const inicioMes = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
    const fimMes = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0, 23, 59, 59);

    let analise = await prisma.analiseCliente.findFirst({
      where: {
        clienteId: id,
        mesReferencia: { gte: inicioMes, lte: fimMes },
        deletedAt: null
      }
    });

    if (analise) {
      await prisma.analiseCliente.update({
        where: { id: analise.id },
        data: { notaOperador }
      });
    } else {
      await prisma.analiseCliente.create({
        data: {
          clienteId: id,
          mesReferencia: inicioMes,
          classificacao: 'SAUDAVEL', // default
          notaOperador
        }
      });
    }

    res.json({ message: 'Nota atribuída com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atribuir nota' });
  }
};
