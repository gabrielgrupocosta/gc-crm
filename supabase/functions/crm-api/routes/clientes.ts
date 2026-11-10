import { Hono } from 'npm:hono@4.10.7';
import { canAccessUnit, hasPermission, loadClientInScope, scopedClientIds } from '../access.ts';
import {
  asOptionalString,
  asNumber,
  authMiddleware,
  databaseError,
  insertMeta,
  isOneOf,
  parseJson,
  softDeleteMeta,
  updatedMeta,
} from '../platform.ts';
import type { AppEnv } from '../types.ts';

const CLIENT_STATUS = ['ATIVO', 'INATIVO', 'PROSPECCAO'] as const;
const FUNNEL_PHASES = ['LEAD', 'REUNIAO', 'PROPOSTA', 'FECHAMENTO'] as const;

export const clientesRoutes = new Hono<AppEnv>();
clientesRoutes.use('*', authMiddleware);

clientesRoutes.get('/', async (c) => {
  const db = c.get('db');
  const profile = c.get('profile');
  if (!hasPermission(profile, 'clientes', 'ler', ['FINANCEIRO', 'GESTOR_PL', 'VENDEDOR', 'SDR_CLOSER', 'COLABORADOR'])) {
    return c.json({ error: 'Acesso negado.' }, 403);
  }

  let query = db
    .from('Cliente')
    .select('*,unidade:Unidade(nome)')
    .is('deletedAt', null)
    .order('createdAt', { ascending: false });
  const clientIds = await scopedClientIds(db, profile, ['ADMIN', 'FINANCEIRO']);
  if (clientIds?.length === 0) return c.json([]);
  if (clientIds) query = query.in('id', clientIds);
  const { data, error } = await query;
  if (error) return databaseError(c, error, 'Erro ao buscar clientes.');
  return c.json(data || []);
});

clientesRoutes.post('/', async (c) => {
  const db = c.get('db');
  const profile = c.get('profile');
  if (!hasPermission(profile, 'clientes', 'criar', ['GESTOR_PL', 'VENDEDOR', 'SDR_CLOSER'])) {
    return c.json({ error: 'Acesso negado.' }, 403);
  }

  const body = await parseJson(c);
  const razaoSocial = typeof body?.razaoSocial === 'string' ? body.razaoSocial.trim() : '';
  const nomeFantasia = typeof body?.nomeFantasia === 'string' ? body.nomeFantasia.trim() : '';
  const cnpjCpf = typeof body?.cnpjCpf === 'string' ? body.cnpjCpf.trim() : '';
  const unidadeId = typeof body?.unidadeId === 'string' && body.unidadeId ? body.unidadeId : (profile.unidadeId || '');
  const status = body?.status ?? 'ATIVO';
  const faseFunil = body?.faseFunil ?? null;
  if (!razaoSocial || !nomeFantasia || cnpjCpf.length < 11 || !unidadeId
    || !isOneOf(status, CLIENT_STATUS)
    || (faseFunil !== null && !isOneOf(faseFunil, FUNNEL_PHASES))) {
    return c.json({ error: 'Dados do cliente invalidos.' }, 400);
  }
  if (!await canAccessUnit(db, profile, unidadeId)) {
    return c.json({ error: 'Voce nao tem permissao para cadastrar nesta unidade.' }, 403);
  }

  const contractDate = asOptionalString(body?.dataVencimentoContrato);
  if (contractDate && Number.isNaN(Date.parse(contractDate))) {
    return c.json({ error: 'Data de vencimento invalida.' }, 400);
  }

  const vendedorId = (profile.role === 'VENDEDOR' || profile.role === 'SDR_CLOSER')
    ? profile.id
    : (typeof body?.vendedorId === 'string' && body.vendedorId ? body.vendedorId : null);

  const { data, error } = await db
    .from('Cliente')
    .insert({
      ...insertMeta(),
      razaoSocial,
      nomeFantasia,
      cnpjCpf,
      email: asOptionalString(body?.email),
      telefone: asOptionalString(body?.telefone),
      unidadeId,
      vendedorId,
      status,
      faseFunil,
      dataEntrada: new Date().toISOString(),
      dataVencimentoContrato: contractDate ? new Date(contractDate).toISOString() : null,
      deletedAt: null,
    })
    .select('*')
    .single();
  if (error) return databaseError(c, error, 'Erro ao criar cliente.');
  return c.json(data, 201);
});

clientesRoutes.put('/:id/fase', async (c) => {
  const body = await parseJson(c);
  if (!body || !isOneOf(body.faseFunil, FUNNEL_PHASES)) {
    return c.json({ error: 'Fase do funil invalida.' }, 400);
  }
  const db = c.get('db');
  const profile = c.get('profile');
  if (!hasPermission(profile, 'clientes', 'editar', ['GESTOR_PL', 'VENDEDOR', 'SDR_CLOSER'])) {
    return c.json({ error: 'Acesso negado.' }, 403);
  }
  const { client, allowed } = await loadClientInScope(db, profile, c.req.param('id'));
  if (!client) return c.json({ error: 'Cliente nao encontrado' }, 404);
  if (!allowed) return c.json({ error: 'Sem permissao' }, 403);

  const { data, error } = await db
    .from('Cliente')
    .update({ faseFunil: body.faseFunil, ...updatedMeta() })
    .eq('id', client.id)
    .select('*')
    .single();
  if (error) return databaseError(c, error, 'Erro ao atualizar fase');
  return c.json(data);
});

