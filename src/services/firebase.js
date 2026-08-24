import { initializeApp } from 'firebase/app'
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateEmail,
  updatePassword,
  deleteUser,
  signOut,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from 'firebase/auth'
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  runTransaction,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore'
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { getFunctions } from 'firebase/functions'
import { getMessaging, isSupported as isMessagingSupported } from 'firebase/messaging'

const firebaseConfig = {
  apiKey:            'AIzaSyBrOl8KlLBqxINgaucxDjNRTu62YqRMMYc',
  authDomain:        'ihubfood.firebaseapp.com',
  projectId:         'ihubfood',
  storageBucket:     'ihubfood.firebasestorage.app',
  messagingSenderId: '454577135355',
  appId:             '1:454577135355:web:7db40d1de899e11395da5e',
}

const app          = initializeApp(firebaseConfig)
const secondaryApp = initializeApp(firebaseConfig, 'secondary')

export const auth      = getAuth(app)
export const db        = getFirestore(app)
export const storage   = getStorage(app)
export const functions = getFunctions(app)

// Messaging não é suportado em todo navegador (ex: Safari antigo, contexto não
// seguro) — getMessaging() sozinho lança nesses casos, então só inicializa
// depois de confirmar suporte via isSupported().
export let messaging = null
export const messagingPronto = isMessagingSupported().then((suportado) => {
  if (suportado) messaging = getMessaging(app)
  return suportado
})

const secondaryAuth = getAuth(secondaryApp)

// Cria conta Firebase Auth sem deslogar o admin (usa secondary app instance)
export async function createAuthUser(email, password) {
  const { user } = await createUserWithEmailAndPassword(secondaryAuth, email, password)
  await signOut(secondaryAuth)
  return { uid: user.uid, email: user.email }
}

// Reautentica como o gestor (secondary app instance) e troca o e-mail de login
// no Firebase Auth, sem afetar a sessão do admin logado. Retorna o UID real da
// conta Auth para o chamador conferir se bate com o ID do documento em users/.
export async function updateGestorEmail(emailAtual, senhaAtual, novoEmail) {
  const { user } = await signInWithEmailAndPassword(secondaryAuth, emailAtual, senhaAtual)
  try {
    await updateEmail(user, novoEmail)
    return { uid: user.uid }
  } finally {
    await signOut(secondaryAuth)
  }
}

// Reautentica como o gestor (secondary app instance) só pra descobrir o UID real
// da conta no Firebase Auth — usado pra vincular contas importadas com ID legado.
export async function getAuthUid(email, senha) {
  const { user } = await signInWithEmailAndPassword(secondaryAuth, email, senha)
  await signOut(secondaryAuth)
  return user.uid
}

// Reautentica como o gestor (secondary app instance) e troca a senha no Firebase Auth,
// sem afetar a sessão do admin logado.
export async function updateGestorPassword(emailAtual, senhaAtual, novaSenha) {
  const { user } = await signInWithEmailAndPassword(secondaryAuth, emailAtual, senhaAtual)
  try {
    await updatePassword(user, novaSenha)
  } finally {
    await signOut(secondaryAuth)
  }
}

// Reautentica como o gestor (secondary app instance) e deleta a própria conta
// no Firebase Auth, sem afetar a sessão do admin logado — usado na exclusão de
// gestor pra revogar o acesso sem precisar passar pelo Firebase Console.
export async function deleteGestorAuthAccount(email, senha) {
  const { user } = await signInWithEmailAndPassword(secondaryAuth, email, senha)
  try {
    await deleteUser(user)
  } finally {
    await signOut(secondaryAuth)
  }
}

// Faz upload de um arquivo/blob para o Storage e retorna a URL pública de download
export async function uploadImagem(file, caminho) {
  const storageRef = ref(storage, caminho)
  const snapshot = await uploadBytes(storageRef, file, file.type ? { contentType: file.type } : undefined)
  const url = await getDownloadURL(snapshot.ref)
  return url
}

// Remove um arquivo do Storage — best-effort, ignora se já não existir
export async function deleteImagem(caminho) {
  try {
    await deleteObject(ref(storage, caminho))
  } catch (err) {
    if (err.code !== 'storage/object-not-found') throw err
  }
}

// Re-exporta os helpers do Firestore/Auth para evitar imports duplos nos hooks/services
export {
  updateEmail,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  arrayUnion,
  arrayRemove,
}

// Rate limit de criação nas coleções críticas (clientes/contratos/lojas) —
// espelha o limite validado em firestore.rules (função rateLimitOk). Cria o
// documento novo e incrementa o contador rate_limits/{uid}_{colecao} numa
// única transação: sem isso, dá pra criar o documento sem tocar no contador
// (a regra do Firestore só aceita a criação se getAfter() enxergar o contador
// já incrementado dentro da MESMA transação).
const LIMITE_CRIACAO_POR_HORA = 40
const JANELA_RATE_LIMIT_MS = 60 * 60 * 1000

export async function criarComRateLimit(colecao, dados) {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Login necessário')

  const novoRef = doc(collection(db, colecao))
  const rlRef = doc(db, 'rate_limits', `${uid}_${colecao}`)

  await runTransaction(db, async (tx) => {
    const rlSnap = await tx.get(rlRef)
    const atual = rlSnap.exists() ? rlSnap.data() : null
    const janelaExpirada = !atual || (Date.now() - atual.inicio.toMillis()) > JANELA_RATE_LIMIT_MS

    if (janelaExpirada) {
      tx.set(rlRef, { contagem: 1, inicio: serverTimestamp() })
    } else {
      if (atual.contagem >= LIMITE_CRIACAO_POR_HORA) {
        throw new Error('Limite de criação atingido para esta seção. Aguarde alguns minutos e tente novamente.')
      }
      tx.set(rlRef, { contagem: atual.contagem + 1, inicio: atual.inicio })
    }
    tx.set(novoRef, dados)
  })

  return novoRef
}

// Nomes das coleções como constantes para evitar typos
export const COLLECTIONS = {
  USERS:         'users',
  CLIENTES:      'clientes',
  LOJAS:         'lojas',
  RESULTADOS:    'resultados',
  FEEDBACKS:     'feedbacks',
  ATIVIDADES:    'atividades',
  TAREFAS:       'tarefas',
  ACOES:         'acoes',
  ACAO_MODELOS:  'acao_modelos',
  ORGANIZACOES:  'organizacoes',
  CRM_LEADS:     'crm_leads',
  CONTRATOS:     'contratos',
  COBRANCAS:     'cobrancas',
  CHECKPOINTS_LOJAS_NOVAS: 'checkpoints_lojas_novas',
  CONVERSAS_WHATSAPP: 'conversas_whatsapp',
}
