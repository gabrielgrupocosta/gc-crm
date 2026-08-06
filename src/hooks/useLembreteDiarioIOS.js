import { useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/UI/Toast'
import {
  db, COLLECTIONS,
  collection, query, where, getDocs,
} from '../services/firebase'

function ehIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
}

function ehPWAInstalada() {
  return window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches
}

function chaveDoDia(uid) {
  const hoje = new Date()
  const data = `${hoje.getFullYear()}-${hoje.getMonth() + 1}-${hoje.getDate()}`
  return `ihubfood-lembrete-ios-${uid}-${data}`
}

// iOS Safari só recebe push de verdade se o app estiver instalado como PWA
// na tela inicial — sem isso, o Web Push da Apple simplesmente não funciona.
// Como alternativa, na primeira vez que o usuário abre o app no dia (nesse
// cenário específico), mostramos um toast com as pendências, já que é a
// única forma de "notificar" que resta disponível.
export function useLembreteDiarioIOS() {
  const { user, isSuperAdmin } = useAuth()
  const toast = useToast()

  useEffect(() => {
    if (!user || !ehIOS() || ehPWAInstalada()) return

    const chave = chaveDoDia(user.uid)
    if (localStorage.getItem(chave)) return

    async function verificar() {
      try {
        const escopoOrg = isSuperAdmin ? [] : [where('organizacaoId', '==', user.organizacaoId ?? null)]
        const snap = await getDocs(query(
          collection(db, COLLECTIONS.TAREFAS),
          ...escopoOrg,
          where('gestorId', '==', user.uid),
          where('status', '==', 'pendente'),
        ))
        const pendentes = snap.docs
          .map(d => d.data())
          .filter(t => t.tipo !== 'registro').length

        if (pendentes > 0) {
          toast(
            `Você tem ${pendentes} ${pendentes === 1 ? 'tarefa pendente' : 'tarefas pendentes'}`,
            'warning'
          )
        }
      } catch (err) {
        console.error('[useLembreteDiarioIOS] erro ao verificar tarefas:', err?.code, err?.message)
      } finally {
        localStorage.setItem(chave, '1')
      }
    }

    verificar()
  }, [user, isSuperAdmin, toast])
}
