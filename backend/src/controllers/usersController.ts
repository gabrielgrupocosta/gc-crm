import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export const listUsers = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: { deletedAt: null },
      select: { 
        id: true, nome: true, email: true, role: true, 
        tipoVendedor: true, metas: true, createdAt: true,
        gestor: { select: { nome: true } },
        unidade: { select: { nome: true } },
        permissoes: true
      },
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar usuários.' });
  }
};

export const createUser = async (req: Request, res: Response) => {
  try {
    const { nome, email, senha, role, tipoVendedor, metas, gestorId, unidadeId } = req.body;
    
    const exists = await prisma.user.findFirst({ where: { email, deletedAt: null } });
    if (exists) {
      return res.status(400).json({ error: 'E-mail já cadastrado.' });
    }

    const hashedPassword = await bcrypt.hash(senha, 10);
    const user = await prisma.user.create({
      data: { 
        nome, 
        email, 
        senha: hashedPassword, 
        role,
        tipoVendedor: tipoVendedor || null,
        metas: metas ? parseFloat(metas) : null,
        gestorId: gestorId || null,
        unidadeId: unidadeId || null
      },
      select: { id: true, nome: true, email: true, role: true },
    });
    
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar usuário.' });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
    
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    await prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    res.json({ message: 'Usuário removido' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao remover usuário' });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { role, unidadeId, metas } = req.body;

    const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    const updated = await prisma.user.update({
      where: { id },
      data: {
        role: role || undefined,
        unidadeId: unidadeId !== undefined ? (unidadeId === '' ? null : unidadeId) : undefined,
        metas: metas !== undefined ? (metas === '' ? null : parseFloat(metas)) : undefined,
      },
      select: { id: true, nome: true, role: true }
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
};

export const updateUserPermissions = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { permissoes } = req.body;

    const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    const updated = await prisma.user.update({
      where: { id },
      data: {
        permissoes
      },
      select: { id: true, nome: true, role: true, permissoes: true }
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar permissões do usuário' });
  }
};
