import { Hono } from 'npm:hono@4.10.7';
import { hasPermission } from '../access.ts';
import {
  asNumber,
  asOptionalString,
  authMiddleware,
  databaseError,
  insertMeta,
  parseJson,
  softDeleteMeta,
} from '../platform.ts';
import type { AppEnv } from '../types.ts';

export const avaliacoesRoutes = new Hono<AppEnv>();
avaliacoesRoutes.use('*', authMiddleware);

avaliacoesRoutes.get('/meus', async (c) => {
  const db = c.get('db');
  const { data, error } = await db
    .from('AvaliacaoDesempenho')
    .select('*,avaliador:User!AvaliacaoDesempenho_avaliadorId_fkey(nome)')
    .eq('colaboradorId', c.get('profile').id)
    .is('deletedAt', null)
    .order('mesReferencia', { ascending: false });
  if (error) return databaseError(c, error, 'Erro ao buscar meus feedbacks');
  return c.json(data || []);
});

avaliacoesRoutes.get('/', async (c) => {
  const db = c.get('db');
  const profile = c.get('profile');
  let query = db
    .from('AvaliacaoDesempenho')
    .select('*,colaborador:User!AvaliacaoDesempenho_colaboradorId_fkey(nome),avaliador:User!AvaliacaoDesempenho_avaliadorId_fkey(nome)')
    .is('deletedAt', null)
    .order('mesReferencia', { ascending: false });

  if (profile.role === 'GESTOR_PL') {
    const { data: reports, error: reportsError } = await db
      .from('User')
      .select('id')
      .eq('gestorId', profile.id)
      .is('deletedAt', null);
    if (reportsError) return databaseError(c, reportsError, 'Erro ao buscar avaliacoes');
    const ids = (reports || []).map((item) => item.id);
    if (ids.length === 0) return c.json([]);
    query = query.in('colaboradorId', ids);
  } else if (profile.role !== 'ADMIN') {
    query = query.eq('colaboradorId', profile.id);
  }

  const { data, error } = await query;
  if (error) return databaseError(c, error, 'Erro ao buscar avaliacoes');
  return c.json(data || []);
});

avaliacoesRoutes.post('/', async (c) => {
  const db = c.get('db');
  const profile = c.get('profile');
  if (!hasPermission(profile, 'avaliacoes', 'criar', ['GESTOR_PL'])) {
    return c.json({ error: 'Apenas Gestores podem avaliar.' }, 403);
  }
  const body = await parseJson(c);
  const colaboradorId = typeof body?.colaboradorId === 'string' ? body.colaboradorId : '';
  const mesReferencia = typeof body?.mesReferencia === 'string' ? body.mesReferencia : '';
  if (!colaboradorId || Number.isNaN(Date.parse(mesReferencia))
    || body?.notas === null || typeof body?.notas !== 'object' || Array.isArray(body.notas)) {
    return c.json({ error: 'Dados da avaliacao invalidos.' }, 400);
  }
  const { data: collaborator, error: collaboratorError } = await db
    .from('User')
    .select('id,gestorId,unidadeId')
    .eq('id', colaboradorId)
    .is('deletedAt', null)
    .maybeSingle();
  if (collaboratorError) return databaseError(c, collaboratorError, 'Erro ao criar avaliacao');
  if (!collaborator) return c.json({ error: 'Colaborador nao encontrado.' }, 404);
  if (profile.role !== 'ADMIN' && collaborator.gestorId !== profile.id) {
    return c.json({ error: 'Voce so pode avaliar seus liderados.' }, 403);
  }

  const notaGeral = body.notaGeral === undefined || body.notaGeral === null ? null : asNumber(body.notaGeral);
  if (notaGeral !== null && (notaGeral < 0 || notaGeral > 10)) {
    return c.json({ error: 'Nota geral invalida.' }, 400);
  }
  const { data, error } = await db
    .from('AvaliacaoDesempenho')
    .insert({
      ...insertMeta(),
      colaboradorId,
      avaliadorId: profile.id,
      mesReferencia: new Date(mesReferencia).toISOString(),
      notas: body.notas,
      feedback: asOptionalString(body.feedback),
      notaGeral,
      feedbackTexto: asOptionalString(body.feedbackTexto),
      deletedAt: null,
    })
    .select('*')
    .single();
  if (error) return databaseError(c, error, 'Erro ao criar avaliacao');
  return c.json(data, 201);
});

avaliacoesRoutes.delete('/:id', async (c) => {
  const db = c.get('db');
  const profile = c.get('profile');
  const { data: evaluation, error: findError } = await db
    .from('AvaliacaoDesempenho')
    .select('id,colaboradorId,avaliadorId,colaborador:User!AvaliacaoDesempenho_colaboradorId_fkey(gestorId)')
    .eq('id', c.req.param('id'))
    .is('deletedAt', null)
    .maybeSingle();
  if (findError) return databaseError(c, findError, 'Erro ao remover avaliacao');
  if (!evaluation) return c.json({ error: 'Avaliacao nao encontrada' }, 404);
  const managerOwns = profile.role === 'GESTOR_PL'
    && (evaluation.avaliadorId === profile.id || evaluation.colaborador?.gestorId === profile.id);
  if (profile.role !== 'ADMIN' && !managerOwns
    && !hasPermission(profile, 'avaliacoes', 'excluir')) {
    return c.json({ error: 'Sem permissao' }, 403);
  }
  const { error } = await db.from('AvaliacaoDesempenho').update(softDeleteMeta()).eq('id', evaluation.id);
  if (error) return databaseError(c, error, 'Erro ao remover avaliacao');
  return c.json({ message: 'Avaliacao removida' });
});

