import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  ClipboardList,
  CheckSquare,
  Trophy,
  BarChart3,
  Store,
  Users,
  UserCog,
  UserPlus,
  Building2,
  Target,
  Briefcase,
  FileText,
  Wallet,
  Bot,
  MessageSquare,
  AlertTriangle,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  KeyRound,
  Menu,
  X,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useSidebar } from '../../contexts/SidebarContext'
import { db, COLLECTIONS, collection, doc, query, where, onSnapshot } from '../../services/firebase'
import AlterarSenhaModal from '../UI/AlterarSenhaModal'

// Comparativo não é mais item de topo — vive como botão dentro da página
// de Ranking (ver Ranking.jsx), já que é uma visão derivada do mesmo dado.
const NAV_MAIN = [
  { to: '/dashboard',   label: 'Dashboard',    icon: LayoutDashboard },
  { to: '/ranking',     label: 'Ranking',      icon: Trophy          },
]

// Métricas compara gestor a gestor — só faz sentido pra quem enxerga todos
// os gestores (admin). Rota já é gated por AdminRoute; aqui só evita mostrar
// o item pra quem não vai conseguir acessá-lo.
const NAV_MAIN_ADMIN = [
  { to: '/metricas', label: 'Métricas', icon: BarChart3, menuKey: 'metricas' },
]

// CRM de prospecção — visível pra quem pertence a uma organização (admin_org
// e gestor); master não tem organizacaoId própria, não usa esta tela.
const NAV_CRM = [
  { to: '/crm', label: 'CRM', icon: Target },
]

// Clientes/Lojas/Contratos seguem exclusivos de admin (mesmas rotas de sempre)
const NAV_CARTEIRA_ADMIN = [
  { to: '/clientes',  label: 'Clientes',  icon: Users,    menuKey: 'clientes'   },
  { to: '/lojas',     label: 'Lojas',     icon: Store,    menuKey: 'lojas'      },
  { to: '/contratos', label: 'Contratos', icon: FileText, menuKey: 'contratos' },
  { to: '/financeiro', label: 'Financeiro', icon: Wallet,  menuKey: 'financeiro' },
]

// Visível para admin e gestor
const NAV_CARTEIRA_TODOS = [
  { to: '/carteira', label: 'Desempenho da Carteira', icon: Briefcase },
]

// Visível para admin e gestor
const NAV_GESTAO = [
  { to: '/controle',    label: 'Relatório Semanal',  icon: CheckSquare   },
  { to: '/assistente',  label: 'Assistente Delivery', icon: Bot          },
  { to: '/onboard',     label: 'Onboard',            icon: UserPlus      },
  { to: '/atividades',  label: 'Atividades',         icon: ClipboardList },
]

const NAV_PERFIL = [
  { to: '/gestores', label: 'Acessos', icon: UserCog, menuKey: 'gestores' },
]

// Visível só para master (gestão da plataforma como um todo, entre organizações)
const NAV_PLATAFORMA = [
  { to: '/organizacoes', label: 'Organizações', icon: Building2 },
]

const NAV_SUPORTE = [
  { to: '/feedback', label: 'Feedback', icon: MessageSquare },
]

// ─── Seções colapsáveis — estado persistido em localStorage ───────────────────

const SECTIONS_STORAGE_KEY = 'sidebar.sectionsCollapsed'

