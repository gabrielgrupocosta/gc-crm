import { Hono } from 'npm:hono@4.10.7';
import { hasPermission, loadClientInScope, scopedClientIds } from '../access.ts';
import {
  asNumber,
  asOptionalString,
  authMiddleware,
  databaseError,
  insertMeta,
  isOneOf,
  parseJson,
  softDeleteMeta,
  updatedMeta,
} from '../platform.ts';
import type { AppEnv } from '../types.ts';

const HEALTH_CLASSIFICATION = ['SAUDAVEL', 'ATENCAO', 'CRITICO'] as const;

export const csRoutes = new Hono<AppEnv>();
csRoutes.use('*', authMiddleware);

const canReadCs = (profile: Parameters<typeof hasPermission>[0]) => {
  return hasPermission(profile, 'cs', 'ler', ['FINANCEIRO', 'GESTOR_PL', 'COLABORADOR']);
};

csRoutes.get('/analises', async (c) => {
  const db = c.get('db');
  const profile = c.get('profile');
  if (!canReadCs(profile)) return c.json({ error: 'Acesso negado.' }, 403);
  const clientIds = await scopedClientIds(db, profile, ['ADMIN']);
  if (clientIds?.length === 0) return c.json([]);
  let query = db
    .from('AnaliseCliente')
    .select('*,cliente:Cliente(nomeFantasia)')
    .is('deletedAt', null)
    .order('mesReferencia', { ascending: false });
  if (clientIds) query = query.in('clienteId', clientIds);
  const { data, error } = await query;
  if (error) return databaseError(c, error, 'Erro ao buscar analises');
  return c.json(data || []);
});

csRoutes.post('/analises', async (c) => {
  const db = c.get('db');
  const profile = c.get('profile');
  if (!hasPermission(profile, 'cs', 'criar', ['GESTOR_PL', 'COLABORADOR'])) {
    return c.json({ error: 'Acesso negado.' }, 403);
  }
  const body = await parseJson(c);
  const clienteId = typeof body?.clienteId === 'string' ? body.clienteId : '';
  const mesReferencia = typeof body?.mesReferencia === 'string' ? body.mesReferencia : '';
  const notaCSAT = body?.notaCSAT === null || body?.notaCSAT === undefined ? null : asNumber(body.notaCSAT);
  if (!clienteId || Number.isNaN(Date.parse(mesReferencia))
    || !isOneOf(body?.classificacao, HEALTH_CLASSIFICATION)
    || (notaCSAT !== null && (notaCSAT < 0 || notaCSAT > 10))) {
    return c.json({ error: 'Dados da analise invalidos.' }, 400);
  }
  const { client, allowed } = await loadClientInScope(db, profile, clienteId);
  if (!client) return c.json({ error: 'Cliente nao encontrado.' }, 404);
  if (!allowed) return c.json({ error: 'Sem permissao.' }, 403);
  const { data, error } = await db
    .from('AnaliseCliente')
    .insert({
      ...insertMeta(),
      clienteId,
      mesReferencia: new Date(mesReferencia).toISOString(),
      notaCSAT,
      riscos: asOptionalString(body.riscos),
      planoAcao: asOptionalString(body.planoAcao),
      classificacao: body.classificacao,
      notaOperador: null,
      deletedAt: null,
    })
    .select('*')
    .single();
  if (error) return databaseError(c, error, 'Erro ao criar analise');
  return c.json(data, 201);
});

