"use client";

import { useSidebar } from '../../contexts/SidebarContext';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

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

import Header from './Header';

export default function MainContent({ children }) {
  const { collapsed } = useSidebar();
  const isMobile = useIsMobile(768);
  
  // No mobile, a sidebar vira um drawer que passa por cima, então não tem margem.
  // No desktop, a margem é 52px quando colapsada e 220px quando expandida.
  const marginLeft = isMobile ? 0 : collapsed ? 52 : 220;

  return (
    <motion.main
      animate={{ marginLeft }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="flex-1 overflow-y-auto w-full h-full relative flex flex-col"
    >
      <Header />
      <div className={`flex-1 ${isMobile ? 'pt-0' : ''}`}>
        {children}
      </div>
    </motion.main>
  );
}