function loadCollapsedSections() {
  try {
    const raw = localStorage.getItem(SECTIONS_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveCollapsedSections(state) {
  try { localStorage.setItem(SECTIONS_STORAGE_KEY, JSON.stringify(state)) } catch {}
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function getISOWeekStr(date = new Date()) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay() || 7
  d.setDate(d.getDate() + 4 - day)
  const yearStart = new Date(d.getFullYear(), 0, 1)
  const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

const DIA_OFFSET = { segunda: 0, terca: 1, quarta: 2, quinta: 3, sexta: 4, sabado: 5 }

function lojaAtiva(l) {
  return ['ativa', 'ativo'].includes(l.status?.toLowerCase())
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// Abaixo de `breakpointPx` a sidebar vira drawer mobile (sem modo ícone) —
// esse hook só existe pra saber quando ignorar o `collapsed` de desktop na
// hora de renderizar (mesmo elemento, dois comportamentos visuais via CSS).
function useIsMobile(breakpointPx = 768) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < breakpointPx
  )
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`)
    const handler = e => setIsMobile(e.matches)
    handler(mq)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [breakpointPx])
  return isMobile
}

// ─── Marca (hexágono + pin/gráfico) — usada no logo da Sidebar ────────────────

function LogoMark({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id="ihubGradSidebar" x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FF7A3D" />
          <stop offset="1" stopColor="#FF4B2E" />
        </linearGradient>
      </defs>
      <polygon points="12,2 20.66,7 20.66,17 12,22 3.34,17 3.34,7" fill="url(#ihubGradSidebar)" stroke="url(#ihubGradSidebar)" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 7.5c-2.21 0-4 1.7-4 3.8 0 2.62 4 6.7 4 6.7s4-4.08 4-6.7c0-2.1-1.79-3.8-4-3.8Z" fill="#FFFFFF" />
      <rect x="10.1" y="10.6" width="1.15" height="2.3" rx="0.3" fill="url(#ihubGradSidebar)" />
      <rect x="11.8" y="9.4" width="1.15" height="3.5" rx="0.3" fill="url(#ihubGradSidebar)" />
      <rect x="13.5" y="10.1" width="1.15" height="2.8" rx="0.3" fill="url(#ihubGradSidebar)" />
    </svg>
  )
}

// ─── Nav item ─────────────────────────────────────────────────────────────────

function CountBadge({ n, color }) {
  return (
    <span
      className="font-mono"
      style={{
        backgroundColor: color, color: '#FFFFFF',
        fontSize: '10px', fontWeight: 600, borderRadius: '10px',
        padding: '1px 6px', lineHeight: 1, flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {n}
    </span>
  )
}

function SquareCountBadge({ n, color }) {
  return (
    <span
      className="font-mono flex items-center justify-center"
      style={{
        width: '22px', height: '22px', borderRadius: '5px',
        backgroundColor: color, color: '#FFFFFF',
        fontSize: '11px', fontWeight: 600, flexShrink: 0,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {n}
    </span>
  )
}

// Badge circular 16px — usado tanto no canto do ícone (modo recolhido) quanto
// no label da seção (modo expandido, seção colapsada com pendências dentro).
function MiniBadge({ content, color }) {
  return (
    <span
      className="font-mono flex items-center justify-center select-none"
      style={{
        width: '16px', height: '16px', borderRadius: '50%',
        backgroundColor: color, color: '#FFFFFF',
        fontSize: '9px', fontWeight: 700, lineHeight: 1, flexShrink: 0,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {content}
    </span>
  )
}

function NavItem({ to, label, Icon, highlight, extraBadge, collapsed }) {
  const [hovered, setHovered] = useState(false)
  const [tooltipRect, setTooltipRect] = useState(null)
  const wrapperRef = useRef(null)

  function handleMouseEnter() {
    setHovered(true)
    if (collapsed && wrapperRef.current) {
      const r = wrapperRef.current.getBoundingClientRect()
      setTooltipRect({ top: r.top + r.height / 2, left: r.right })
    }
  }

  return (
    <div
      ref={wrapperRef}
      style={{ position: 'relative', margin: '1px 8px' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setHovered(false)}
    >
      <NavLink
        to={to}
        className={`flex items-center select-none ${collapsed ? 'justify-center' : 'gap-2'}`}
        style={({ isActive }) => ({
          height: '34px',
          padding: collapsed ? 0 : '0 12px',
          borderRadius: '6px',
          backgroundColor: highlight ? highlight.bg : isActive ? 'rgba(255,75,46,0.15)' : hovered ? '#1C2128' : 'transparent',
          transition: 'background-color 100ms, color 100ms',
        })}
      >
        {({ isActive }) => {
          const iconColor  = highlight ? highlight.color : isActive ? '#FF4B2E' : hovered ? '#E4E7EB' : '#9AA3AF'
          const textColor  = highlight ? highlight.color : isActive ? '#FF4B2E' : hovered ? '#FFFFFF' : '#C4C9D1'
          const fontWeight = highlight ? 600 : isActive ? 600 : 500

          return (
            <>
              <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
                <Icon size={15} strokeWidth={1.75} color={iconColor} style={{ transition: 'color 100ms' }} />
                {collapsed && highlight?.dot != null && (
                  <span style={{ position: 'absolute', top: '-6px', right: '-7px' }}>
                    <MiniBadge content={highlight.dot} color={highlight.dotColor} />
                  </span>
                )}
              </span>
              {!collapsed && (
                <span className="font-sans" style={{ flex: 1, fontSize: '13.5px', lineHeight: 1.4, color: textColor, fontWeight, transition: 'color 100ms' }}>
                  {label}
                </span>
              )}
              {!collapsed && highlight?.badge}
              {!collapsed && extraBadge}
            </>
          )
        }}
      </NavLink>

      {collapsed && hovered && tooltipRect && createPortal(
        <motion.div
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -4 }}
          transition={{ duration: 0.1 }}
          style={{
            position: 'fixed', top: tooltipRect.top, left: tooltipRect.left + 8, transform: 'translateY(-50%)',
            backgroundColor: '#111111', color: '#FFFFFF', fontSize: '12px', padding: '6px 10px',
            borderRadius: '6px', whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 200,
          }}
        >
          {label}
        </motion.div>,
        document.body
      )}
    </div>
  )
}

// ─── Seção colapsável (label clicável + itens com animação de altura) ─────────

function NavSection({ sectionKey, label, collapsedSections, onToggle, sidebarCollapsed, pendingDots, children }) {
  // Modo ícones (sidebar recolhida): sem labels de seção, mostra só os itens.
  if (sidebarCollapsed) {
    return <>{children}</>
  }

  // O estado de colapso vem sempre e só do objeto `collapsedSections`, pela
  // mesma chave (`sectionKey`) pra todas as seções — a seção da rota ativa é
  // auto-expandida via efeito (ver useEffect de `activeSectionKey` no
  // componente principal), não por um override aqui que travaria o clique
  // enquanto a seção estivesse ativa.
  const isCollapsed = !!collapsedSections[sectionKey]
  const isOpen = !isCollapsed

  return (
    <div>
      <button
        type="button"
        onClick={() => onToggle(sectionKey)}
        className="w-full flex items-center justify-between select-none font-sans"
        style={{ padding: '16px 12px 4px', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <span style={{ fontSize: '10px', fontWeight: 600, color: '#BBBBBB', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {label}
        </span>
        <span className="flex items-center gap-1">
          <ChevronDown
            size={12}
            strokeWidth={2}
            color="#BBBBBB"
            style={{ transform: isOpen ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 150ms' }}
          />
          {isCollapsed && pendingDots?.map((d, idx) => (
            <MiniBadge key={idx} content={d.dot} color={d.dotColor} />
          ))}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ overflow: 'hidden' }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function Sidebar() {
  const { user, isAdmin, isSuperAdmin, isAdminOrg, isSupervisor, podeVerMenu, logout } = useAuth()
  const navResultado = [...NAV_MAIN, ...NAV_MAIN_ADMIN.filter(i => podeVerMenu(i.menuKey))]
  const pertenceOrg = !!user?.organizacaoId
  const navigate = useNavigate()
  const location = useLocation()
  const { collapsed, toggle } = useSidebar()
  const isMobile = useIsMobile(768)
  const [mobileOpen, setMobileOpen] = useState(false)
  // No drawer mobile nunca tem modo ícone — sempre mostra os rótulos,
  // independente do `collapsed` que o usuário deixou salvo no desktop.
  const effectiveCollapsed = isMobile ? false : collapsed

  // Trava o scroll do body enquanto o drawer mobile está aberto — sem isso,
  // arrastar o dedo sobre a sidebar rola o conteúdo por trás dela (o touch
  // "vaza" pro body, que continua scrollável atrás do drawer fixed).
  useEffect(() => {
    if (!mobileOpen) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = original }
  }, [mobileOpen])

  const [onboardPendentes, setOnboardPendentes] = useState(0)
  const [lojasSemGestor,   setLojasSemGestor]   = useState(0)
  const [relatorioStatus,  setRelatorioStatus]  = useState({ atrasadas: 0, pendentesHoje: 0 })
  const [tarefasHoje,      setTarefasHoje]      = useState(0)
  const [logoutHovered,    setLogoutHovered]    = useState(false)
  const [senhaModalOpen,   setSenhaModalOpen]   = useState(false)

  const [collapsedSections, setCollapsedSections] = useState(loadCollapsedSections)

  function toggleSection(key) {
    setCollapsedSections(prev => {
      const next = { ...prev, [key]: !prev[key] }
      saveCollapsedSections(next)
      return next
    })
  }

  // A seção da rota ativa nunca fica colapsada — se o usuário navegar pra
  // dentro de uma seção que estava colapsada, ela auto-expande uma vez (mas
  // continua togglável normalmente depois disso, diferente de um override
  // permanente que travaria o clique enquanto a rota estivesse ativa).
  useEffect(() => {
    const sectionItemsMap = {
      resultado: navResultado,
      gestao:    NAV_GESTAO,
      carteira:  [...(pertenceOrg ? NAV_CRM : []), ...NAV_CARTEIRA_ADMIN.filter(i => podeVerMenu(i.menuKey)), ...NAV_CARTEIRA_TODOS],
      perfil:    NAV_PERFIL.filter(i => podeVerMenu(i.menuKey)),
      plataforma: isSuperAdmin ? NAV_PLATAFORMA : [],
      suporte:   NAV_SUPORTE,
    }
    const activeKey = Object.entries(sectionItemsMap).find(([, items]) => items.some(i => i.to === location.pathname))?.[0]
    if (!activeKey) return
    setCollapsedSections(prev => {
      if (!prev[activeKey]) return prev
      const next = { ...prev, [activeKey]: false }
      saveCollapsedSections(next)
      return next
    })
  }, [location.pathname, isAdmin, isSuperAdmin, podeVerMenu])

  // ── Onboard: lojas aguardando preenchimento de dados (master: todas / admin_org:
  // só da própria org / gestor: só as suas) — sem o filtro de organizacaoId pra
  // admin_org/gestor, a consulta nem passa pelas regras do Firestore (mesmo
  // padrão de escopo usado em Clientes.jsx/Lojas.jsx).
  useEffect(() => {
    if (!user) return
    const orgId = user.organizacaoId ?? null
    let q
    if (isSuperAdmin) {
      q = query(collection(db, COLLECTIONS.LOJAS), where('onboardStatus', '==', 'dados_pendentes'))
    } else if (isAdmin) {
      q = query(
        collection(db, COLLECTIONS.LOJAS),
        where('onboardStatus', '==', 'dados_pendentes'),
        where('organizacaoId', '==', orgId),
      )
    } else {
      q = query(
        collection(db, COLLECTIONS.LOJAS),
        where('onboardStatus', '==', 'dados_pendentes'),
        where('organizacaoId', '==', orgId),
        where('gestorId', '==', user.uid),
      )
    }
    const unsubscribe = onSnapshot(
      q,
      snap => setOnboardPendentes(snap.size),
      err => console.error('[Sidebar] onboard onSnapshot:', err?.code, err?.message)
    )
    return unsubscribe
  }, [isAdmin, isSuperAdmin, user])

  // ── Lojas sem gestor vinculado (master vê todas; admin_org só a própria org) ──
  useEffect(() => {
    if (!isAdmin || !user) return
    const orgId = user.organizacaoId ?? null
    const q = isSuperAdmin
      ? collection(db, COLLECTIONS.LOJAS)
      : query(collection(db, COLLECTIONS.LOJAS), where('organizacaoId', '==', orgId))
    const unsubscribe = onSnapshot(
      q,
      snap => {
        const count = snap.docs
          .map(d => d.data())
          .filter(l => !l.gestorId && l.status?.toLowerCase() !== 'cancelada')
          .length
        setLojasSemGestor(count)
      },
      err => console.error('[Sidebar] lojas sem gestor onSnapshot:', err?.code, err?.message)
    )
    return unsubscribe
  }, [isAdmin, isSuperAdmin, user])

  // ── Relatório Semanal: status das lojas do gestor logado ─────────────────────
  useEffect(() => {
    if (isAdmin || !user) return

    let lojasGestor = []
    let relMap = {}

    function recompute() {
      const todayOffset = (new Date().getDay() + 6) % 7
      let atrasadas = 0
      let pendentesHoje = 0
      lojasGestor.forEach(l => {
        if (relMap[l.id]?.enviado) return
        if (!l.diaRelatorio) return
        const off = DIA_OFFSET[l.diaRelatorio]
        if (off == null) return
        if (off < todayOffset) atrasadas += 1
        else if (off === todayOffset) pendentesHoje += 1
      })
      setRelatorioStatus({ atrasadas, pendentesHoje })
    }

    const unsubLojas = onSnapshot(
      query(
        collection(db, COLLECTIONS.LOJAS),
        where('organizacaoId', '==', user.organizacaoId ?? null),
        where('gestorId', '==', user.uid),
      ),
      snap => {
        lojasGestor = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(lojaAtiva)
        recompute()
      },
      err => console.error('[Sidebar] relatorio lojas onSnapshot:', err?.code, err?.message)
    )

    const currentWeek = getISOWeekStr()
    const unsubRel = onSnapshot(
      doc(db, 'relatorios_semanais', `${user.uid}_${currentWeek}`),
      snap => {
        relMap = snap.exists() ? (snap.data().lojas || {}) : {}
        recompute()
      },
      err => console.error('[Sidebar] relatorio status onSnapshot:', err?.code, err?.message)
    )

    return () => { unsubLojas(); unsubRel() }
  }, [isAdmin, user])

  // ── Atividades: tarefas pendentes agendadas para hoje ─────────────────────────
  useEffect(() => {
    if (!user) return
    // master (sem organizacaoId) não filtra por org — passa pela regra via
    // isSuperAdmin(); admin_org/gestor precisam do filtro pra regra mesmaOrg().
    const escopoOrg = isSuperAdmin ? [] : [where('organizacaoId', '==', user.organizacaoId ?? null)]
    const unsubscribe = onSnapshot(
      query(
        collection(db, COLLECTIONS.TAREFAS),
        ...escopoOrg,
        where('gestorId', '==', user.uid),
        where('status', '==', 'pendente'),
      ),
      snap => {
        const hoje = new Date()
        const count = snap.docs
          .map(d => d.data())
          .filter(t => t.tipo !== 'registro' && t.dataLembrete)
          .filter(t => sameDay(t.dataLembrete.toDate ? t.dataLembrete.toDate() : new Date(t.dataLembrete), hoje))
          .length
        setTarefasHoje(count)
      },
      err => console.error('[Sidebar] tarefas onSnapshot:', err?.code, err?.message)
    )
    return unsubscribe
  }, [user, isSuperAdmin])

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  const onboardHighlight = onboardPendentes > 0
    ? { color: '#10B981', bg: 'rgba(16,185,129,0.16)', badge: <SquareCountBadge n={onboardPendentes} color="#10B981" />, dot: onboardPendentes, dotColor: '#10B981' }
    : null

  const relatorioHighlight = relatorioStatus.atrasadas > 0
    ? { color: '#FF4B2E', bg: 'rgba(255,75,46,0.16)', badge: <AlertTriangle size={13} strokeWidth={2} color="#FF4B2E" style={{ flexShrink: 0 }} />, dot: '!', dotColor: '#FF4B2E' }
    : relatorioStatus.pendentesHoje > 0
      ? { color: '#FF4B2E', bg: 'rgba(255,75,46,0.16)', badge: <CountBadge n={relatorioStatus.pendentesHoje} color="#FF4B2E" />, dot: relatorioStatus.pendentesHoje, dotColor: '#FF4B2E' }
      : null

  const atividadesHighlight = tarefasHoje > 0
    ? { color: '#F59E0B', bg: 'rgba(245,158,11,0.16)', badge: <SquareCountBadge n={tarefasHoje} color="#F59E0B" />, dot: tarefasHoje, dotColor: '#F59E0B' }
    : null

  const HIGHLIGHTS = {
    '/onboard':    onboardHighlight,
    '/controle':   relatorioHighlight,
    '/atividades': atividadesHighlight,
  }

  const carteiraAdminItems = NAV_CARTEIRA_ADMIN.filter(i => podeVerMenu(i.menuKey))
  const carteiraItems = [...(pertenceOrg ? NAV_CRM : []), ...carteiraAdminItems, ...NAV_CARTEIRA_TODOS]
  const perfilItems = NAV_PERFIL.filter(i => podeVerMenu(i.menuKey))

  // Pendências agregadas por seção — vira o badge no label quando a seção
  // está colapsada no modo expandido (mesma chave usada no toggle).
  function pendingDotsFor(items) {
    return items
      .map(i => HIGHLIGHTS[i.to])
      .filter(h => h?.dot != null)
      .map(h => ({ dot: h.dot, dotColor: h.dotColor }))
  }

  const sidebarInner = (
    <>
      {/* Toggle recolher/expandir — só desktop, sem conceito de "modo ícone" no drawer mobile */}
      <div
        className="hidden md:flex shrink-0 items-center"
        style={{ padding: collapsed ? '10px 0' : '10px 16px 0', justifyContent: collapsed ? 'center' : 'flex-end' }}
      >
        <button
          type="button"
          onClick={toggle}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9AA3AF', display: 'flex', alignItems: 'center', padding: '4px', transition: 'color 100ms' }}
          onMouseEnter={e => e.currentTarget.style.color = '#FFFFFF'}
          onMouseLeave={e => e.currentTarget.style.color = '#9AA3AF'}
        >
          {collapsed ? <PanelLeftOpen size={16} strokeWidth={1.75} /> : <PanelLeftClose size={16} strokeWidth={1.75} />}
        </button>
      </div>

      {/* Fechar drawer — só mobile */}
      <div className="md:hidden shrink-0 flex items-center justify-end" style={{ padding: '10px 12px 0' }}>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Fechar menu"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9AA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '44px', height: '44px' }}
        >
          <X size={20} strokeWidth={1.75} />
        </button>
      </div>

      {/* Logo — clicável, sempre volta pro Dashboard */}
      <button
        type="button"
        onClick={() => { navigate('/dashboard'); setMobileOpen(false) }}
        aria-label="Ir para o Dashboard"
        className={effectiveCollapsed ? 'shrink-0 flex justify-center' : 'shrink-0 px-4 flex items-center gap-2'}
        style={{
          paddingTop: '8px', paddingBottom: '16px', marginBottom: '8px', borderBottom: '1px solid #1C2128',
          background: 'none', border: 'none', borderBottomWidth: '1px', cursor: 'pointer', width: '100%',
          opacity: 1, transition: 'opacity 150ms',
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '0.8' }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
      >
        <LogoMark size={effectiveCollapsed ? 24 : 22} />
        {!effectiveCollapsed && (
          <span className="select-none font-sans" style={{ fontSize: '15px', letterSpacing: '-0.02em', fontWeight: 800 }}>
            <span style={{ color: '#FFFFFF' }}>iHub</span>
            <span style={{ color: '#FF4B2E' }}>Food</span>
          </span>
        )}
      </button>

      {/* Nav — clique em qualquer link fecha o drawer mobile (delegado, não afeta os botões de colapsar seção) */}
      <nav
        className="flex-1 overflow-y-auto py-1 flex flex-col"
        onClick={e => { if (e.target.closest('a')) setMobileOpen(false) }}
      >
        <NavSection
          sectionKey="resultado"
          label="Resultado"
          pendingDots={pendingDotsFor(navResultado)}
          collapsedSections={collapsedSections}
          onToggle={toggleSection}
          sidebarCollapsed={effectiveCollapsed}
        >
          {navResultado.map(({ to, label, icon: Icon }) => (
            <NavItem key={to} to={to} label={label} Icon={Icon} highlight={HIGHLIGHTS[to]} collapsed={effectiveCollapsed} />
          ))}
        </NavSection>

        <NavSection
          sectionKey="gestao"
          label="Gestão"
          pendingDots={pendingDotsFor(NAV_GESTAO)}
          collapsedSections={collapsedSections}
          onToggle={toggleSection}
          sidebarCollapsed={effectiveCollapsed}
        >
          {NAV_GESTAO.map(({ to, label, icon: Icon }) => (
            <NavItem key={to} to={to} label={label} Icon={Icon} highlight={HIGHLIGHTS[to]} collapsed={effectiveCollapsed} />
          ))}
        </NavSection>

        <NavSection
          sectionKey="carteira"
          label="Carteira de Gestão"
          pendingDots={pendingDotsFor(carteiraItems)}
          collapsedSections={collapsedSections}
          onToggle={toggleSection}
          sidebarCollapsed={effectiveCollapsed}
        >
          {pertenceOrg && NAV_CRM.map(({ to, label, icon: Icon }) => (
            <NavItem key={to} to={to} label={label} Icon={Icon} highlight={HIGHLIGHTS[to]} collapsed={effectiveCollapsed} />
          ))}
          {carteiraAdminItems.map(({ to, label, icon: Icon }) => (
            <NavItem
              key={to}
              to={to}
              label={label}
              Icon={Icon}
              highlight={HIGHLIGHTS[to]}
              collapsed={effectiveCollapsed}
              extraBadge={to === '/lojas' && lojasSemGestor > 0
                ? (
                  <motion.span
                    className="flex items-center justify-center"
                    style={{ flexShrink: 0, width: '22px', height: '22px', borderRadius: '5px', backgroundColor: '#F5A623' }}
                    animate={{ opacity: [1, 0.25, 1] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <AlertTriangle size={13} strokeWidth={2} color="#FFFFFF" />
                  </motion.span>
                )
                : null}
            />
          ))}
          {NAV_CARTEIRA_TODOS.map(({ to, label, icon: Icon }) => (
            <NavItem key={to} to={to} label={label} Icon={Icon} highlight={HIGHLIGHTS[to]} collapsed={effectiveCollapsed} />
          ))}
        </NavSection>

        {perfilItems.length > 0 && (
          <NavSection
            sectionKey="perfil"
            label="Perfil"
            pendingDots={pendingDotsFor(perfilItems)}
            collapsedSections={collapsedSections}
            onToggle={toggleSection}
            sidebarCollapsed={effectiveCollapsed}
          >
            {perfilItems.map(({ to, label, icon: Icon }) => (
              <NavItem key={to} to={to} label={label} Icon={Icon} highlight={HIGHLIGHTS[to]} collapsed={effectiveCollapsed} />
            ))}
          </NavSection>
        )}

        {isSuperAdmin && (
          <NavSection
            sectionKey="plataforma"
            label="Plataforma"
            pendingDots={pendingDotsFor(NAV_PLATAFORMA)}
            collapsedSections={collapsedSections}
            onToggle={toggleSection}
            sidebarCollapsed={effectiveCollapsed}
          >
            {NAV_PLATAFORMA.map(({ to, label, icon: Icon }) => (
              <NavItem key={to} to={to} label={label} Icon={Icon} highlight={HIGHLIGHTS[to]} collapsed={effectiveCollapsed} />
            ))}
          </NavSection>
        )}

        <NavSection
          sectionKey="suporte"
          label="Suporte"
          pendingDots={pendingDotsFor(NAV_SUPORTE)}
          collapsedSections={collapsedSections}
          onToggle={toggleSection}
          sidebarCollapsed={effectiveCollapsed}
        >
          {NAV_SUPORTE.map(({ to, label, icon: Icon }) => (
            <NavItem key={to} to={to} label={label} Icon={Icon} highlight={HIGHLIGHTS[to]} collapsed={effectiveCollapsed} />
          ))}
        </NavSection>
      </nav>

      {/* Footer */}
      <div
        className={effectiveCollapsed ? 'shrink-0 flex flex-col items-center gap-1.5' : 'shrink-0 flex flex-col gap-1.5'}
        style={{ borderTop: '1px solid #1C2128', padding: effectiveCollapsed ? '12px 8px' : '12px 16px' }}
      >
        {!effectiveCollapsed && (
          <div className="flex flex-col gap-0.5">
            <span className="font-sans truncate" style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF', lineHeight: 1.3 }}>
              {user?.nome ?? '—'}
            </span>
            <span className="font-sans" style={{ fontSize: '10px', fontWeight: 500, color: '#9AA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {isSuperAdmin ? 'Master' : isAdminOrg ? 'Admin' : isSupervisor ? 'Supervisor' : 'Gestor'}
            </span>
          </div>
        )}

        <button
          onClick={() => setSenhaModalOpen(true)}
          title={effectiveCollapsed ? 'Alterar senha' : undefined}
          className={effectiveCollapsed ? 'font-sans flex items-center justify-center h-7 w-full' : 'font-sans flex items-center gap-[7px] h-7 w-full text-left'}
          style={{ fontSize: '12px', fontWeight: 400, color: '#9AA3AF', transition: 'color 100ms', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <KeyRound size={14} strokeWidth={1.75} />
          {!effectiveCollapsed && 'Alterar senha'}
        </button>

        <button
          onClick={handleLogout}
          onMouseEnter={() => setLogoutHovered(true)}
          onMouseLeave={() => setLogoutHovered(false)}
          title={effectiveCollapsed ? 'Sair' : undefined}
          className={effectiveCollapsed ? 'font-sans flex items-center justify-center h-7 w-full' : 'font-sans flex items-center gap-[7px] h-7 w-full text-left'}
          style={{ fontSize: '12px', fontWeight: 400, color: logoutHovered ? '#FF4B2E' : '#9AA3AF', transition: 'color 100ms', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <LogOut size={14} strokeWidth={1.75} />
          {!effectiveCollapsed && 'Sair'}
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Top bar mobile — barra inteira (não só um botão flutuante no canto),
          pra cobrir de ponta a ponta qualquer conteúdo que role por baixo dela
          e dar a sensação de app nativo em vez de um elemento solto por cima
          da página. O botão sozinho só tapava um quadrado de 44px; qualquer
          título que rolasse até essa faixa ficava cortado ao lado dele. */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 flex items-center gap-2.5"
        style={{
          height: '56px', padding: '0 12px', zIndex: 30,
          backgroundColor: '#FFFFFF', borderBottom: '1px solid #E8E8E8',
        }}
      >
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menu"
          className="flex items-center justify-center shrink-0"
          style={{
            width: '36px', height: '36px',
            backgroundColor: '#0E1116', color: '#FFFFFF', borderRadius: '8px',
          }}
        >
          <Menu size={18} strokeWidth={1.75} />
        </button>
        <LogoMark size={20} />
        <span className="select-none font-sans" style={{ fontSize: '15px', letterSpacing: '-0.02em', fontWeight: 800 }}>
          <span style={{ color: '#111111' }}>iHub</span>
          <span style={{ color: '#FF4B2E' }}>Food</span>
        </span>
      </div>

      {/* Backdrop — só mobile, só quando o drawer está aberto */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 40 }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* h-dvh depois de h-screen: no mobile, 100vh conta o espaço atrás da
          barra de endereço do navegador — quando ela está visível, o rodapé
          (Alterar senha / Sair) ficava empurrado pra fora da área visível.
          100dvh acompanha a altura real da viewport; navegadores sem suporte
          simplesmente ignoram a declaração e mantêm o h-screen.
          overflow-y-auto no <aside> é rede de segurança: mesmo que o cálculo
          de altura falhe em algum navegador (ou o conteúdo do menu cresça
          além da tela), dá pra rolar o drawer inteiro até o rodapé em vez de
          ele ficar inacessível. */}
      <aside
        className={`fixed top-0 left-0 h-screen h-dvh overflow-y-auto flex flex-col bg-brand-dark border-r border-brand-dark-hover z-50 w-[260px] transition-transform duration-200 ease-out md:translate-x-0 md:transition-[width] md:duration-200 md:ease-out ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} ${collapsed ? 'md:w-[52px]' : 'md:w-[220px]'}`}
      >
        {sidebarInner}
      </aside>

      <AlterarSenhaModal isOpen={senhaModalOpen} onClose={() => setSenhaModalOpen(false)} />
    </>
  )
}
