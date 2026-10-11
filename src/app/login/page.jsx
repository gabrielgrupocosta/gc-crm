"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
// import LogoMark from '../../components/UI/LogoMark'; // Omitido ou adaptado

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
};

export default function Login() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;
    
    setError('');
    setLoading(true);
    
    const result = await login(email.trim(), password);
    
    if (result.success) {
      // O redirecionamento já acontece dentro do AuthContext
    } else {
      setError(result.error || 'Erro ao entrar.');
      setLoading(false);
    }
  }

  return (
    <motion.div
      className="min-h-screen bg-bg flex items-center justify-center px-4"
      variants={pageVariants}
      initial="initial"
      animate="animate"
    >
      <div className="w-full max-w-[360px]">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="select-none font-sans mt-3" style={{ fontSize: '26px', letterSpacing: '-0.02em', fontWeight: 800 }}>
            <span className="text-primary">Grupo Costa</span>
          </span>
          <span className="select-none font-sans" style={{ fontSize: '18px', letterSpacing: '0.1em', fontWeight: 600 }}>
            <span className="text-tertiary">CRM</span>
          </span>
          <p className="mt-2 text-[13px] text-text-subtle">
            Acesso restrito a colaboradores
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface border border-border rounded-xl p-7 shadow-card">
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            {/* E-mail */}
            <div className="flex flex-col gap-1.5">
              <label className="field-label" htmlFor="email">E-mail</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="voce@agencia.com"
                required
                className="input"
              />
            </div>

            {/* Senha */}
            <div className="flex flex-col gap-1.5">
              <label className="field-label" htmlFor="password">Senha</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="input pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-subtle hover:text-text-muted transition-colors duration-150"
                  tabIndex={-1}
                >
                  {showPass
                    ? <EyeOff size={15} strokeWidth={1.5} />
                    : <Eye    size={15} strokeWidth={1.5} />
                  }
                </button>
              </div>
            </div>

            {/* Erro */}
            {error && (
              <p className="text-[13px] text-negative leading-snug">{error}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="btn-primary w-full mt-1 h-9"
            >
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </motion.div>
  );
}
