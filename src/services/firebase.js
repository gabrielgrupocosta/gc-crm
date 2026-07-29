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
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { getFunctions } from 'firebase/functions'

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
}
