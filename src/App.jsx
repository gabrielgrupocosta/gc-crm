import { useState, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, AlertTriangle, X } from 'lucide-react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { SidebarProvider, useSidebar } from './contexts/SidebarContext'
import { AssistenteChatProvider } from './contexts/AssistenteChatContext'
import { ToastProvider } from './components/UI/Toast'
import { useLembretes } from './hooks/useLembretes'
import { useLojasSemGestor } from './hooks/useLojasSemGestor'
import usePageTitle from './hooks/usePageTitle'
import Sidebar from './components/Layout/Sidebar'
import AssistenteFloatingButton from './components/Layout/AssistenteFloatingButton'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Lojas from './pages/Lojas'
import Clientes from './pages/Clientes'
import Contratos from './pages/Contratos'
import Financeiro from './pages/Financeiro'
import AssistenteDelivery from './pages/AssistenteDelivery'
import Gestores from './pages/Gestores'
import Organizacoes from './pages/Organizacoes'
import CRM from './pages/CRM'
import ControleSemanal from './pages/ControleSemanal'
import Ranking from './pages/Ranking'
import Comparativo from './pages/Comparativo'
import Feedback from './pages/Feedback'
import Carteira from './pages/Carteira'
import Atividades from './pages/Atividades'
import Onboard from './pages/Onboard'

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="flex gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-text-subtle animate-skeleton" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-text-subtle animate-skeleton" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-text-subtle animate-skeleton" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  )
}

// Redireciona para /login se não autenticado
function PrivateRoute() {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}

