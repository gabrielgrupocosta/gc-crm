import { Hono } from 'npm:hono@4.10.7';
import { hasPermission, loadClientInScope } from '../access.ts';
import {
  authMiddleware,
  databaseError,
  insertMeta,
  parseJson,
  softDeleteMeta,
  updatedMeta,
} from '../platform.ts';
import { deleteStoredFile, signDocuments, signStoredPath, uploadFile, validateUpload } from '../storage.ts';
import type { AppEnv } from '../types.ts';

export const documentosRoutes = new Hono<AppEnv>();
documentosRoutes.use('*', authMiddleware);

documentosRoutes.get('/:clienteId', async (c) => {
  const db = c.get('db');
  const profile = c.get('profile');
  if (!hasPermission(profile, 'documentos', 'ler', ['FINANCEIRO', 'GESTOR_PL', 'VENDEDOR', 'SDR_CLOSER', 'COLABORADOR'])) {
    return c.json({ error: 'Acesso negado.' }, 403);
  }
  const { client, allowed } = await loadClientInScope(db, profile, c.req.param('clienteId'), ['ADMIN', 'FINANCEIRO']);
  if (!client) return c.json({ error: 'Cliente nao encontrado.' }, 404);
  if (!allowed) return c.json({ error: 'Sem permissao.' }, 403);

  const { data, error } = await db
    .from('Documento')
    .select('*')
    .eq('clienteId', client.id)
    .is('deletedAt', null)
    .order('createdAt', { ascending: false });
  if (error) return databaseError(c, error, 'Erro ao buscar documentos.');
  try {
    return c.json(await signDocuments(db, data || []));
  } catch (error) {
    return databaseError(c, error, 'Erro ao gerar acesso aos documentos.');
  }
});

documentosRoutes.post('/', async (c) => {
  const db = c.get('db');
  const profile = c.get('profile');
  if (!hasPermission(profile, 'documentos', 'criar', ['GESTOR_PL', 'VENDEDOR', 'SDR_CLOSER', 'COLABORADOR'])) {
    return c.json({ error: 'Acesso negado.' }, 403);
  }

  let form: Record<string, string | File | (string | File)[]>;
  try {
    form = await c.req.parseBody({ all: true });
  } catch {
    return c.json({ error: 'Formulario de upload invalido.' }, 400);
  }
  const rawFile = form.arquivo;
  const file = rawFile instanceof File ? rawFile : Array.isArray(rawFile) && rawFile[0] instanceof File ? rawFile[0] : null;
  const rawClientId = form.clienteId;
  const clienteId = typeof rawClientId === 'string' ? rawClientId : '';
  if (!file) return c.json({ error: 'Nenhum arquivo enviado.' }, 400);
  const validationError = validateUpload(file);
  if (validationError) return c.json({ error: validationError }, 400);

  const { client, allowed } = await loadClientInScope(db, profile, clienteId, ['ADMIN', 'FINANCEIRO']);
  if (!client) return c.json({ error: 'Cliente nao encontrado.' }, 404);
  if (!allowed) return c.json({ error: 'Sem permissao.' }, 403);

  let storedPath = '';
  try {
    storedPath = await uploadFile(db, file, `clientes/${clienteId}`);
    const { data: document, error } = await db
      .from('Documento')
      .insert({
        ...insertMeta(),
        nomeArquivo: file.name,
        urlCaminho: storedPath,
        tipoArquivo: file.type || null,
        clienteId,
        propostaId: null,
        deletedAt: null,
      })
      .select('*')
      .single();
    if (error) throw error;
    return c.json({ ...document, urlCaminho: await signStoredPath(db, storedPath) }, 201);
  } catch (error) {
    if (storedPath) await deleteStoredFile(db, storedPath).catch(() => undefined);
    return databaseError(c, error, 'Erro ao salvar documento.');
  }
});

documentosRoutes.put('/:id', async (c) => {
  const db = c.get('db');
  const profile = c.get('profile');
  if (!hasPermission(profile, 'documentos', 'editar', ['GESTOR_PL', 'COLABORADOR'])) {
    return c.json({ error: 'Acesso negado.' }, 403);
  }
  const id = c.req.param('id');
  const { data: document, error: findError } = await db
    .from('Documento')
    .select('*')
    .eq('id', id)
    .is('deletedAt', null)
    .maybeSingle();
  if (findError) return databaseError(c, findError, 'Erro ao atualizar documento');
  if (!document) return c.json({ error: 'Documento nao encontrado' }, 404);
  const { allowed } = await loadClientInScope(db, profile, document.clienteId, ['ADMIN', 'FINANCEIRO']);
  if (!allowed) return c.json({ error: 'Sem permissao para editar' }, 403);
  const body = await parseJson(c);
  const nomeArquivo = typeof body?.nomeArquivo === 'string' ? body.nomeArquivo.trim() : '';
  if (!nomeArquivo) return c.json({ error: 'Nome do arquivo invalido.' }, 400);

  const { data, error } = await db
    .from('Documento')
    .update({ nomeArquivo, ...updatedMeta() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) return databaseError(c, error, 'Erro ao atualizar documento');
  return c.json(data);
});

documentosRoutes.delete('/:id', async (c) => {
  const db = c.get('db');
  const profile = c.get('profile');
  if (!hasPermission(profile, 'documentos', 'excluir', ['GESTOR_PL'])) {
    return c.json({ error: 'Acesso negado.' }, 403);
  }
  const id = c.req.param('id');
  const { data: document, error: findError } = await db
    .from('Documento')
    .select('*')
    .eq('id', id)
    .is('deletedAt', null)
    .maybeSingle();
  if (findError) return databaseError(c, findError, 'Erro ao remover documento');
  if (!document) return c.json({ error: 'Documento nao encontrado' }, 404);
  const { allowed } = await loadClientInScope(db, profile, document.clienteId, ['ADMIN', 'FINANCEIRO']);
  if (!allowed) return c.json({ error: 'Sem permissao' }, 403);

  const { error: updateError } = await db.from('Documento').update(softDeleteMeta()).eq('id', id);
  if (updateError) return databaseError(c, updateError, 'Erro ao remover documento');
  try {
    await deleteStoredFile(db, document.urlCaminho);
  } catch (error) {
    await db.from('Documento').update({ deletedAt: null, ...updatedMeta() }).eq('id', id);
    return databaseError(c, error, 'Erro ao remover documento');
  }
  return c.json({ message: 'Documento removido' });
});

