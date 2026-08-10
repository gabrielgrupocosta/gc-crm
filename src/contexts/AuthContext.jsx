import { createContext, useContext, useEffect, useState } from 'react'
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  getIdTokenResult,
} from 'firebase/auth'
import { auth, db, COLLECTIONS, doc, getDoc } from '../services/firebase'

const AuthContext = createContext(null)

const LIMITE_SESSAO_MS = 3 * 60 * 60 * 1000 // 3 horas

// Lê o custom claim (role, organizacaoId) do token e junta com o doc em
// users/{uid} (nome, email, status etc). O claim é sempre a fonte de verdade
// de acesso — o doc é só dado de exibição/cadastro.
async function carregarPerfil(fbUser, { forcarRefresh = false } = {}) {
  const tokenResult = await getIdTokenResult(fbUser, forcarRefresh)
  const { role, organizacaoId } = tokenResult.claims

  const snap = await getDoc(doc(db, COLLECTIONS.USERS, fbUser.uid))
  const dadosDoc = snap.exists() ? snap.data() : {}

  return {
    uid: fbUser.uid,
    role: role ?? null,
    organizacaoId: organizacaoId ?? null,
    ...dadosDoc,
  }
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)   // claims (role/organizacaoId) + dados do Firestore
  const [firebaseUser, setFirebaseUser] = useState(null)
  const [loading, setLoading] = useState(true)
  // Segura o redirect automático de /login → /dashboard enquanto a animação
  // de entrada (logo girando) está tocando.
  const [introAtiva, setIntroAtiva] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      try {
        if (fbUser) {
          setFirebaseUser(fbUser)
          setUser(await carregarPerfil(fbUser))
        } else {
          setFirebaseUser(null)
          setUser(null)
        }
      } catch {
        // Firestore/Auth inacessível ou regras bloqueando — trata como sem sessão
        setUser(null)
      } finally {
        setLoading(false)
      }
    })

    return unsubscribe
  }, [])

  // Desloga automaticamente 3h após o login, mesmo que a aba fique aberta.
  // Usa lastSignInTime do próprio Firebase (sobrevive a reload/refresh de token).
  useEffect(() => {
    if (!firebaseUser) return

    const inicioSessao = new Date(firebaseUser.metadata.lastSignInTime).getTime()
    const restante = LIMITE_SESSAO_MS - (Date.now() - inicioSessao)

    if (restante <= 0) {
      signOut(auth)
      return
    }

    const timer = setTimeout(() => signOut(auth), restante)
    return () => clearTimeout(timer)
  }, [firebaseUser])

  async function login(email, password) {
    // Precisa ser setado ANTES do signIn: onAuthStateChanged dispara em paralelo
    // e pode marcar `user` como logado antes deste método terminar de carregar
    // o perfil — introAtiva já precisa estar true nesse momento, senão o
    // PublicRoute redireciona para /dashboard antes da animação de entrada.
    setIntroAtiva(true)

    let credential
    try {
      credential = await signInWithEmailAndPassword(auth, email, password)
    } catch (err) {
      setIntroAtiva(false)
      throw err
    }

    let perfil
    try {
      // forcarRefresh: garante que claims recém-atribuídos (ex: conta criada
      // há pouco) já apareçam neste próprio login, sem precisar de um segundo.
      perfil = await carregarPerfil(credential.user, { forcarRefresh: true })
    } catch (err) {
      await signOut(auth)
      setIntroAtiva(false)
      if (err?.code === 'permission-denied') {
        throw new Error('Sem permissão para ler os dados. Verifique as regras do Firestore.')
      }
      throw new Error('Erro ao carregar perfil. Tente novamente.')
    }

    if (!perfil.role) {
      await signOut(auth)
      setIntroAtiva(false)
      throw new Error('Perfil não encontrado. Peça ao administrador para criar seu acesso.')
    }

    if (perfil.status === 'inativo') {
      await signOut(auth)
      setIntroAtiva(false)
      throw new Error('Conta desativada. Fale com o administrador.')
    }

    setUser(perfil)
    return perfil
  }

  function finalizarIntro() {
    setIntroAtiva(false)
  }

  async function logout() {
    await signOut(auth)
  }

  // Força a releitura do token — usar depois de promover/transferir um usuário
  // de organização, para que a sessão já aberta enxergue o novo claim.
  async function atualizarPermissoes() {
    if (!firebaseUser) return
    setUser(await carregarPerfil(firebaseUser, { forcarRefresh: true }))
  }

  const isSuperAdmin = user?.role === 'master'
  const isAdminOrg   = user?.role === 'admin_org'
  const isGestor     = user?.role === 'gestor'
  const isSupervisor = user?.role === 'supervisor'
  const isAdmin      = isSuperAdmin || isAdminOrg

  // Admin/master enxergam tudo. Supervisor só os menus liberados no seu cadastro.
  function podeVerMenu(chave) {
    return isAdmin || (isSupervisor && (user?.menuPermissions ?? []).includes(chave))
  }

  return (
    <AuthContext.Provider value={{
      user, firebaseUser, loading, login, logout, atualizarPermissoes,
      isSuperAdmin, isAdminOrg, isGestor, isSupervisor, isAdmin, podeVerMenu,
      introAtiva, finalizarIntro,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
