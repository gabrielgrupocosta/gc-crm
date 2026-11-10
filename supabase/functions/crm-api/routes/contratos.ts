import { Hono } from 'npm:hono@4.10.7';
import { ensureProposalAccess, hasPermission, loadClientInScope, scopedClientIds } from '../access.ts';
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
import { deleteStoredFile, signDocuments, signStoredPath, uploadFile, validateUpload } from '../storage.ts';
import type { AppEnv } from '../types.ts';

const PROPOSAL_STATUS = ['RASCUNHO', 'ENVIADO', 'ASSINADO', 'ATIVO'] as const;

export const contratosRoutes = new Hono<AppEnv>();
contratosRoutes.use('*', authMiddleware);

contratosRoutes.get('/', async (c) => {
  const db = c.get('db');
  const profile = c.get('profile');
  if (!hasPermission(profile, 'contratos', 'ler', ['FINANCEIRO', 'GESTOR_PL', 'VENDEDOR', 'SDR_CLOSER'])) {
    return c.json({ error: 'Acesso negado.' }, 403);
  }

  let query = db
    .from('Proposta')
    .select('*,cliente:Cliente(nomeFantasia,unidadeId),vendedor:User!Proposta_vendedorId_fkey(nome)')
    .is('deletedAt', null)
    .order('createdAt', { ascending: false });
  if (profile.role === 'VENDEDOR' || profile.role === 'SDR_CLOSER') {
    query = query.eq('vendedorId', profile.id);
  } else if (profile.role !== 'ADMIN' && profile.role !== 'FINANCEIRO') {
    const clientIds = await scopedClientIds(db, profile);
    if (clientIds?.length === 0) return c.json([]);
    if (clientIds) query = query.in('clienteId', clientIds);
  }

  const { data: proposals, error } = await query;
  if (error) return databaseError(c, error, 'Erro ao buscar propostas');
  if (!proposals?.length) return c.json([]);

  const proposalIds = proposals.map((item) => item.id);
  const { data: documents, error: documentError } = await db
    .from('Documento')
    .select('*')
    .in('propostaId', proposalIds)
    .is('deletedAt', null);
  if (documentError) return databaseError(c, documentError, 'Erro ao buscar propostas');
  let signedDocuments;
  try {
    signedDocuments = await signDocuments(db, documents || []);
  } catch (signError) {
    return databaseError(c, signError, 'Erro ao gerar acesso aos contratos.');
  }
  const byProposal = new Map<string, unknown[]>();
  for (const document of signedDocuments) {
    if (!document.propostaId) continue;
    const list = byProposal.get(document.propostaId) || [];
    list.push(document);
    byProposal.set(document.propostaId, list);
  }
  return c.json(proposals.map((proposal) => ({
    ...proposal,
    documentos: byProposal.get(proposal.id) || [],
  })));
});

contratosRoutes.post('/', async (c) => {
  const db = c.get('db');
  const profile = c.get('profile');
  if (!hasPermission(profile, 'contratos', 'criar', ['GESTOR_PL', 'VENDEDOR', 'SDR_CLOSER'])) {
    return c.json({ error: 'Acesso negado.' }, 403);
  }
  const body = await parseJson(c);
  const clienteId = typeof body?.clienteId === 'string' ? body.clienteId : '';
  const vendedorId = typeof body?.vendedorId === 'string' ? body.vendedorId : '';
  const valor = asNumber(body?.valor);
  const status = body?.status ?? 'RASCUNHO';
  if (!clienteId || !vendedorId || valor === null || valor <= 0 || !isOneOf(status, PROPOSAL_STATUS)) {
    return c.json({ error: 'Dados da proposta invalidos.' }, 400);
  }
  if ((profile.role === 'VENDEDOR' || profile.role === 'SDR_CLOSER') && vendedorId !== profile.id) {
    return c.json({ error: 'Voce so pode criar propostas para si mesmo.' }, 403);
  }

  const { client, allowed } = await loadClientInScope(db, profile, clienteId);
  if (!client) return c.json({ error: 'Cliente nao encontrado.' }, 404);
  if (!allowed) return c.json({ error: 'Sem permissao.' }, 403);
  const { data: seller } = await db
    .from('User')
    .select('id,unidadeId')
    .eq('id', vendedorId)
    .is('deletedAt', null)
    .maybeSingle();
  if (!seller) return c.json({ error: 'Vendedor nao encontrado.' }, 400);
  if (profile.role !== 'ADMIN' && seller.unidadeId && seller.unidadeId !== client.unidadeId) {
    return c.json({ error: 'Vendedor nao pertence a unidade do cliente.' }, 400);
  }

  const { data, error } = await db
    .from('Proposta')
    .insert({
      ...insertMeta(),
      clienteId,
      vendedorId,
      status,
      valor,
      descricao: asOptionalString(body?.descricao),
      dataEnvio: status === 'ENVIADO' ? new Date().toISOString() : null,
      dataAssinatura: status === 'ASSINADO' || status === 'ATIVO' ? new Date().toISOString() : null,
      deletedAt: null,
    })
    .select('*')
    .single();
  if (error) return databaseError(c, error, 'Erro ao criar proposta');
  return c.json(data, 201);
});

