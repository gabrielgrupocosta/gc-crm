import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
}

// ─── Marca (hexágono + pin/gráfico) — mesma marca usada na Sidebar ─────────────

function LogoMark({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id="ihubGradLogin" x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FF7A3D" />
          <stop offset="1" stopColor="#FF4B2E" />
        </linearGradient>
      </defs>
      <polygon points="12,2 20.66,7 20.66,17 12,22 3.34,17 3.34,7" fill="url(#ihubGradLogin)" stroke="url(#ihubGradLogin)" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 7.5c-2.21 0-4 1.7-4 3.8 0 2.62 4 6.7 4 6.7s4-4.08 4-6.7c0-2.1-1.79-3.8-4-3.8Z" fill="#FFFFFF" />
      <rect x="10.1" y="10.6" width="1.15" height="2.3" rx="0.3" fill="url(#ihubGradLogin)" />
      <rect x="11.8" y="9.4" width="1.15" height="3.5" rx="0.3" fill="url(#ihubGradLogin)" />
      <rect x="13.5" y="10.1" width="1.15" height="2.8" rx="0.3" fill="url(#ihubGradLogin)" />
    </svg>
  )
}

const ERROR_MESSAGES = {
  // Firebase Auth
  'auth/invalid-credential':     'E-mail ou senha incorretos.',
  'auth/user-not-found':         'E-mail não cadastrado.',
  'auth/wrong-password':         'Senha incorreta.',
  'auth/invalid-email':          'Formato de e-mail inválido.',
  'auth/user-disabled':          'Conta desativada. Fale com o administrador.',
  'auth/too-many-requests':      'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  'auth/network-request-failed': 'Sem conexão. Verifique sua internet.',
  'auth/operation-not-allowed':  'Login com e-mail não está ativado. Habilite em Firebase → Authentication → Sign-in method.',
  'auth/missing-password':       'Informe a senha.',
  // Firestore (lançados pelo login() no AuthContext)
  'permission-denied':           'Sem permissão para ler dados. Verifique as regras do Firestore.',
}

function parseError(err) {
  if (!err) return 'Erro desconhecido.'
  // Erros customizados (new Error) não têm code → retorna a mensagem diretamente
  if (err.message && !err.code) return err.message
  return ERROR_MESSAGES[err.code] ?? `Erro ao entrar. (${err.code ?? 'desconhecido'})`
}

export default function Login() {
  const { login } = useAuth()
  const navigate  = useNavigate()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (loading) return
    setError('')
    setLoading(true)
    try {
      await login(email.trim(), password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(parseError(err))
    } finally {
      setLoading(false)
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
          <LogoMark size={40} />
          <span className="select-none font-sans mt-3" style={{ fontSize: '20px', letterSpacing: '-0.02em', fontWeight: 800 }}>
            <span style={{ color: '#111111' }}>iHub</span>
            <span style={{ color: '#FF4B2E' }}>Food</span>
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
                placeholder="voce@empresa.com"
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
  )
}
