import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import LogoMark from '../components/UI/LogoMark'
import CoinSpinIntro from '../components/UI/CoinSpinIntro'

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
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
  const { login, finalizarIntro } = useAuth()
  const navigate  = useNavigate()

  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [showPass,     setShowPass]     = useState(false)
  const [error,        setError]        = useState('')
  const [loading,       setLoading]       = useState(false)
  const [entrandoIntro, setEntrandoIntro] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (loading) return
    setError('')
    setLoading(true)
    try {
      await login(email.trim(), password)
      setLoading(false)
      setEntrandoIntro(true)
      setTimeout(() => {
        finalizarIntro()
        navigate('/dashboard', { replace: true })
      }, 4000)
    } catch (err) {
      setError(parseError(err))
      setLoading(false)
    }
  }

  if (entrandoIntro) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <CoinSpinIntro size={140} />
      </div>
    )
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
          <LogoMark size={64} />
          <span className="select-none font-sans mt-3" style={{ fontSize: '24px', letterSpacing: '-0.02em', fontWeight: 800 }}>
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
