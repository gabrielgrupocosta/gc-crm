import { Hono } from 'npm:hono@4.10.7';
import { authMiddleware, createPublicClient, parseJson } from '../platform.ts';
import type { AppEnv, Profile } from '../types.ts';

export const authRoutes = new Hono<AppEnv>();

// Compatibility endpoint for the legacy frontend. The migrated frontend may
// call signInWithPassword directly and then use GET /auth/me.
authRoutes.post('/login', async (c) => {
  const body = await parseJson(c);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const senha = typeof body?.senha === 'string' ? body.senha : '';
  if (!email || !senha) return c.json({ error: 'Credenciais invalidas.' }, 401);

  const publicClient = createPublicClient();
  const { data, error } = await publicClient.auth.signInWithPassword({ email, password: senha });
  if (error || !data.session || !data.user) {
    return c.json({ error: 'Credenciais invalidas.' }, 401);
  }

  const userClient = createPublicClient(data.session.access_token);
  const { data: rpcProfile, error: profileError } = await userClient.rpc('crm_current_profile');
  const profile = Array.isArray(rpcProfile) ? rpcProfile[0] : rpcProfile;

  if (profileError || !profile || profile.id !== data.user.id) {
    await publicClient.auth.signOut();
    return c.json({ error: 'Usuario nao encontrado ou inativo.' }, 401);
  }

  return c.json({
    token: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at,
    user: {
      id: profile.id,
      nome: profile.nome,
      email: profile.email,
      role: profile.role,
      tipoVendedor: profile.tipoVendedor,
      unidadeId: profile.unidadeId,
      gestorId: profile.gestorId,
      metas: profile.metas,
      permissoes: profile.permissoes,
    },
  });
});

authRoutes.get('/me', authMiddleware, (c) => {
  const profile = c.get('profile') as Profile;
  return c.json({
    user: {
      id: profile.id,
      nome: profile.nome,
      email: profile.email,
      role: profile.role,
      tipoVendedor: profile.tipoVendedor,
      unidadeId: profile.unidadeId,
      gestorId: profile.gestorId,
      metas: profile.metas,
      permissoes: profile.permissoes,
    },
  });
});