csRoutes.delete('/analises/:id', async (c) => {
  const db = c.get('db');
  const profile = c.get('profile');
  if (!hasPermission(profile, 'cs', 'excluir', ['GESTOR_PL', 'COLABORADOR'])) {
    return c.json({ error: 'Acesso negado.' }, 403);
  }
  const { data: analysis, error: findError } = await db
    .from('AnaliseCliente')
    .select('id,clienteId')
    .eq('id', c.req.param('id'))
    .is('deletedAt', null)
    .maybeSingle();
  if (findError) return databaseError(c, findError, 'Erro ao remover analise');
  if (!analysis) return c.json({ error: 'Analise nao encontrada' }, 404);
  const { allowed } = await loadClientInScope(db, profile, analysis.clienteId);
  if (!allowed) return c.json({ error: 'Sem permissao' }, 403);
  const { error } = await db.from('AnaliseCliente').update(softDeleteMeta()).eq('id', analysis.id);
  if (error) return databaseError(c, error, 'Erro ao remover analise');
  return c.json({ message: 'Analise removida' });
});

csRoutes.get('/cancelamentos', async (c) => {
  const db = c.get('db');
  const profile = c.get('profile');
  if (!canReadCs(profile)) return c.json({ error: 'Acesso negado.' }, 403);
  const clientIds = await scopedClientIds(db, profile, ['ADMIN', 'FINANCEIRO']);
  if (clientIds?.length === 0) return c.json([]);
  let query = db
    .from('Cancelamento')
    .select('*,cliente:Cliente(nomeFantasia)')
    .is('deletedAt', null)
    .order('dataCancelamento', { ascending: false });
  if (clientIds) query = query.in('clienteId', clientIds);
  const { data, error } = await query;
  if (error) return databaseError(c, error, 'Erro ao buscar cancelamentos');
  return c.json(data || []);
});

csRoutes.post('/cancelamentos', async (c) => {
  const db = c.get('db');
  const profile = c.get('profile');
  if (!hasPermission(profile, 'cs', 'criar', ['GESTOR_PL', 'COLABORADOR'])) {
    return c.json({ error: 'Acesso negado.' }, 403);
  }
  const body = await parseJson(c);
  const clienteId = typeof body?.clienteId === 'string' ? body.clienteId : '';
  const motivo = typeof body?.motivo === 'string' ? body.motivo.trim() : '';
  const receitaPerdida = asNumber(body?.receitaPerdida);
  if (!clienteId || !motivo || receitaPerdida === null || receitaPerdida <= 0) {
    return c.json({ error: 'Dados do cancelamento invalidos.' }, 400);
  }
  const { client, allowed } = await loadClientInScope(db, profile, clienteId);
  if (!client) return c.json({ error: 'Cliente nao encontrado.' }, 404);
  if (!allowed) return c.json({ error: 'Sem permissao.' }, 403);

  const { data: cancellation, error: insertError } = await db
    .from('Cancelamento')
    .insert({
      ...insertMeta(),
      clienteId,
      motivo,
      tentativasRetencao: asOptionalString(body.tentativasRetencao),
      receitaPerdida,
      dataCancelamento: new Date().toISOString(),
      deletedAt: null,
    })
    .select('*')
    .single();
  if (insertError) return databaseError(c, insertError, 'Erro ao registrar cancelamento');

  const { error: clientError } = await db
    .from('Cliente')
    .update({ status: 'CANCELADO', ...updatedMeta() })
    .eq('id', clienteId);
  if (clientError) {
    await db.from('Cancelamento').delete().eq('id', cancellation.id);
    return databaseError(c, clientError, 'Erro ao registrar cancelamento');
  }
  return c.json(cancellation, 201);
});

csRoutes.delete('/cancelamentos/:id', async (c) => {
  const profile = c.get('profile');
  if (profile.role !== 'ADMIN' && !hasPermission(profile, 'cs', 'excluir')) {
    return c.json({ error: 'Apenas admin pode remover um cancelamento' }, 403);
  }
  const db = c.get('db');
  const { data, error } = await db
    .from('Cancelamento')
    .update(softDeleteMeta())
    .eq('id', c.req.param('id'))
    .is('deletedAt', null)
    .select('id')
    .maybeSingle();
  if (error) return databaseError(c, error, 'Erro ao remover cancelamento');
  if (!data) return c.json({ error: 'Cancelamento nao encontrado' }, 404);
  return c.json({ message: 'Cancelamento removido' });
});

