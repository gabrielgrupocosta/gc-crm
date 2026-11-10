import { Hono } from 'npm:hono@4.10.7';
import { getAccessibleUnitIds } from '../access.ts';
import {
  authMiddleware,
  databaseError,
  insertMeta,
  parseJson,
  requireRoles,
  softDeleteMeta,
} from '../platform.ts';
import type { AppEnv } from '../types.ts';

export const unidadesRoutes = new Hono<AppEnv>();
unidadesRoutes.use('*', authMiddleware);

unidadesRoutes.get('/', async (c) => {
  const db = c.get('db');
  const profile = c.get('profile');
  let query = db
    .from('Unidade')
    .select('*,responsavel:User!Unidade_responsavelId_fkey(nome,email)')
    .is('deletedAt', null)
    .order('nome');

  if (profile.role !== 'ADMIN' && profile.role !== 'FINANCEIRO') {
    const ids = await getAccessibleUnitIds(db, profile);
    if (ids.length === 0) return c.json([]);
    query = query.in('id', ids);
  }

  const { data: unidades, error } = await query;
  if (error) return databaseError(c, error, 'Erro ao buscar unidades.');
  if (!unidades?.length) return c.json([]);

  const ids = unidades.map((item) => item.id);
  const { data: clientes, error: countError } = await db
    .from('Cliente')
    .select('unidadeId')
    .in('unidadeId', ids)
    .is('deletedAt', null);
  if (countError) return databaseError(c, countError, 'Erro ao buscar unidades.');

  const counts = new Map<string, number>();
  for (const cliente of clientes || []) {
    counts.set(cliente.unidadeId, (counts.get(cliente.unidadeId) || 0) + 1);
  }

  return c.json(unidades.map((unidade) => ({
    ...unidade,
    _count: { clientes: counts.get(unidade.id) || 0 },
  })));
});

unidadesRoutes.post('/', requireRoles('ADMIN'), async (c) => {
  const body = await parseJson(c);
  const nome = typeof body?.nome === 'string' ? body.nome.trim() : '';
  const responsavelId = typeof body?.responsavelId === 'string' ? body.responsavelId : '';
  if (!nome || !responsavelId) return c.json({ error: 'Dados da unidade invalidos.' }, 400);

  const db = c.get('db');
  const { data: responsavel } = await db
    .from('User')
    .select('id')
    .eq('id', responsavelId)
    .is('deletedAt', null)
    .maybeSingle();
  if (!responsavel) return c.json({ error: 'Responsavel nao encontrado.' }, 400);

  const { data, error } = await db
    .from('Unidade')
    .insert({
      ...insertMeta(),
      nome,
      cnpj: typeof body?.cnpj === 'string' && body.cnpj ? body.cnpj : null,
      endereco: typeof body?.endereco === 'string' && body.endereco ? body.endereco : null,
      responsavelId,
      deletedAt: null,
    })
    .select('*')
    .single();
  if (error) return databaseError(c, error, 'Erro ao criar unidade.');
  return c.json(data, 201);
});

unidadesRoutes.delete('/:id', requireRoles('ADMIN'), async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const { data, error } = await db
    .from('Unidade')
    .update(softDeleteMeta())
    .eq('id', id)
    .is('deletedAt', null)
    .select('id')
    .maybeSingle();
  if (error) return databaseError(c, error, 'Erro ao remover unidade.');
  if (!data) return c.json({ error: 'Unidade nao encontrada' }, 404);
  return c.json({ message: 'Unidade removida' });
});

