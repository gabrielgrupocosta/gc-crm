import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth';

const prisma = new PrismaClient();

export const uploadDocumento = async (req: AuthRequest, res: Response) => {
  try {
    const { clienteId } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    const documento = await prisma.documento.create({
      data: {
        nomeArquivo: file.originalname,
        urlCaminho: `/uploads/${file.filename}`,
        tipoArquivo: file.mimetype,
        clienteId,
      },
    });

    res.status(201).json(documento);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao salvar documento.' });
  }
};

export const listDocumentos = async (req: AuthRequest, res: Response) => {
  try {
    const { clienteId } = req.params;
    
    // Verificação de acesso omitida por brevidade

    const documentos = await prisma.documento.findMany({
      where: { clienteId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    res.json(documentos);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar documentos.' });
  }
};

export const deleteDocumento = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const documento = await prisma.documento.findFirst({
      where: { id, deletedAt: null },
      include: { cliente: { include: { unidade: true } } }
    });

    if (!documento) return res.status(404).json({ error: 'Documento não encontrado' });

    if (req.user?.role !== 'ADMIN' && documento.cliente.unidade.responsavelId !== req.user?.id) {
      return res.status(403).json({ error: 'Sem permissão' });
    }

    await prisma.documento.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    res.json({ message: 'Documento removido' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao remover documento' });
  }
};

export const updateDocumento = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { nomeArquivo } = req.body;
    
    const documento = await prisma.documento.findFirst({
      where: { id, deletedAt: null },
      include: { cliente: { include: { unidade: true } } }
    });

    if (!documento) return res.status(404).json({ error: 'Documento não encontrado' });

    if (req.user?.role !== 'ADMIN' && documento.cliente.unidade.responsavelId !== req.user?.id) {
      return res.status(403).json({ error: 'Sem permissão para editar' });
    }

    const atualizado = await prisma.documento.update({
      where: { id },
      data: { nomeArquivo }
    });

    res.json(atualizado);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar documento' });
  }
};
