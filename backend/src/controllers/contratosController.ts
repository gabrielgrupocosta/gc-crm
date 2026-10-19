import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { prisma } from '../lib/prisma';
import { getDocumentUrl, uploadFile } from '../lib/storage';

export const listPropostas = async (req: AuthRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    const userId = req.user?.id;

    let whereClause: any = { deletedAt: null };

    if (userRole === 'VENDEDOR' || userRole === 'SDR_CLOSER') {
      whereClause.vendedorId = userId;
    } else if (userRole === 'GESTOR_PL') {
      const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
      if (user?.unidadeId) {
        whereClause.cliente = { unidadeId: user.unidadeId };
      }
    }

    const propostas = await prisma.proposta.findMany({
      where: whereClause,
      include: {
        cliente: { select: { nomeFantasia: true } },
        vendedor: { select: { nome: true } },
        documentos: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(await Promise.all(propostas.map(async (proposta) => ({
      ...proposta,
      documentos: await Promise.all(proposta.documentos.map(async (documento) => ({
        ...documento,
        urlCaminho: await getDocumentUrl(documento.urlCaminho),
      }))),
    }))));
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar propostas' });
  }
};

export const createProposta = async (req: AuthRequest, res: Response) => {
  try {
    const { clienteId, vendedorId, status, valor, descricao } = req.body;
    const userId = req.user?.id;

    if (req.user?.role === 'VENDEDOR' && vendedorId !== userId) {
      return res.status(403).json({ error: 'Você só pode criar propostas para si mesmo.' });
    }

    const proposta = await prisma.proposta.create({
      data: {
        clienteId,
        vendedorId,
        status,
        valor,
        descricao,
      }
    });
    res.status(201).json(proposta);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar proposta' });
  }
};

export const deleteProposta = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const proposta = await prisma.proposta.findFirst({ where: { id, deletedAt: null } });
    if (!proposta) return res.status(404).json({ error: 'Proposta não encontrada' });

    if (req.user?.role === 'VENDEDOR' && proposta.vendedorId !== userId) {
      return res.status(403).json({ error: 'Sem permissão' });
    }

    await prisma.proposta.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
    res.json({ message: 'Proposta removida' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao remover proposta' });
  }
};

export const uploadContratoPDF = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const proposta = await prisma.proposta.findFirst({
      where: { id, deletedAt: null },
      include: {
        cliente: true
      }
    });

    if (!proposta) return res.status(404).json({ error: 'Proposta não encontrada' });

    if (req.user?.role === 'VENDEDOR' && proposta.vendedorId !== req.user.id) {
      return res.status(403).json({ error: 'Sem permissão' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    const storedPath = await uploadFile(req.file, `contratos/${proposta.id}`);

    // Marca como documento e atrela ao cliente e proposta
    const documento = await prisma.documento.create({
      data: {
        nomeArquivo: req.file.originalname,
        urlCaminho: storedPath,
        tipoArquivo: req.file.mimetype,
        clienteId: proposta.clienteId,
        propostaId: proposta.id
      }
    });

    // Se foi fornecido um novo status (ex: ASSINADO), já atualiza a proposta
    if (req.body.status) {
      await prisma.proposta.update({
        where: { id },
        data: { status: req.body.status }
      });
    }

    res.json({ message: 'Arquivo anexado com sucesso', documento });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao fazer upload do contrato' });
  }
};

export const updatePropostaStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user?.id;

    const proposta = await prisma.proposta.findFirst({ where: { id, deletedAt: null } });
    if (!proposta) return res.status(404).json({ error: 'Proposta não encontrada' });

    if (req.user?.role === 'VENDEDOR' && proposta.vendedorId !== userId) {
      return res.status(403).json({ error: 'Sem permissão' });
    }

    const updatedProposta = await prisma.proposta.update({
      where: { id },
      data: { status }
    });

    res.json(updatedProposta);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar status da proposta' });
  }
};