// Bloqueia rotas exclusivas de admin
function AdminRoute() {
  const { user, loading, isAdmin } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

// Bloqueia rotas exclusivas de master (gestão da plataforma como um todo)
function SuperAdminRoute() {
  const { user, loading, isSuperAdmin } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

// Redireciona para /dashboard se já autenticado
function PublicRoute() {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (user) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

// ─── Popup de lembrete de tarefa ───────────────────────────────────────────────

function LembreteModal({ lembrete, onConcluir, onAdiar, onVerTodas }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[200] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.94 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        style={{
          backgroundColor: '#FFFFFF',
          border: '2px solid #E5322D',
          borderRadius: '12px',
          padding: '28px',
          maxWidth: '380px',
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          textAlign: 'center',
        }}
      >
        <motion.div
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            display: 'inline-flex', width: '48px', height: '48px', borderRadius: '50%',
            backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center', marginBottom: '14px',
          }}
        >
          <Bell size={24} color="#E5322D" strokeWidth={2} />
        </motion.div>

        <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111111', marginBottom: '4px' }}>
          Lembrete de Tarefa!
        </h2>
        <p style={{ fontSize: '13px', color: '#E5322D', fontWeight: 500, marginBottom: '12px' }}>
          {lembrete.lojaNome || 'Loja'}
        </p>
        <p style={{ fontSize: '14px', color: '#111111', lineHeight: 1.5, marginBottom: lembrete.observacao ? '8px' : '20px' }}>
          {lembrete.descricao}
        </p>
        {lembrete.observacao && (
          <p style={{ fontSize: '12px', color: '#666666', lineHeight: 1.5, marginBottom: '20px' }}>
            {lembrete.observacao}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <button onClick={onConcluir} className="btn-primary w-full">Concluir tarefa</button>
          <button onClick={onAdiar} className="btn-secondary w-full">Lembrar amanhã</button>
          <button
            onClick={onVerTodas}
            style={{ fontSize: '12px', color: '#666666', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', marginTop: '2px' }}
          >
            Ver todas as tarefas
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function LembretesGlobais() {
  const navigate = useNavigate()
  const { lembreteAtual, concluirAtual, adiarAmanhaAtual, fecharAtual } = useLembretes()

  function handleVerTodas() {
    fecharAtual()
    navigate('/atividades')
  }

  return (
    <AnimatePresence>
      {lembreteAtual && (
        <LembreteModal
          key={lembreteAtual.id}
          lembrete={lembreteAtual}
          onConcluir={concluirAtual}
          onAdiar={adiarAmanhaAtual}
          onVerTodas={handleVerTodas}
        />
      )}
    </AnimatePresence>
  )
}

// ─── Notificação flutuante: lojas sem gestor ───────────────────────────────────

function LojasSemGestorAlerta() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAdmin } = useAuth()
  const { lojas } = useLojasSemGestor()
  const [dismissedIds, setDismissedIds] = useState(() => new Set())

  if (!isAdmin || location.pathname === '/lojas') return null

  const idsAtuais = lojas.map(l => l.id)
  const pendentes = idsAtuais.filter(id => !dismissedIds.has(id))
  const visivel = pendentes.length > 0

  function handleVerLojas() {
    navigate('/lojas', { state: { filtroSemGestor: true } })
  }

  function handleFechar() {
    setDismissedIds(prev => new Set([...prev, ...idsAtuais]))
  }

  return (
    <AnimatePresence>
      {visivel && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.97 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="fixed bottom-5 left-5 z-[100] flex items-start gap-3 max-w-sm"
          style={{
            backgroundColor: '#E5322D',
            borderRadius: '10px',
            padding: '16px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            fontFamily: "'Segoe UI', system-ui, sans-serif",
          }}
        >
          <AlertTriangle size={18} strokeWidth={1.75} color="#FFFFFF" className="shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p style={{ fontSize: '14px', fontWeight: 600, letterSpacing: '0.01em', textTransform: 'uppercase', color: '#FFFFFF', marginBottom: '3px' }}>
              {pendentes.length === 1 ? '1 loja sem gestor' : `${pendentes.length} lojas sem gestor`}
            </p>
            <p style={{ fontSize: '12px', fontWeight: 400, color: 'rgba(255,255,255,0.82)', lineHeight: 1.45, marginBottom: '12px' }}>
              Essas lojas não aparecem no controle semanal de nenhum gestor.
            </p>
            <button
              onClick={handleVerLojas}
              style={{ width: '100%', height: '28px', padding: '0 12px', fontSize: '12px', fontWeight: 500, color: '#E5322D', backgroundColor: '#FFFFFF', border: 'none', borderRadius: '6px', cursor: 'pointer', transition: 'opacity 150ms' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              Ver lojas
            </button>
          </div>
          <button
            onClick={handleFechar}
            className="shrink-0 transition-opacity duration-150"
            style={{ marginTop: '1px', color: 'rgba(255,255,255,0.75)' }}
            onMouseEnter={e => e.currentTarget.style.color = '#FFFFFF'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.75)'}
          >
            <X size={14} strokeWidth={1.75} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function MainContent() {
  const { collapsed } = useSidebar()
  const { pathname } = useLocation()
  const mainRef = useRef(null)

  // <main> é o mesmo nó do DOM entre navegações (só o <Outlet/> troca) — sem
  // isso, o scroll de uma página ficava "grudado" na próxima: ao navegar de
  // uma tela rolada pra outra, a nova já carregava com o topo scrollado pra
  // fora, escondendo o título atrás do botão de menu fixo no mobile.
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0)
  }, [pathname])

  // Sem margem no mobile — lá a sidebar é um drawer sobreposto, não ocupa
  // espaço no layout. A partir de md volta a ser a sidebar fixa de sempre.
  return (
    <main
      ref={mainRef}
      className={`h-screen overflow-y-auto ml-0 pt-14 md:pt-0 transition-[margin-left] duration-200 ease-out ${collapsed ? 'md:ml-[52px]' : 'md:ml-[220px]'}`}
    >
      <Outlet />
    </main>
  )
}

function AppLayout() {
  return (
    <SidebarProvider>
      <AssistenteChatProvider>
        <div className="bg-bg">
          <Sidebar />
          <MainContent />
          <AssistenteFloatingButton />
        </div>
      </AssistenteChatProvider>
    </SidebarProvider>
  )
}

function AppRoutes() {
  usePageTitle()

  return (
    <Routes>
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<Login />} />
      </Route>

      <Route element={<PrivateRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard"    element={<Dashboard />} />
          <Route path="/ranking"     element={<Ranking />} />
          <Route path="/controle"    element={<ControleSemanal />} />
          <Route path="/assistente"  element={<AssistenteDelivery />} />
          <Route path="/comparativo" element={<Comparativo />} />
          <Route path="/crm"         element={<CRM />} />
          <Route path="/carteira"    element={<Carteira />} />
          <Route path="/atividades"  element={<Atividades />} />
          <Route path="/feedback"    element={<Feedback />} />
          <Route path="/onboard"     element={<Onboard />} />

          <Route element={<AdminRoute />}>
            <Route path="/lojas"     element={<Lojas />} />
            <Route path="/clientes"  element={<Clientes />} />
            <Route path="/contratos" element={<Contratos />} />
            <Route path="/financeiro" element={<Financeiro />} />
            <Route path="/gestores"  element={<Gestores />} />
          </Route>

          <Route element={<SuperAdminRoute />}>
            <Route path="/organizacoes" element={<Organizacoes />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
          <LembretesGlobais />
          <LojasSemGestorAlerta />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
