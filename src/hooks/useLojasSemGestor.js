import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { db, COLLECTIONS, collection, query, where, getDocs } from '../services/firebase'

const POLL_INTERVAL_MS = 60 * 1000

// Detecta lojas ativas/pausadas sem gestor vinculado (gestorId nulo/vazio) —
// acontece quando um gestor é excluído ou uma loja é criada sem atribuição.
// Usado pela notificação flutuante global e pelas telas de Lojas/Controle Semanal.
export function useLojasSemGestor() {
  const { user, isAdmin, isSuperAdmin } = useAuth()
  const [lojas, setLojas] = useState([])

  const verificar = useCallback(async () => {
    if (!isAdmin || !user) return
    try {
      // master enxerga tudo; admin_org precisa do filtro de organizacaoId pra
      // satisfazer a regra mesmaOrg() do Firestore (mesmo padrão de Lojas.jsx).
      const q = isSuperAdmin
        ? collection(db, COLLECTIONS.LOJAS)
        : query(collection(db, COLLECTIONS.LOJAS), where('organizacaoId', '==', user.organizacaoId ?? null))
      const snap = await getDocs(q)
      const semGestor = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(l => !l.gestorId && l.status?.toLowerCase() !== 'cancelada')
      setLojas(semGestor)
    } catch (err) {
      console.error('[useLojasSemGestor] erro ao verificar lojas:', err?.code, err?.message)
    }
  }, [isAdmin, isSuperAdmin, user])

  useEffect(() => {
    if (!isAdmin) { setLojas([]); return }
    verificar()
    const interval = setInterval(verificar, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [isAdmin, verificar])

  return { lojas, refresh: verificar }
}
