"use client";

import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Cookies from 'js-cookie';
import axios from 'axios';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = Cookies.get('token');
    const storedUser = Cookies.get('user');

    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // Redirecionamento de rotas protegidas
    if (!loading) {
      if (!user && pathname !== '/login') {
        router.push('/login');
      } else if (user && pathname === '/login') {
        router.push('/dashboard');
      }
    }
  }, [user, loading, pathname, router]);

  const login = async (email, senha) => {
    try {
      const response = await axios.post('/api/auth/login', { email, senha });
      const { token, user: userData } = response.data;
      
      Cookies.set('token', token, { expires: 1 });
      Cookies.set('user', JSON.stringify(userData), { expires: 1 });
      
      setUser(userData);
      router.push('/dashboard');
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Erro ao logar' };
    }
  };

  const logout = () => {
    Cookies.remove('token');
    Cookies.remove('user');
    setUser(null);
    router.push('/login');
  };

  const isAdmin = user?.role === 'ADMIN';
  const isResponsavel = user?.role === 'RESPONSAVEL';

  const can = (modulo, acao) => {
    if (isAdmin) return true;
    if (user?.permissoes && user.permissoes[modulo] && user.permissoes[modulo][acao] === true) {
      return true;
    }
    return false;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin, isResponsavel, can }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
