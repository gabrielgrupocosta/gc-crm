import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  db, COLLECTIONS,
  collection, doc, query, where, getDocs, updateDoc, serverTimestamp, Timestamp,
} from '../services/firebase'

const POLL_INTERVAL_MS = 60 * 1000

function tsToDate(ts) {
  if (!ts) return null
  return ts.toDate ? ts.toDate() : new Date(ts)
}

// Compara apenas ano/mês/dia — ignora horário
function dateOnlyLte(a, b) {
  const da = new Date(a.getFullYear(), a.getMonth(), a.getDate())
  const db_ = new Date(b.getFullYear(), b.getMonth(), b.getDate())
  return da <= db_
}

// Verifica periodicamente se há tarefas com dataLembrete no dia de hoje (ou
// anterior), status pendente, do usuário logado, e mantém uma fila pra exibir
// um popup de cada vez.
export function useLembretes() {
  const { user, isSuperAdmin } = useAuth()
  const [fila, setFila] = useState([])
  const jaEnfileiradosRef = useRef(new Set())

  const verificar = useCallback(async () => {
    if (!user) return
    try {
      // master (sem organizacaoId) não precisa do filtro — passa pela regra
      // via isSuperAdmin(); admin_org/gestor precisam pra satisfazer mesmaOrg().
      const escopoOrg = isSuperAdmin ? [] : [where('organizacaoId', '==', user.organizacaoId ?? null)]
      const snap = await getDocs(query(
        collection(db, COLLECTIONS.TAREFAS),
        ...escopoOrg,
        where('gestorId', '==', user.uid),
        where('status', '==', 'pendente'),
      ))
      const hoje = new Date()
      const vencidas = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(t => t.tipo !== 'registro' && t.dataLembrete && dateOnlyLte(tsToDate(t.dataLembrete), hoje))
        .filter(t => !jaEnfileiradosRef.current.has(t.id))

      if (vencidas.length > 0) {
        vencidas.forEach(t => jaEnfileiradosRef.current.add(t.id))
        setFila(prev => [...prev, ...vencidas])
      }
    } catch (err) {
      console.error('[useLembretes] erro ao verificar tarefas:', err?.code, err?.message)
    }
  }, [user, isSuperAdmin])

  useEffect(() => {
    if (!user) return
    verificar()
    const interval = setInterval(verificar, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [user, verificar])

  const lembreteAtual = fila[0] ?? null

  function fecharAtual() {
    setFila(prev => prev.slice(1))
  }

  async function concluirAtual() {
    if (!lembreteAtual) return
    const id = lembreteAtual.id
    fecharAtual()
    try {
      await updateDoc(doc(db, COLLECTIONS.TAREFAS, id), {
        status: 'concluida',
        concluidoEm: serverTimestamp(),
      })
    } catch (err) {
      console.error('[useLembretes] erro ao concluir tarefa:', err?.code, err?.message)
    }
  }

  async function adiarAmanhaAtual() {
    if (!lembreteAtual) return
    const id = lembreteAtual.id
    fecharAtual()
    try {
      const amanha = new Date()
      amanha.setDate(amanha.getDate() + 1)
      await updateDoc(doc(db, COLLECTIONS.TAREFAS, id), {
        dataLembrete: Timestamp.fromDate(new Date(amanha.getFullYear(), amanha.getMonth(), amanha.getDate())),
      })
    } catch (err) {
      console.error('[useLembretes] erro ao adiar tarefa:', err?.code, err?.message)
    }
  }

  return { lembreteAtual, concluirAtual, adiarAmanhaAtual, fecharAtual }
}
