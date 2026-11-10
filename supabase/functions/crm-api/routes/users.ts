import { Hono } from 'npm:hono@4.10.7';
import bcrypt from 'npm:bcryptjs@2.4.3';
import {
  asNumber,
  authMiddleware,
  databaseError,
  nowIso,
  parseJson,
  requireRoles,
  softDeleteMeta,
  updatedMeta,
} from '../platform.ts';
import { ROLES, type AppEnv } from '../types.ts';

export const usersRoutes = new Hono<AppEnv>();
usersRoutes.use('*', authMiddleware, requireRoles('ADMIN'));

usersRoutes.get('/', async (c) => {
  const db = c.get('db');
  const [{ data: users, error }, { data: units, error: unitsError }] = await Promise.all([
    db
      .from('User')
      .select('id,nome,email,role,tipoVendedor,metas,createdAt,permissoes,gestorId,unidadeId')
      .is('deletedAt', null)
      .order('nome'),
    db
      .from('Unidade')
      .select('id,nome')
      .is('deletedAt', null),
  ]);

  if (error) return databaseError(c, error, 'Erro ao buscar usuarios.');
  if (unitsError) return databaseError(c, unitsError, 'Erro ao buscar unidades dos usuarios.');

  const usersById = new Map((users || []).map((u) => [u.id, { nome: u.nome }]));
  const unitsById = new Map((units || []).map((u) => [u.id, { nome: u.nome }]));

  const payload = (users || []).map(({ gestorId, unidadeId, ...user }) => ({
    ...user,
    gestorId,
    unidadeId,
    gestor: gestorId ? usersById.get(gestorId) || null : null,
    unidade: unidadeId ? unitsById.get(unidadeId) || null : null,
  }));

  return c.json(payload);
});

usersRoutes.post('/', async (c) => {
  const body = await parseJson(c);
  if (!body) return c.json({ error: 'Erro de validacao' }, 400);

  const nome = typeof body.nome === 'string' ? body.nome.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const senha = typeof body.senha === 'string' ? body.senha : '';
  const role = typeof body.role === 'string' ? body.role : '';
  const tipoVendedor = body.tipoVendedor === 'GC' || body.tipoVendedor === 'TERCEIRIZADO'
    ? body.tipoVendedor
    : null;
  const gestorId = typeof body.gestorId === 'string' && body.gestorId ? body.gestorId : null;
  const unidadeId = typeof body.unidadeId === 'string' && body.unidadeId ? body.unidadeId : null;
  const metas = body.metas === undefined || body.metas === null || body.metas === ''
    ? null
    : asNumber(body.metas);

  if (!nome || !/^\S+@\S+\.\S+$/.test(email) || senha.length < 6 || !ROLES.includes(role as any)) {
    return c.json({ error: 'Dados de usuario invalidos.' }, 400);
  }
  if (body.metas !== undefined && body.metas !== null && body.metas !== '' && metas === null) {
    return c.json({ error: 'Meta invalida.' }, 400);
  }

  const db = c.get('db');
  const { data: existing } = await db
    .from('User')
    .select('id,deletedAt')
    .eq('email', email)
    .maybeSingle();

  if (existing && !existing.deletedAt) {
    return c.json({ error: 'E-mail ja cadastrado.' }, 400);
  }

  const now = nowIso();
  const senhaHash = await bcrypt.hash(senha, 10);

  // If the user was previously soft-deleted, reactivate and update both Auth and public.User
  if (existing && existing.deletedAt) {
    const { data: authRecord } = await db.auth.admin.getUserById(existing.id);
    if (authRecord?.user) {
      const { error: authUpdateErr } = await db.auth.admin.updateUserById(existing.id, {
        email,
        password: senha,
        email_confirm: true,
        ban_duration: 'none',
        user_metadata: { nome },
        app_metadata: { role },
      });
      if (authUpdateErr) {
        return databaseError(c, authUpdateErr, 'Erro ao reativar usuario no Auth.', 400);
      }
    } else {
      const { error: authCreateErr } = await db.auth.admin.createUser({
        id: existing.id,
        email,
        password: senha,
        email_confirm: true,
        user_metadata: { nome },
        app_metadata: { role },
      });
      if (authCreateErr) {
        return databaseError(c, authCreateErr, 'Erro ao recriar usuario no Auth.', 400);
      }
    }

    const { data: reactivated, error: reactivateError } = await db
      .from('User')
      .update({
        authUserId: existing.id,
        nome,
        email,
        senha: senhaHash,
        role,
        tipoVendedor,
        metas,
        gestorId,
        unidadeId,
        deletedAt: null,
        updatedAt: now,
      })
      .eq('id', existing.id)
      .select('id,nome,email,role')
      .single();

    if (reactivateError) {
      return databaseError(c, reactivateError, 'Erro ao reativar usuario.');
    }

    return c.json(reactivated, 201);
  }

  const { data: authData, error: authError } = await db.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome },
    app_metadata: { role },
  });
  if (authError || !authData.user) {
    return databaseError(c, authError, 'Erro ao criar usuario no Auth.', 400);
  }

  const baseUserRow = {
    id: authData.user.id,
    authUserId: authData.user.id,
    nome,
    email,
    senha: senhaHash,
    role,
    tipoVendedor,
    metas,
    gestorId,
    unidadeId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  let createResult = await db
    .from('User')
    .insert(baseUserRow)
    .select('id,nome,email,role')
    .single();

  if (createResult.error
    && (createResult.error.code === 'PGRST204' || createResult.error.message?.includes('authUserId'))) {
    const { authUserId: _omitted, ...legacyRow } = baseUserRow;
    createResult = await db
      .from('User')
      .insert(legacyRow)
      .select('id,nome,email,role')
      .single();
  }

  const { data: user, error: userError } = createResult;

  if (userError) {
    await db.auth.admin.deleteUser(authData.user.id).catch(() => undefined);
    return databaseError(c, userError, 'Erro ao criar usuario.');
  }

  return c.json(user, 201);
});

usersRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await parseJson(c);
  if (!body) return c.json({ error: 'Dados invalidos.' }, 400);

  const db = c.get('db');
  const { data: existing, error: findError } = await db
    .from('User')
    .select('id,nome,email,senha,role,tipoVendedor,metas,gestorId,unidadeId')
    .eq('id', id)
    .is('deletedAt', null)
    .maybeSingle();
  if (findError) return databaseError(c, findError, 'Erro ao atualizar usuario.');
  if (!existing) return c.json({ error: 'Usuario nao encontrado' }, 404);

  const nome = body.nome === undefined
    ? existing.nome
    : typeof body.nome === 'string' ? body.nome.trim() : '';
  const email = body.email === undefined
    ? existing.email
    : typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const newPassword = typeof body.senha === 'string' && body.senha !== '********' && body.senha !== ''
    ? body.senha
    : null;
  if (!nome || !/^\S+@\S+\.\S+$/.test(email) || (newPassword !== null && newPassword.length < 6)) {
    return c.json({ error: 'Dados de usuario invalidos.' }, 400);
  }

  const patch: Record<string, unknown> = { nome, email, ...updatedMeta() };
  if (body.role !== undefined) {
    if (typeof body.role !== 'string' || !ROLES.includes(body.role as any)) {
      return c.json({ error: 'Role invalida.' }, 400);
    }
    patch.role = body.role;
  }
  if (body.unidadeId !== undefined) patch.unidadeId = body.unidadeId || null;
  if (body.gestorId !== undefined) patch.gestorId = body.gestorId || null;
  if (body.tipoVendedor !== undefined) {
    patch.tipoVendedor = body.tipoVendedor === 'GC' || body.tipoVendedor === 'TERCEIRIZADO'
      ? body.tipoVendedor
      : null;
  }
  if (body.metas !== undefined) {
    const metas = body.metas === '' || body.metas === null ? null : asNumber(body.metas);
    if (body.metas !== '' && body.metas !== null && metas === null) {
      return c.json({ error: 'Meta invalida.' }, 400);
    }
    patch.metas = metas;
  }

  if (newPassword !== null) patch.senha = await bcrypt.hash(newPassword, 10);

  const { data: authRecord, error: authLookupError } = await db.auth.admin.getUserById(id);
  if (authLookupError || !authRecord.user) {
    return databaseError(c, authLookupError, 'Usuario nao encontrado no Auth.', 409);
  }

  const { data, error } = await db
    .from('User')
    .update(patch)
    .eq('id', id)
    .is('deletedAt', null)
    .select('id,nome,email,role')
    .single();
  if (error) return databaseError(c, error, 'Erro ao atualizar usuario');

  const nextRole = typeof patch.role === 'string' ? patch.role : existing.role;
  const authPatch: Record<string, unknown> = {
    email,
    email_confirm: true,
    user_metadata: { ...(authRecord.user.user_metadata || {}), nome },
    app_metadata: { ...(authRecord.user.app_metadata || {}), role: nextRole },
  };
  if (newPassword !== null) authPatch.password = newPassword;
  const { error: authUpdateError } = await db.auth.admin.updateUserById(id, authPatch);
  if (authUpdateError) {
    const rollback = {
      nome: existing.nome,
      email: existing.email,
      senha: existing.senha,
      role: existing.role,
      tipoVendedor: existing.tipoVendedor,
      metas: existing.metas,
      gestorId: existing.gestorId,
      unidadeId: existing.unidadeId,
      ...updatedMeta(),
    };
    await db.from('User').update(rollback).eq('id', id).is('deletedAt', null);
    return databaseError(c, authUpdateError, 'Erro ao sincronizar usuario no Auth.', 500);
  }

  return c.json(data);
});

usersRoutes.put('/:id/permissions', async (c) => {
  const id = c.req.param('id');
  const body = await parseJson(c);
  if (!body || typeof body.permissoes !== 'object') {
    return c.json({ error: 'Permissoes invalidas.' }, 400);
  }

  const db = c.get('db');
  const { data, error } = await db
    .from('User')
    .update({ permissoes: body.permissoes, ...updatedMeta() })
    .eq('id', id)
    .is('deletedAt', null)
    .select('id,nome,permissoes')
    .maybeSingle();

  if (error) return databaseError(c, error, 'Erro ao atualizar permissoes');
  if (!data) return c.json({ error: 'Usuario nao encontrado.' }, 404);
  return c.json(data);
});

usersRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const profile = c.get('profile');
  if (id === profile.id) {
    return c.json({ error: 'Voce nao pode excluir seu proprio usuario.' }, 400);
  }

  const db = c.get('db');
  const { data: existing, error: findError } = await db
    .from('User')
    .select('id')
    .eq('id', id)
    .is('deletedAt', null)
    .maybeSingle();
  if (findError) return databaseError(c, findError, 'Erro ao excluir usuario');
  if (!existing) return c.json({ error: 'Usuario nao encontrado.' }, 404);

  const { error: authBanError } = await db.auth.admin.updateUserById(id, {
    ban_duration: '876000h',
  });
  if (authBanError) {
    return databaseError(c, authBanError, 'Erro ao revogar acesso do usuario no Auth.');
  }

  const { error } = await db.from('User').update(softDeleteMeta()).eq('id', id).is('deletedAt', null);
  if (error) {
    await db.auth.admin.updateUserById(id, { ban_duration: 'none' }).catch(() => undefined);
    return databaseError(c, error, 'Erro ao excluir usuario');
  }

  return c.body(null, 204);
});
