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

const TYPES = ['MENSALIDADE', 'VENDA_AVULSA'] as const;
const CATEGORIES = ['TRAFEGO', 'SOCIAL_MEDIA', 'SITES', 'SEO', 'BRANDING', 'OUTROS'] as const;
const PAYMENT_STATUS = ['PAGO', 'PENDENTE', 'ATRASADO'] as const;

export const financeiroRoutes = new Hono<AppEnv>();
financeiroRoutes.use('*', authMiddleware);

financeiroRoutes.get('/', async (c) => {
  const db = c.get('db');
  const profile = c.get('profile');
  if (!hasPermission(profile, 'financeiro', 'ler', ['FINANCEIRO', 'GESTOR_PL'])) {
    return c.json({ error: 'Acesso negado.' }, 403);
  }

  const ids = await scopedClientIds(db, profile, ['ADMIN', 'FINANCEIRO']);
  if (ids?.length === 0) return c.json([]);
  let query = db
    .from('Financeiro')
    .select('*,cliente:Cliente(nomeFantasia,unidade:Unidade(nome))')
    .is('deletedAt', null)
    .order('dataCompetencia', { ascending: false });
  if (ids) query = query.in('clienteId', ids);
  const { data, error } = await query;
  if (error) return databaseError(c, error, 'Erro ao buscar financeiro.');
  return c.json(data || []);
});

financeiroRoutes.post('/', async (c) => {
  const db = c.get('db');
  const profile = c.get('profile');
  if (!hasPermission(profile, 'financeiro', 'criar', ['FINANCEIRO', 'GESTOR_PL'])) {
    return c.json({ error: 'Acesso negado.' }, 403);
  }
  const body = await parseJson(c);
  const valor = asNumber(body?.valor);
  const clienteId = typeof body?.clienteId === 'string' ? body.clienteId : '';
  const dataCompetencia = typeof body?.dataCompetencia === 'string' ? body.dataCompetencia : '';
  if (!body || !isOneOf(body.tipo, TYPES)
    || (body.categoriaServico !== undefined && body.categoriaServico !== null && !isOneOf(body.categoriaServico, CATEGORIES))
    || !isOneOf(body.statusPagamento ?? 'PENDENTE', PAYMENT_STATUS)
    || valor === null || valor <= 0 || !clienteId || Number.isNaN(Date.parse(dataCompetencia))) {
    return c.json({ error: 'Dados do lancamento invalidos.' }, 400);
  }

  const { client, allowed } = await loadClientInScope(db, profile, clienteId, ['ADMIN', 'FINANCEIRO']);
  if (!client) return c.json({ error: 'Cliente nao encontrado.' }, 404);
  if (!allowed) return c.json({ error: 'Voce nao tem permissao para adicionar lancamento para este cliente.' }, 403);

  const { data, error } = await db
    .from('Financeiro')
    .insert({
      ...insertMeta(),
      tipo: body.tipo,
      categoriaServico: body.categoriaServico || null,
      descricao: asOptionalString(body.descricao),
      valor,
      dataCompetencia: new Date(dataCompetencia).toISOString(),
      statusPagamento: body.statusPagamento ?? 'PENDENTE',
      clienteId,
      deletedAt: null,
    })
    .select('*')
    .single();
  if (error) return databaseError(c, error, 'Erro ao criar lancamento.');
  return c.json(data, 201);
});

financeiroRoutes.put('/:id', async (c) => {
  const db = c.get('db');
  const profile = c.get('profile');
  if (!hasPermission(profile, 'financeiro', 'editar', ['FINANCEIRO', 'GESTOR_PL'])) {
    return c.json({ error: 'Acesso negado.' }, 403);
  }
  const id = c.req.param('id');
  const { data: existing, error: findError } = await db
    .from('Financeiro')
    .select('*')
    .eq('id', id)
    .is('deletedAt', null)
    .maybeSingle();
  if (findError) return databaseError(c, findError, 'Erro ao atualizar lancamento');
  if (!existing) return c.json({ error: 'Lancamento nao encontrado' }, 404);
  const { allowed } = await loadClientInScope(db, profile, existing.clienteId, ['ADMIN', 'FINANCEIRO']);
  if (!allowed) return c.json({ error: 'Sem permissao para editar lancamento deste cliente' }, 403);

  const body = await parseJson(c);
  if (!body) return c.json({ error: 'Dados invalidos.' }, 400);
  if (body.tipo !== undefined && !isOneOf(body.tipo, TYPES)) return c.json({ error: 'Tipo invalido.' }, 400);
  if (body.categoriaServico !== undefined && body.categoriaServico !== null && !isOneOf(body.categoriaServico, CATEGORIES)) {
    return c.json({ error: 'Categoria invalida.' }, 400);
  }
  if (body.statusPagamento !== undefined && !isOneOf(body.statusPagamento, PAYMENT_STATUS)) {
    return c.json({ error: 'Status de pagamento invalido.' }, 400);
  }
  const valor = body.valor === undefined ? existing.valor : asNumber(body.valor);
  if (valor === null || Number(valor) <= 0) return c.json({ error: 'Valor invalido.' }, 400);
  const competence = body.dataCompetencia === undefined ? existing.dataCompetencia : body.dataCompetencia;
  if (typeof competence !== 'string' || Number.isNaN(Date.parse(competence))) {
    return c.json({ error: 'Data invalida.' }, 400);
  }

  const { data, error } = await db
    .from('Financeiro')
    .update({
      tipo: body.tipo ?? existing.tipo,
      categoriaServico: body.categoriaServico !== undefined ? body.categoriaServico : existing.categoriaServico,
      descricao: body.descricao !== undefined ? asOptionalString(body.descricao) : existing.descricao,
      valor,
      dataCompetencia: new Date(competence).toISOString(),
      statusPagamento: body.statusPagamento ?? existing.statusPagamento,
      ...updatedMeta(),
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) return databaseError(c, error, 'Erro ao atualizar lancamento');
  return c.json(data);
});

financeiroRoutes.delete('/:id', async (c) => {
  const db = c.get('db');
  const profile = c.get('profile');
  if (!hasPermission(profile, 'financeiro', 'excluir', ['FINANCEIRO', 'GESTOR_PL'])) {
    return c.json({ error: 'Acesso negado.' }, 403);
  }
  const id = c.req.param('id');
  const { data: existing, error: findError } = await db
    .from('Financeiro')
    .select('id,clienteId')
    .eq('id', id)
    .is('deletedAt', null)
    .maybeSingle();
  if (findError) return databaseError(c, findError, 'Erro ao remover lancamento');
  if (!existing) return c.json({ error: 'Lancamento nao encontrado' }, 404);
  const { allowed } = await loadClientInScope(db, profile, existing.clienteId, ['ADMIN', 'FINANCEIRO']);
  if (!allowed) return c.json({ error: 'Sem permissao' }, 403);
  const { error } = await db.from('Financeiro').update(softDeleteMeta()).eq('id', id);
  if (error) return databaseError(c, error, 'Erro ao remover lancamento');
  return c.json({ message: 'Lancamento removido' });
});

