import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import type { Context, MiddlewareHandler, Next } from 'npm:hono@4.10.7';
import type { AppEnv, DatabaseClient, JsonRecord, Profile, Role } from './types.ts';

const getEnv = (name: string): string => {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Variavel obrigatoria ausente: ${name}`);
  return value;
};

const getPublicKey = (): string => {
  return Deno.env.get('SUPABASE_PUBLISHABLE_KEY')?.trim()
    || Deno.env.get('SUPABASE_ANON_KEY')?.trim()
    || getEnv('SUPABASE_PUBLISHABLE_KEY');
};

const getSecretKey = (): string => {
  return Deno.env.get('SUPABASE_SECRET_KEY')?.trim()
    || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()
    || getEnv('SUPABASE_SECRET_KEY');
};

export const createPublicClient = (accessToken?: string): DatabaseClient => {
  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
  return createClient(getEnv('SUPABASE_URL'), getPublicKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: headers ? { headers } : undefined,
  });
};

const createPrivilegedClient = (): DatabaseClient => {
  return createClient(getEnv('SUPABASE_URL'), getSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
};

export const corsMiddleware = (): MiddlewareHandler<AppEnv> => {
  const defaultOrigins = [
    'https://gc-crm-navy.vercel.app',
    'https://crm.grupocosta.com.br',
    'http://localhost:3000',
  ];
  const configured = (Deno.env.get('CORS_ORIGIN') || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowed = new Set([...defaultOrigins, ...configured]);

  const isAllowedOrigin = (origin: string): boolean => {
    if (allowed.has('*') || allowed.has(origin)) return true;
    if (/^https:\/\/gc-crm[a-z0-9-]*\.vercel\.app$/i.test(origin)) return true;
    if (/^https:\/\/([a-z0-9-]+\.)?grupocosta\.com\.br$/i.test(origin)) return true;
    return false;
  };

  return async (c: Context<AppEnv>, next: Next) => {
    const origin = c.req.header('Origin');
    if (origin && !isAllowedOrigin(origin)) {
      return c.json({ error: 'Origem nao permitida pelo CORS.' }, 403);
    }

    if (origin) {
      c.header('Access-Control-Allow-Origin', origin);
      c.header('Vary', 'Origin');
      c.header('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
      c.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      c.header('Access-Control-Max-Age', '86400');
    }

    if (c.req.method === 'OPTIONS') return c.body(null, 204);
    await next();
  };
};

export const authMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Token nao fornecido ou invalido.' }, 401);
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return c.json({ error: 'Token nao fornecido ou invalido.' }, 401);

  try {
    const userClient = createPublicClient(token);
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) {
      return c.json({ error: 'Token expirado ou invalido.' }, 401);
    }

    // The RPC is SECURITY DEFINER in the database migration and returns only
    // the active profile bound to auth.uid(). Direct User reads are purposely
    // not required here because that table has restricted column grants.
    const { data: rpcProfile, error: profileError } = await userClient.rpc('crm_current_profile');
    const rawProfile = Array.isArray(rpcProfile) ? rpcProfile[0] : rpcProfile;

    if (profileError || !rawProfile || rawProfile.id !== authData.user.id) {
      return c.json({ error: 'Usuario nao encontrado ou inativo.' }, 401);
    }

    const profile = rawProfile as Profile;
    if (!profile.role) return c.json({ error: 'Perfil de usuario invalido.' }, 403);

    // The privileged client is intentionally instantiated only after both the
    // Auth identity and the matching active application profile are verified.
    const db = createPrivilegedClient();
    c.set('authUser', authData.user);
    c.set('profile', profile);
    c.set('userClient', userClient);
    c.set('db', db);
    c.set('accessToken', token);
    await next();
  } catch (error) {
    console.error('Authentication failure', error instanceof Error ? error.message : error);
    return c.json({ error: 'Erro ao validar autenticacao.' }, 500);
  }
};

export const requireRoles = (...roles: Role[]): MiddlewareHandler<AppEnv> => {
  return async (c, next) => {
    if (!roles.includes(c.get('profile').role)) {
      return c.json({ error: 'Acesso negado.' }, 403);
    }
    await next();
  };
};

export const parseJson = async (c: Context<AppEnv>): Promise<JsonRecord | null> => {
  try {
    const value = await c.req.json();
    return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null;
  } catch {
    return null;
  }
};

export const nowIso = (): string => new Date().toISOString();

export const insertMeta = (): { id: string; createdAt: string; updatedAt: string } => {
  const now = nowIso();
  return { id: crypto.randomUUID(), createdAt: now, updatedAt: now };
};

export const updatedMeta = (): { updatedAt: string } => ({ updatedAt: nowIso() });

export const softDeleteMeta = (): { deletedAt: string; updatedAt: string } => {
  const now = nowIso();
  return { deletedAt: now, updatedAt: now };
};

export const asOptionalString = (value: unknown): string | null => {
  if (value === undefined || value === null || value === '') return null;
  return typeof value === 'string' ? value : null;
};

export const asNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const isUuid = (value: unknown): value is string => {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
};

export const isOneOf = <T extends readonly string[]>(value: unknown, values: T): value is T[number] => {
  return typeof value === 'string' && values.includes(value as T[number]);
};

export const databaseError = (
  c: Context<AppEnv>,
  error: unknown,
  message: string,
  status: 400 | 404 | 409 | 500 = 500,
) => {
  console.error(message, error);
  return c.json({ error: message }, status);
};

export const normalizePathPrefix = (path: string): string => {
  return path.startsWith('/crm-api') ? path.slice('/crm-api'.length) || '/' : path;
};