contratosRoutes.post('/:id/upload', async (c) => {
  const db = c.get('db');
  const profile = c.get('profile');
  if (!hasPermission(profile, 'contratos', 'editar', ['GESTOR_PL', 'VENDEDOR', 'SDR_CLOSER'])) {
    return c.json({ error: 'Acesso negado.' }, 403);
  }
  const { proposal, allowed } = await ensureProposalAccess(db, profile, c.req.param('id'));
  if (!proposal) return c.json({ error: 'Proposta nao encontrada' }, 404);
  if (!allowed) return c.json({ error: 'Sem permissao' }, 403);

  let form: Record<string, string | File | (string | File)[]>;
  try {
    form = await c.req.parseBody({ all: true });
  } catch {
    return c.json({ error: 'Formulario de upload invalido.' }, 400);
  }
  const rawFile = form.file;
  const file = rawFile instanceof File ? rawFile : Array.isArray(rawFile) && rawFile[0] instanceof File ? rawFile[0] : null;
  if (!file) return c.json({ error: 'Nenhum arquivo enviado.' }, 400);
  const validationError = validateUpload(file);
  if (validationError) return c.json({ error: validationError }, 400);
  const rawStatus = Array.isArray(form.status) ? form.status[0] : form.status;
  const status = typeof rawStatus === 'string' && rawStatus ? rawStatus : null;
  if (status && !isOneOf(status, PROPOSAL_STATUS)) return c.json({ error: 'Status invalido.' }, 400);

  let storedPath = '';
  let documentId = '';
  try {
    storedPath = await uploadFile(db, file, `contratos/${proposal.id}`);
    const { data: document, error: documentError } = await db
      .from('Documento')
      .insert({
        ...insertMeta(),
        nomeArquivo: file.name,
        urlCaminho: storedPath,
        tipoArquivo: file.type || null,
        clienteId: proposal.clienteId,
        propostaId: proposal.id,
        deletedAt: null,
      })
      .select('*')
      .single();
    if (documentError) throw documentError;
    documentId = document.id;

    if (status) {
      const statusDates: Record<string, unknown> = { status, ...updatedMeta() };
      if (status === 'ENVIADO') statusDates.dataEnvio = new Date().toISOString();
      if (status === 'ASSINADO' || status === 'ATIVO') statusDates.dataAssinatura = new Date().toISOString();
      const { error: statusError } = await db.from('Proposta').update(statusDates).eq('id', proposal.id);
      if (statusError) throw statusError;
    }

    return c.json({
      message: 'Arquivo anexado com sucesso',
      documento: { ...document, urlCaminho: await signStoredPath(db, storedPath) },
    });
  } catch (error) {
    if (documentId) await db.from('Documento').delete().eq('id', documentId);
    if (storedPath) await deleteStoredFile(db, storedPath).catch(() => undefined);
    return databaseError(c, error, 'Erro ao fazer upload do contrato');
  }
});

contratosRoutes.patch('/:id/status', async (c) => {
  const db = c.get('db');
  const profile = c.get('profile');
  if (!hasPermission(profile, 'contratos', 'editar', ['GESTOR_PL', 'VENDEDOR', 'SDR_CLOSER'])) {
    return c.json({ error: 'Acesso negado.' }, 403);
  }
  const body = await parseJson(c);
  if (!body || !isOneOf(body.status, PROPOSAL_STATUS)) return c.json({ error: 'Status invalido.' }, 400);
  const { proposal, allowed } = await ensureProposalAccess(db, profile, c.req.param('id'));
  if (!proposal) return c.json({ error: 'Proposta nao encontrada' }, 404);
  if (!allowed) return c.json({ error: 'Sem permissao' }, 403);
  const patch: Record<string, unknown> = { status: body.status, ...updatedMeta() };
  if (body.status === 'ENVIADO') patch.dataEnvio = new Date().toISOString();
  if (body.status === 'ASSINADO' || body.status === 'ATIVO') patch.dataAssinatura = new Date().toISOString();
  const { data, error } = await db.from('Proposta').update(patch).eq('id', proposal.id).select('*').single();
  if (error) return databaseError(c, error, 'Erro ao atualizar status da proposta');
  return c.json(data);
});

contratosRoutes.delete('/:id', async (c) => {
  const db = c.get('db');
  const profile = c.get('profile');
  if (!hasPermission(profile, 'contratos', 'excluir', ['GESTOR_PL', 'VENDEDOR', 'SDR_CLOSER'])) {
    return c.json({ error: 'Acesso negado.' }, 403);
  }
  const { proposal, allowed } = await ensureProposalAccess(db, profile, c.req.param('id'));
  if (!proposal) return c.json({ error: 'Proposta nao encontrada' }, 404);
  if (!allowed) return c.json({ error: 'Sem permissao' }, 403);
  const { error } = await db.from('Proposta').update(softDeleteMeta()).eq('id', proposal.id);
  if (error) return databaseError(c, error, 'Erro ao remover proposta');
  return c.json({ message: 'Proposta removida' });
});

