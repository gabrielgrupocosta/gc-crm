"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import axios from 'axios';
import { createClient as createSupabaseClient, getPublicConfig } from '../lib/supabase/client';

const AuthContext = createContext({});
const { publishableKey } = getPublicConfig();

if (publishableKey) {
  axios.defaults.headers.common.apikey = publishableKey;
}

export const ROLE_DEFAULT_PERMISSIONS = {
  ADMIN: {
    dashboard: { ler: true, criar: true, editar: true, excluir: true },
    vendas: { ler: true, criar: true, editar: true, excluir: true },
    financeiro: { ler: true, criar: true, editar: true, excluir: true },
    unidades: { ler: true, criar: true, editar: true, excluir: true },
  },
  FINANCEIRO: {
    dashboard: { ler: true, criar: false, editar: false, excluir: false },
    vendas: { ler: true, criar: false, editar: true, excluir: false },
    financeiro: { ler: true, criar: true, editar: true, excluir: true },
    unidades: { ler: true, criar: false, editar: false, excluir: false },
  },
  GESTOR_PL: {
    dashboard: { ler: true, criar: false, editar: false, excluir: false },
    vendas: { ler: true, criar: true, editar: true, excluir: true },
    financeiro: { ler: true, criar: true, editar: true, excluir: true },
    unidades: { ler: true, criar: false, editar: false, excluir: false },
  },
  VENDEDOR: {
    dashboard: { ler: true, criar: false, editar: false, excluir: false },
    vendas: { ler: true, criar: true, editar: true, excluir: false },
    financeiro: { ler: false, criar: false, editar: false, excluir: false },
    unidades: { ler: false, criar: false, editar: false, excluir: false },
  },
  SDR_CLOSER: {
    dashboard: { ler: true, criar: false, editar: false, excluir: false },
    vendas: { ler: true, criar: true, editar: true, excluir: false },
    financeiro: { ler: false, criar: false, editar: false, excluir: false },
    unidades: { ler: false, criar: false, editar: false, excluir: false },
  },
  COLABORADOR: {
    dashboard: { ler: true, criar: false, editar: false, excluir: false },
    vendas: { ler: false, criar: false, editar: false, excluir: false },
    financeiro: { ler: false, criar: false, editar: false, excluir: false },
    unidades: { ler: false, criar: false, editar: false, excluir: false },
  },
};

export const useAuth = () => useContext(AuthContext);

function authErrorMessage(error) {
  const message = error?.response?.data?.error
    || error?.response?.data?.message
    || error?.message
    || '';

  if (/invalid login credentials/i.test(message)) return 'E-mail ou senha invalidos.';
  if (/email not confirmed/i.test(message)) return 'Confirme seu e-mail antes de entrar.';
  if (/rate limit|too many requests/i.test(message)) return 'Muitas tentativas. Aguarde e tente novamente.';
  if (/perfil|profile/i.test(message)) return message;

  return message || 'Nao foi possivel autenticar.';
}

function extractProfile(payload) {
  const profile = payload?.user || payload?.profile || payload;

  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    throw new Error('Perfil de acesso nao encontrado.');
  }

  return profile;
}

function syncLegacyToken(session) {
  Cookies.remove('user');

  if (!session?.access_token) {
    Cookies.remove('token');
    delete axios.defaults.headers.common.Authorization;
    return;
  }

  const expires = session.expires_at
    ? new Date(session.expires_at * 1000)
    : 1;

  Cookies.set('token', session.access_token, {
    expires,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  axios.defaults.headers.common.Authorization = `Bearer ${session.access_token}`;
}

async function fetchTrustedProfile(accessToken) {
  const response = await axios.get('/api/auth/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  return extractProfile(response.data);
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const syncIdRef = useRef(0);
  const router = useRouter();
  const pathname = usePathname();

  const applySession = useCallback(async (nextSession) => {
    const syncId = ++syncIdRef.current;

    setSession(nextSession || null);
    syncLegacyToken(nextSession);

    if (!nextSession?.access_token) {
      setUser(null);
      setAuthError('');
      return null;
    }

    try {
      const profile = await fetchTrustedProfile(nextSession.access_token);

      if (syncId === syncIdRef.current) {
        setUser(profile);
        setAuthError('');
      }

      return profile;
    } catch (error) {
      if (syncId === syncIdRef.current) {
        setUser(null);
        setAuthError(authErrorMessage(error));
      }

      throw error;
    }
  }, []);

  useEffect(() => {
    let active = true;
    let subscription;

    async function initialize() {
      try {
        const supabase = createSupabaseClient();
        const listener = supabase.auth.onAuthStateChange((event, nextSession) => {
          if (event === 'INITIAL_SESSION') return;

          if (event === 'TOKEN_REFRESHED') {
            setSession(nextSession || null);
            syncLegacyToken(nextSession);
            return;
          }

          window.setTimeout(() => {
            if (!active) return;
            void applySession(nextSession).catch(() => {});
          }, 0);
        });

        subscription = listener.data.subscription;

        const { data, error } = await supabase.auth.getSession();

        if (error) throw error;
        if (!active) return;

        await applySession(data.session);
      } catch (error) {
        if (active) {
          setUser(null);
          setSession(null);
          syncLegacyToken(null);
          setAuthError(authErrorMessage(error));
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void initialize();

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, [applySession]);

  useEffect(() => {
    if (loading) return;

    if (!user && pathname !== '/login') {
      router.replace('/login');
    } else if (user && pathname === '/login') {
      router.replace('/dashboard');
    }
  }, [user, loading, pathname, router]);

  const login = async (email, senha) => {
    setAuthError('');

    try {
      const supabase = createSupabaseClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: senha,
      });

      if (error) throw error;
      if (!data.session) throw new Error('Sessao nao criada pelo Supabase.');

      try {
        await applySession(data.session);
      } catch (profileError) {
        try {
          await supabase.auth.signOut();
        } catch {
          // ignore
        }
        syncLegacyToken(null);
        throw profileError;
      }

      router.replace('/dashboard');
      router.refresh();
      return { success: true };
    } catch (error) {
      const message = authErrorMessage(error);
      setAuthError(message);
      return { success: false, error: message };
    }
  };

  const logout = async () => {
    const supabase = createSupabaseClient();
    let signOutError = null;

    try {
      const { error } = await supabase.auth.signOut();
      signOutError = error;
    } catch (error) {
      signOutError = error;
    }

    syncIdRef.current += 1;
    syncLegacyToken(null);
    setSession(null);
    setUser(null);
    setAuthError(signOutError ? authErrorMessage(signOutError) : '');
    router.replace('/login');
    router.refresh();
  };

  const clearAuthError = () => setAuthError('');
  const isAdmin = user?.role === 'ADMIN';
  const isGestor = user?.role === 'GESTOR_PL';
  const isResponsavel = isGestor;

  const can = (modulo, acao = 'ler') => {
    if (isAdmin) return true;
    const modPerms = user?.permissoes?.[modulo];
    if (modPerms && typeof modPerms === 'object') {
      if (acao === 'ler') {
        return Boolean(modPerms.ler || modPerms.criar || modPerms.editar || modPerms.excluir);
      }
      return Boolean(modPerms[acao]);
    }
    const roleDefaults = ROLE_DEFAULT_PERMISSIONS[user?.role];
    return Boolean(roleDefaults?.[modulo]?.[acao]);
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      authError,
      clearAuthError,
      login,
      logout,
      isAdmin,
      isGestor,
      isResponsavel,
      can,
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
