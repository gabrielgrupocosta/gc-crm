import { createContext, useContext, useEffect, useState } from 'react'
import { db, COLLECTIONS, collection, query, where, onSnapshot } from '../services/firebase'
import { useAuth } from './AuthContext'

const ModoTesteContext = createContext(null)

// Enquanto pelo menos uma organização estiver com `flagTeste: true`, o master
// só deve enxergar dados dessas organizações em todas as telas (Dashboard,
// Financeiro, Ranking etc). admin_org/gestor não são afetados — já são
// restritos à própria organização independente disso.
export function ModoTesteProvider({ children }) {
  const { isSuperAdmin } = useAuth()
  const [organizacaoIdsPermitidos, setOrganizacaoIdsPermitidos] = useState([])

  useEffect(() => {
    if (!isSuperAdmin) {
      setOrganizacaoIdsPermitidos([])
      return
    }

    const q = query(collection(db, COLLECTIONS.ORGANIZACOES), where('flagTeste', '==', true))
    const unsubscribe = onSnapshot(q, (snap) => {
      setOrganizacaoIdsPermitidos(snap.docs.map(d => d.id))
    }, () => {
      setOrganizacaoIdsPermitidos([])
    })

    return unsubscribe
  }, [isSuperAdmin])

  const modoTesteAtivo = organizacaoIdsPermitidos.length > 0

  return (
    <ModoTesteContext.Provider value={{ modoTesteAtivo, organizacaoIdsPermitidos }}>
      {children}
    </ModoTesteContext.Provider>
  )
}

export function useModoTeste() {
  const ctx = useContext(ModoTesteContext)
  if (!ctx) throw new Error('useModoTeste deve ser usado dentro de ModoTesteProvider')
  return ctx
}
