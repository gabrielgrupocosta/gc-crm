import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { generateToken } from '../utils/jwt';

const prisma = new PrismaClient();

export const login = async (req: Request, res: Response) => {
  try {
    const { email, senha } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const isMatch = await bcrypt.compare(senha, user.senha);

    if (!isMatch) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const token = generateToken(user.id, user.role);

    res.json({
      token,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno no servidor.' });
  }
};

// Rota inicial de seed ou registro (apenas para popular o primeiro ADMIN)
export const registerFirstAdmin = async (req: Request, res: Response) => {
  try {
    const adminExists = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (adminExists) {
      return res.status(400).json({ error: 'Um admin já existe no sistema.' });
    }

    const { nome, email, senha } = req.body;
    const hashedPassword = await bcrypt.hash(senha, 10);

    const newAdmin = await prisma.user.create({
      data: {
        nome,
        email,
        senha: hashedPassword,
        role: 'ADMIN',
      },
    });

    res.status(201).json({ message: 'Admin criado com sucesso!', adminId: newAdmin.id });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar admin.' });
  }
};