clientesRoutes.post('/:id/pontuar-operador', async (c) => {
  const body = await parseJson(c);
  const notaOperador = asNumber(body?.notaOperador);
  if (notaOperador === null || notaOperador < 0 || notaOperador > 10) {
    return c.json({ error: 'Nota do operador invalida.' }, 400);
  }
  const db = c.get('db');
  const profile = c.get('profile');
  if (!hasPermission(profile, 'clientes', 'editar', ['GESTOR_PL'])) {
    return c.json({ error: 'Sem permissao para pontuar operador' }, 403);
  }
  const { client, allowed } = await loadClientInScope(db, profile, c.req.param('id'));
  if (!client) return c.json({ error: 'Cliente nao encontrado' }, 404);
  if (!allowed) return c.json({ error: 'Sem permissao' }, 403);

  const reference = typeof body?.mesReferencia === 'string' && !Number.isNaN(Date.parse(body.mesReferencia))
    ? new Date(body.mesReferencia)
    : new Date();
  const monthStart = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1));
  const nextMonth = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, 1));

  const { data: existing, error: findError } = await db
    .from('AnaliseCliente')
    .select('id')
    .eq('clienteId', client.id)
    .gte('mesReferencia', monthStart.toISOString())
    .lt('mesReferencia', nextMonth.toISOString())
    .is('deletedAt', null)
    .limit(1)
    .maybeSingle();
  if (findError) return databaseError(c, findError, 'Erro ao atribuir nota');

  const operation = existing
    ? db.from('AnaliseCliente').update({ notaOperador, ...updatedMeta() }).eq('id', existing.id)
    : db.from('AnaliseCliente').insert({
      ...insertMeta(),
      clienteId: client.id,
      mesReferencia: monthStart.toISOString(),
      classificacao: 'SAUDAVEL',
      notaOperador,
      deletedAt: null,
    });
  const { error } = await operation;
  if (error) return databaseError(c, error, 'Erro ao atribuir nota');
  return c.json({ message: 'Nota atribuida com sucesso' });
});

clientesRoutes.put('/:id', async (c) => {
  const db = c.get('db');
  const profile = c.get('profile');
  if (!hasPermission(profile, 'clientes', 'editar', ['GESTOR_PL', 'VENDEDOR', 'SDR_CLOSER'])) {
    return c.json({ error: 'Acesso negado.' }, 403);
  }
  const { client, allowed } = await loadClientInScope(db, profile, c.req.param('id'));
  if (!client) return c.json({ error: 'Cliente nao encontrado' }, 404);
  if (!allowed) return c.json({ error: 'Sem permissao para editar este cliente' }, 403);

  const body = await parseJson(c);
  if (!body) return c.json({ error: 'Dados invalidos.' }, 400);
  const unidadeId = typeof body.unidadeId === 'string' && body.unidadeId ? body.unidadeId : client.unidadeId;
  if (unidadeId !== client.unidadeId && !await canAccessUnit(db, profile, unidadeId)) {
    return c.json({ error: 'Sem permissao para mover para esta unidade' }, 403);
  }
  if (body.status !== undefined && !isOneOf(body.status, CLIENT_STATUS)) {
    return c.json({ error: 'Status invalido.' }, 400);
  }
  if (body.faseFunil !== undefined && body.faseFunil !== null && !isOneOf(body.faseFunil, FUNNEL_PHASES)) {
    return c.json({ error: 'Fase do funil invalida.' }, 400);
  }

  const contractDate = asOptionalString(body.dataVencimentoContrato);
  if (contractDate && Number.isNaN(Date.parse(contractDate))) {
    return c.json({ error: 'Data de vencimento invalida.' }, 400);
  }
  const patch = {
    razaoSocial: typeof body.razaoSocial === 'string' ? body.razaoSocial : client.razaoSocial,
    nomeFantasia: typeof body.nomeFantasia === 'string' ? body.nomeFantasia : client.nomeFantasia,
    cnpjCpf: typeof body.cnpjCpf === 'string' ? body.cnpjCpf : client.cnpjCpf,
    email: body.email !== undefined ? asOptionalString(body.email) : client.email,
    telefone: body.telefone !== undefined ? asOptionalString(body.telefone) : client.telefone,
    unidadeId,
    status: body.status ?? client.status,
    faseFunil: body.faseFunil !== undefined ? body.faseFunil : client.faseFunil,
    dataVencimentoContrato: body.dataVencimentoContrato !== undefined
      ? (contractDate ? new Date(contractDate).toISOString() : null)
      : client.dataVencimentoContrato,
    ...updatedMeta(),
  };

  const { data, error } = await db.from('Cliente').update(patch).eq('id', client.id).select('*').single();
  if (error) return databaseError(c, error, 'Erro ao atualizar cliente');
  return c.json(data);
});

clientesRoutes.delete('/:id', async (c) => {
  const db = c.get('db');
  const profile = c.get('profile');
  if (!hasPermission(profile, 'clientes', 'excluir', ['GESTOR_PL'])) {
    return c.json({ error: 'Acesso negado.' }, 403);
  }
  const { client, allowed } = await loadClientInScope(db, profile, c.req.param('id'));
  if (!client) return c.json({ error: 'Cliente nao encontrado' }, 404);
  if (!allowed) return c.json({ error: 'Sem permissao' }, 403);
  const { error } = await db.from('Cliente').update(softDeleteMeta()).eq('id', client.id);
  if (error) return databaseError(c, error, 'Erro ao remover cliente');
  return c.json({ message: 'Cliente removido' });
});
