import { createContext, useContext, useEffect, useState } from 'react'
import { db, COLLECTIONS, collection, query, where, onSnapshot } from '../services/firebase'
import { useAuth } from './AuthContext'

const ModoTesteContext = createContext(null)

const LS_KEY = 'ihubfood_filtroOrganizacaoId'

// Restringe a visão do master (organizacaoIdsPermitidos) por dois caminhos
// independentes, que convivem no mesmo mecanismo pra não exigir integração
// duplicada em cada tela:
//  1) "modo teste" — enquanto pelo menos uma organização tiver `flagTeste:
//     true`, restringe automaticamente a essas organizações (toggle na aba
//     Organizações, liberado só pro e-mail de QA).
//  2) filtro manual — qualquer master pode escolher "ver como organização X"
//     na aba Organizações; filtra todas as telas (Dashboard, Contratos,
//     Lojas, Clientes, Financeiro, Carteira etc) só pra aquela organização.
// Se ambos estiverem ativos, o filtro manual tem prioridade. admin_org/gestor
// não são afetados — já são restritos à própria organização independente disso.
export function ModoTesteProvider({ children }) {
  const { isSuperAdmin, loading: authLoading } = useAuth()
  const [organizacaoIdsFlagTeste, setOrganizacaoIdsFlagTeste] = useState([])
  const [filtroOrganizacaoId, setFiltroOrganizacaoIdState] = useState(() => {
    try { return localStorage.getItem(LS_KEY) || '' } catch { return '' }
  })

  useEffect(() => {
    if (!isSuperAdmin) {
      setOrganizacaoIdsFlagTeste([])
      return
    }

    const q = query(collection(db, COLLECTIONS.ORGANIZACOES), where('flagTeste', '==', true))
    const unsubscribe = onSnapshot(q, (snap) => {
      setOrganizacaoIdsFlagTeste(snap.docs.map(d => d.id))
    }, () => {
      setOrganizacaoIdsFlagTeste([])
    })

    return unsubscribe
  }, [isSuperAdmin])

  useEffect(() => {
    // Só limpa depois que o auth resolveu de fato — enquanto `loading` ainda
    // está true, `isSuperAdmin` é o valor default (false) e não reflete o
    // usuário real, então limpar aqui apagaria o filtro do master em
    // qualquer reload de página antes da confirmação do papel.
    if (authLoading) return
    if (!isSuperAdmin && filtroOrganizacaoId) setFiltroOrganizacaoIdState('')
  }, [isSuperAdmin, authLoading])

  function setFiltroOrganizacaoId(id) {
    setFiltroOrganizacaoIdState(id)
    try {
      if (id) localStorage.setItem(LS_KEY, id)
      else localStorage.removeItem(LS_KEY)
    } catch { /* localStorage indisponível — segue só em memória */ }
  }

  const organizacaoIdsPermitidos = isSuperAdmin && filtroOrganizacaoId
    ? [filtroOrganizacaoId]
    : organizacaoIdsFlagTeste

  const modoTesteAtivo = isSuperAdmin && organizacaoIdsPermitidos.length > 0

  return (
    <ModoTesteContext.Provider value={{
      modoTesteAtivo,
      organizacaoIdsPermitidos,
      filtroOrganizacaoId: isSuperAdmin ? filtroOrganizacaoId : '',
      setFiltroOrganizacaoId,
    }}>
      {children}
    </ModoTesteContext.Provider>
  )
}

export function useModoTeste() {
  const ctx = useContext(ModoTesteContext)
  if (!ctx) throw new Error('useModoTeste deve ser usado dentro de ModoTesteProvider')
  return ctx
}
