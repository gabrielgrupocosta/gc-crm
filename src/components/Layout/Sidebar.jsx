"use client";

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  Building2,
  Wallet,
  UserCog,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  FileText,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSidebar } from '../../contexts/SidebarContext';

// CRM 1 — Comercial, Financeiro & Gestão de Unidades/Acessos
const NAV_MAIN = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, modulo: 'dashboard' },
];

const NAV_COMERCIAL = [
  { to: '/funil', label: 'Funil de Vendas', icon: TrendingUp, modulo: 'vendas' },
  { to: '/contratos', label: 'Propostas', icon: FileText, modulo: 'vendas' },
  { to: '/clientes', label: 'Base de Clientes', icon: Users, modulo: 'vendas' },
  { to: '/financeiro', label: 'Financeiro', icon: Wallet, modulo: 'financeiro' },
];

const NAV_ADMIN = [
  { to: '/unidades', label: 'Unidades', icon: Building2, modulo: 'unidades' },
  { to: '/usuarios', label: 'Acessos', icon: UserCog, adminOnly: true },
];

function useIsMobile(breakpointPx = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    setIsMobile(window.innerWidth < breakpointPx);
    const mq = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`);
    const handler = e => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpointPx]);
  return isMobile;
}

function NavItem({ to, label, Icon, collapsed }) {
  const [hovered, setHovered] = useState(false);
  const [tooltipRect, setTooltipRect] = useState(null);
  const wrapperRef = useRef(null);
  const pathname = usePathname();
  const isActive = pathname.startsWith(to);

  function handleMouseEnter() {
    setHovered(true);
    if (collapsed && wrapperRef.current) {
      const r = wrapperRef.current.getBoundingClientRect();
      setTooltipRect({ top: r.top + r.height / 2, left: r.right });
    }
  }

  return (
    <div
      ref={wrapperRef}
      style={{ position: 'relative', margin: '1px 8px' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setHovered(false)}
    >
      <Link
        href={to}
        className={`flex items-center select-none ${collapsed ? 'justify-center' : 'gap-2'}`}
        style={{
          height: '34px',
          padding: collapsed ? 0 : '0 12px',
          borderRadius: '6px',
          backgroundColor: isActive ? 'rgba(255,75,46,0.15)' : hovered ? '#1C2128' : 'transparent',
          transition: 'background-color 100ms, color 100ms',
        }}
      >
        <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
          <Icon size={15} strokeWidth={1.75} color={isActive ? '#FF4B2E' : hovered ? '#E4E7EB' : '#9AA3AF'} style={{ transition: 'color 100ms' }} />
        </span>
        {!collapsed && (
          <span className="font-sans" style={{ flex: 1, fontSize: '13.5px', lineHeight: 1.4, color: isActive ? '#FF4B2E' : hovered ? '#FFFFFF' : '#C4C9D1', fontWeight: isActive ? 600 : 500, transition: 'color 100ms' }}>
            {label}
          </span>
        )}
      </Link>

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
  );
}

function NavSection({ label, sidebarCollapsed, children }) {
  if (sidebarCollapsed) {
    return <>{children}</>;
  }

  return (
    <div>
      <div
        className="w-full flex items-center justify-between select-none font-sans"
        style={{ padding: '16px 12px 4px' }}
      >
        <span style={{ fontSize: '10px', fontWeight: 600, color: '#BBBBBB', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {label}
        </span>
      </div>
      <div>{children}</div>
    </div>
  );
}

export default function Sidebar() {
  const { user, isAdmin, can, logout } = useAuth();
  const router = useRouter();
  const { collapsed, toggle } = useSidebar();
  const isMobile = useIsMobile(768);
  const [mobileOpen, setMobileOpen] = useState(false);
  const effectiveCollapsed = isMobile ? false : collapsed;

  useEffect(() => {
    if (!mobileOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original };
  }, [mobileOpen]);

  async function handleLogout() {
    logout();
  }

  if (!user) return null;

  const hasPermission = (item) => {
    if (isAdmin) return true;
    if (item.adminOnly) return false;
    if (item.modulo) return can(item.modulo, 'ler');
    return false;
  };

  const filteredNavMain = NAV_MAIN.filter(hasPermission);
  const filteredNavComercial = NAV_COMERCIAL.filter(hasPermission);
  const filteredNavAdmin = NAV_ADMIN.filter(hasPermission);

  const sidebarInner = (
    <>
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

      <div className="md:hidden shrink-0 flex items-center justify-end" style={{ padding: '10px 12px 0' }}>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9AA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '44px', height: '44px' }}
        >
          <X size={20} strokeWidth={1.75} />
        </button>
      </div>

      <button
        type="button"
        onClick={() => { router.push('/dashboard'); setMobileOpen(false); }}
        className={effectiveCollapsed ? 'shrink-0 flex justify-center' : 'shrink-0 px-4 flex flex-col items-start gap-0'}
        style={{
          paddingTop: '16px', paddingBottom: '16px', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)',
          background: 'none', border: 'none', cursor: 'pointer', width: '100%', opacity: 1, transition: 'opacity 150ms',
        }}
      >
        {!effectiveCollapsed && (
          <>
            <span className="select-none font-sans" style={{ fontSize: '18px', letterSpacing: '-0.02em', fontWeight: 800 }}>
              <span className="text-white">Grupo Costa</span>
            </span>
            <span className="select-none font-sans" style={{ fontSize: '14px', letterSpacing: '0.1em', fontWeight: 600 }}>
              <span className="text-tertiary">CRM</span>
            </span>
          </>
        )}
      </button>

      <nav
        className="flex-1 overflow-y-auto py-1 flex flex-col"
        onClick={e => { if (e.target.closest('a')) setMobileOpen(false) }}
      >
        <div className="space-y-0.5">
          {filteredNavMain.map(({ to, label, icon: Icon }) => (
            <NavItem key={to} to={to} label={label} Icon={Icon} collapsed={effectiveCollapsed} />
          ))}
        </div>

        {filteredNavComercial.length > 0 && (
          <NavSection label="Comercial & Financeiro" sidebarCollapsed={effectiveCollapsed}>
            <div className="space-y-0.5">
              {filteredNavComercial.map(({ to, label, icon: Icon }) => (
                <NavItem key={to} to={to} label={label} Icon={Icon} collapsed={effectiveCollapsed} />
              ))}
            </div>
          </NavSection>
        )}

        {filteredNavAdmin.length > 0 && (
          <NavSection label="Gestão & Acessos" sidebarCollapsed={effectiveCollapsed}>
            <div className="space-y-0.5">
              {filteredNavAdmin.map(({ to, label, icon: Icon }) => (
                <NavItem key={to} to={to} label={label} Icon={Icon} collapsed={effectiveCollapsed} />
              ))}
            </div>
          </NavSection>
        )}
      </nav>

      <div className="shrink-0 flex flex-col gap-1" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', padding: effectiveCollapsed ? '12px 0' : '12px' }}>
        {!effectiveCollapsed && (
          <div className="px-2 pb-2">
            <div className="text-xs font-semibold text-white truncate">{user.nome}</div>
            <div className="text-[10px] text-[#9AA3AF] uppercase">{user.role.replace('_', ' ')}</div>
          </div>
        )}
        <button
          type="button"
          onClick={handleLogout}
          title={effectiveCollapsed ? 'Sair' : undefined}
          className={`flex items-center font-sans ${effectiveCollapsed ? 'justify-center mx-2' : 'gap-2 px-3'}`}
          style={{
            height: '32px', borderRadius: '6px', background: 'none', border: 'none', cursor: 'pointer',
            color: '#9AA3AF', fontSize: '12px', transition: 'color 100ms, background-color 100ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#FF4B2E'; e.currentTarget.style.backgroundColor = '#1C2128'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#9AA3AF'; e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          <LogOut size={15} strokeWidth={1.75} />
          {!effectiveCollapsed && <span>Sair da Conta</span>}
        </button>
      </div>
    </>
  );

  return (
    <>
      {isMobile && !mobileOpen && (
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          style={{
            position: 'fixed', top: '12px', left: '12px', zIndex: 40, width: '40px', height: '40px',
            borderRadius: '8px', backgroundColor: '#111111', border: '1px solid #333333',
            boxShadow: '0 1px 4px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: 'pointer', color: '#FFFFFF',
          }}
        >
          <Menu size={20} strokeWidth={1.75} />
        </button>
      )}

      {!isMobile && (
        <aside
          className="fixed left-0 top-0 h-screen flex flex-col select-none z-30"
          style={{
            width: collapsed ? '64px' : '220px',
            backgroundColor: '#031E33',
            borderRight: '1px solid rgba(255,255,255,0.05)',
            transition: 'width 200ms cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          {sidebarInner}
        </aside>
      )}

      <AnimatePresence>
        {isMobile && mobileOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileOpen(false)}
              style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 40 }}
            />
            <motion.aside
              key="drawer"
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              className="fixed left-0 top-0 h-screen flex flex-col select-none z-50"
              style={{ width: '240px', backgroundColor: '#031E33', borderRight: '1px solid rgba(255,255,255,0.05)' }}
            >
              {sidebarInner}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
