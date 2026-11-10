import { Hono } from 'npm:hono@4.10.7';
import { hasPermission, loadClientInScope } from '../access.ts';
import {
  authMiddleware,
  databaseError,
  insertMeta,
  isOneOf,
  parseJson,
  softDeleteMeta,
} from '../platform.ts';
import type { AppEnv } from '../types.ts';

const INTERACTION_TYPES = ['REUNIAO', 'CALL', 'WHATSAPP'] as const;

export const interacoesRoutes = new Hono<AppEnv>();
interacoesRoutes.use('*', authMiddleware);

interacoesRoutes.get('/:clienteId', async (c) => {
  const db = c.get('db');
  const profile = c.get('profile');
  if (!hasPermission(profile, 'interacoes', 'ler', ['GESTOR_PL', 'VENDEDOR', 'SDR_CLOSER', 'COLABORADOR'])) {
    return c.json({ error: 'Acesso negado.' }, 403);
  }
  const { client, allowed } = await loadClientInScope(db, profile, c.req.param('clienteId'));
  if (!client) return c.json({ error: 'Cliente nao encontrado' }, 404);
  if (!allowed) return c.json({ error: 'Sem permissao' }, 403);

  const { data, error } = await db
    .from('Interacao')
    .select('*,responsavel:User!Interacao_responsavelId_fkey(nome)')
    .eq('clienteId', client.id)
    .is('deletedAt', null)
    .order('dataInteracao', { ascending: false });
  if (error) return databaseError(c, error, 'Erro ao buscar interacoes');
  return c.json(data || []);
});

interacoesRoutes.post('/', async (c) => {
  const db = c.get('db');
  const profile = c.get('profile');
  if (!hasPermission(profile, 'interacoes', 'criar', ['GESTOR_PL', 'VENDEDOR', 'SDR_CLOSER', 'COLABORADOR'])) {
    return c.json({ error: 'Acesso negado.' }, 403);
  }
  const body = await parseJson(c);
  const clienteId = typeof body?.clienteId === 'string' ? body.clienteId : '';
  const descricao = typeof body?.descricao === 'string' ? body.descricao.trim() : '';
  if (!clienteId || !descricao || !isOneOf(body?.tipo, INTERACTION_TYPES)) {
    return c.json({ error: 'Dados da interacao invalidos.' }, 400);
  }
  const { client, allowed } = await loadClientInScope(db, profile, clienteId);
  if (!client) return c.json({ error: 'Cliente nao encontrado' }, 404);
  if (!allowed) return c.json({ error: 'Sem permissao' }, 403);

  const now = new Date().toISOString();
  const { data, error } = await db
    .from('Interacao')
    .insert({
      ...insertMeta(),
      tipo: body.tipo,
      dataInteracao: now,
      descricao,
      clienteId,
      responsavelId: profile.id,
      deletedAt: null,
    })
    .select('*')
    .single();
  if (error) return databaseError(c, error, 'Erro ao registrar interacao');
  return c.json(data, 201);
});

interacoesRoutes.delete('/:id', async (c) => {
  const db = c.get('db');
  const profile = c.get('profile');
  const { data: interaction, error: findError } = await db
    .from('Interacao')
    .select('id,clienteId,responsavelId')
    .eq('id', c.req.param('id'))
    .is('deletedAt', null)
    .maybeSingle();
  if (findError) return databaseError(c, findError, 'Erro ao remover interacao');
  if (!interaction) return c.json({ error: 'Interacao nao encontrada' }, 404);
  const { allowed } = await loadClientInScope(db, profile, interaction.clienteId);
  const canDelete = profile.role === 'ADMIN'
    || interaction.responsavelId === profile.id
    || (allowed && hasPermission(profile, 'interacoes', 'excluir', ['GESTOR_PL']));
  if (!canDelete) return c.json({ error: 'Sem permissao' }, 403);
  const { error } = await db.from('Interacao').update(softDeleteMeta()).eq('id', interaction.id);
  if (error) return databaseError(c, error, 'Erro ao remover interacao');
  return c.json({ message: 'Interacao removida' });
});

