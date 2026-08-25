import { useEffect, useState } from 'react'
import {
  db,
  COLLECTIONS,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from '../../services/firebase'

function logError(operacao, err) {
  console.error(`[useConversas] ${operacao}:`, err?.code, err?.message)
}

export function useConversas() {
  const [conversas, setConversas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const conversasQuery = query(
      collection(db, COLLECTIONS.CONVERSAS_WHATSAPP),
      orderBy('ultimaAtividade', 'desc'),
    )

    const unsubscribe = onSnapshot(
      conversasQuery,
      snapshot => {
        setConversas(snapshot.docs.map(documento => ({ id: documento.id, ...documento.data(), phone: documento.data().phone ?? documento.id })))
        setLoading(false)
      },
      err => {
        logError('onSnapshot', err)
        setLoading(false)
      },
    )

    return unsubscribe
  }, [])

  async function atualizar(id, dados, operacao) {
    try {
      await updateDoc(doc(db, COLLECTIONS.CONVERSAS_WHATSAPP, id), dados)
    } catch (err) {
      logError(operacao, err)
      throw err
    }
  }

  function mudarColuna(id, novaColuna) {
    return atualizar(id, { coluna: novaColuna }, 'mudarColuna')
  }

  function mudarStatus(id, novoStatus) {
    return atualizar(id, { status: novoStatus }, 'mudarStatus')
  }

  function marcarLida(id) {
    return atualizar(id, { lida: true }, 'marcarLida')
  }

  function excluirMensagem(id, index) {
    const conversa = conversas.find(item => item.id === id)
    if (!conversa) return Promise.resolve()
    const mensagens = (conversa.mensagens ?? []).filter((_, i) => i !== index)
    const ultima = mensagens[mensagens.length - 1]
    return atualizar(id, {
      mensagens,
      ...(ultima ? { ultimaMensagem: ultima.texto } : {}),
    }, 'excluirMensagem')
  }

  async function excluirConversa(id) {
    try {
      await deleteDoc(doc(db, COLLECTIONS.CONVERSAS_WHATSAPP, id))
    } catch (err) {
      logError('excluirConversa', err)
      throw err
    }
  }

  return { conversas, loading, mudarColuna, mudarStatus, marcarLida, excluirMensagem, excluirConversa }
}
