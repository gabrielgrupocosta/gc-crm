import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, X } from 'lucide-react'

// Banner discreto pedindo permissão de notificação — só aparece se o
// navegador ainda não decidiu (Notification.permission === 'default').
// Uma vez negada ou concedida, o próprio navegador não deixa perguntar de
// novo, então o dismiss é só local (sessão atual) e não precisa persistir.
export default function PedirPermissaoNotificacao({ permissao, onPedirPermissao }) {
  const [dispensado, setDispensado] = useState(false)

  const visivel = permissao === 'default' && !dispensado

  async function handleAtivar() {
    const concedida = await onPedirPermissao()
    if (!concedida) setDispensado(true)
  }

  return (
    <AnimatePresence>
      {visivel && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.97 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="fixed bottom-28 left-5 z-[100] flex items-start gap-3 max-w-sm"
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E8E8E8',
            borderRadius: '10px',
            padding: '16px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          }}
        >
          <div
            className="shrink-0 flex items-center justify-center"
            style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#FFF5F5' }}
          >
            <Bell size={16} strokeWidth={1.75} color="#FF4B2E" />
          </div>
          <div className="flex-1 min-w-0">
            <p style={{ fontSize: '13px', fontWeight: 500, color: '#111111', marginBottom: '3px' }}>
              Ativar notificações
            </p>
            <p style={{ fontSize: '12px', color: '#666666', lineHeight: 1.45, marginBottom: '12px' }}>
              Receba avisos de tarefas pendentes e cobranças direto no celular, mesmo com o app fechado.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleAtivar}
                className="btn-primary"
                style={{ height: '28px', padding: '0 12px', fontSize: '12px' }}
              >
                Ativar
              </button>
              <button
                onClick={() => setDispensado(true)}
                className="btn-secondary"
                style={{ height: '28px', padding: '0 12px', fontSize: '12px' }}
              >
                Agora não
              </button>
            </div>
          </div>
          <button
            onClick={() => setDispensado(true)}
            aria-label="Fechar"
            className="shrink-0"
            style={{ color: '#999999', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <X size={14} strokeWidth={1.75} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
