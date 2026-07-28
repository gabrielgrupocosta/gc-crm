import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { httpsCallable } from 'firebase/functions'
import {
  db, COLLECTIONS, functions,
  collection, query, where, getDocs,
} from '../services/firebase'
import { useAuth } from './AuthContext'
import { useToast } from '../components/UI/Toast'

const assistenteChatFn = httpsCallable(functions, 'assistenteChat')

const AssistenteChatContext = createContext(null)

// Estado único do Assistente Delivery — compartilhado entre a aba dedicada
// (/assistente) e o popup flutuante, pra abrir o popup em qualquer tela e
// continuar exatamente a mesma conversa ao entrar na aba (e vice-versa).
export function AssistenteChatProvider({ children }) {
  const { user, isAdmin, isSuperAdmin } = useAuth()
  const toast = useToast()

  const [lojas, setLojas] = useState([])
  const [lojaId, setLojaId] = useState('')
  const [mensagens, setMensagens] = useState([])
  const [enviando, setEnviando] = useState(false)
  const [popupAberto, setPopupAberto] = useState(false)

  useEffect(() => {
    async function loadLojas() {
      const orgId = user?.organizacaoId ?? null
      const escopo = isSuperAdmin ? [] : [where('organizacaoId', '==', orgId)]
      const q = isAdmin
        ? query(collection(db, COLLECTIONS.LOJAS), ...escopo)
        : query(collection(db, COLLECTIONS.LOJAS), ...escopo, where('gestorId', '==', user.uid))
      try {
        const snap = await getDocs(q)
        setLojas(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(l => l.status?.toLowerCase() !== 'cancelada'))
      } catch (err) {
        console.error('[AssistenteChat] erro ao carregar lojas:', err?.code, err?.message)
      }
    }
    if (user) loadLojas()
    else { setLojas([]); setLojaId('') }
  }, [user, isAdmin, isSuperAdmin])

  // lojaIdOverride existe pro caso de confirmação por botão (confirmarLoja):
  // setLojaId já foi chamado, mas seu novo valor só fica visível no próximo
  // render — sem o override, essa chamada ainda mandaria o lojaId antigo.
  const enviarMensagem = useCallback(async (texto, { lojaIdOverride } = {}) => {
    const t = texto.trim()
    if (!t || enviando) return

    const novasMensagens = [...mensagens, { role: 'user', content: t, ts: Date.now() }]
    setMensagens(novasMensagens)
    setEnviando(true)
    try {
      const { data } = await assistenteChatFn({
        messages: novasMensagens.map(({ role, content }) => ({ role, content })),
        lojaId: lojaIdOverride ?? (lojaId || null),
      })
      setMensagens(prev => [...prev, { role: 'assistant', content: data.reply, opcoesLoja: data.opcoesLoja || null, ts: Date.now() }])
    } catch (err) {
      console.error('[AssistenteChat] erro:', err?.code, err?.message)
      toast('Erro ao falar com o assistente. Tente novamente.', 'error')
      setMensagens(prev => prev.slice(0, -1))
    } finally {
      setEnviando(false)
    }
  }, [mensagens, lojaId, enviando, toast])

  // Chamado quando o gestor clica num dos botões de loja sugeridos pelo
  // assistente (nome ambíguo ou parecido) — fixa a loja escolhida no seletor
  // e reenvia o nome dela como se o gestor tivesse digitado, já com o lojaId
  // certo, pra vir com os dados reais na resposta.
  const confirmarLoja = useCallback((loja) => {
    setLojaId(loja.id)
    enviarMensagem(loja.nome, { lojaIdOverride: loja.id })
  }, [enviarMensagem])

  function limparConversa() {
    setMensagens([])
  }

  return (
    <AssistenteChatContext.Provider value={{
      lojas, lojaId, setLojaId,
      mensagens, enviando, enviarMensagem, confirmarLoja, limparConversa,
      popupAberto, setPopupAberto,
    }}>
      {children}
    </AssistenteChatContext.Provider>
  )
}

export function useAssistenteChat() {
  const ctx = useContext(AssistenteChatContext)
  if (!ctx) throw new Error('useAssistenteChat deve ser usado dentro de AssistenteChatProvider')
  return ctx
}
