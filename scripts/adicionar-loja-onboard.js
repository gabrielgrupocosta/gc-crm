// Adiciona manualmente uma loja já existente ao fluxo de Onboard — útil pra
// lojas criadas antes da flag de onboard existir, ou que foram criadas com a
// flag desmarcada e precisam entrar no funil depois de tudo.
//
// Uso:
//   node scripts/adicionar-loja-onboard.js <email-admin> <senha-admin> "<nome ou parte do nome da loja>"

import { signInWithEmailAndPassword } from 'firebase/auth'
import {
  db, COLLECTIONS, auth,
  collection, getDocs, doc, updateDoc,
} from '../src/services/firebase.js'

function normalizarNome(s) {
  return (s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function main() {
  const [, , email, password, termoBusca] = process.argv
  if (!email || !password || !termoBusca) {
    console.error('Uso: node scripts/adicionar-loja-onboard.js <email-admin> <senha-admin> "<nome ou parte do nome da loja>"')
    process.exit(1)
  }

  console.log('Autenticando...')
  await signInWithEmailAndPassword(auth, email, password)
  console.log('✓ Autenticado\n')

  const snap = await getDocs(collection(db, COLLECTIONS.LOJAS))
  const alvo = normalizarNome(termoBusca)
  const candidatas = snap.docs.filter(d => normalizarNome(d.data().nome).includes(alvo))

  if (candidatas.length === 0) {
    console.log(`Nenhuma loja encontrada com "${termoBusca}" no nome.`)
    process.exit(1)
  }
  if (candidatas.length > 1) {
    console.log(`Mais de uma loja encontrada com "${termoBusca}" — seja mais específico:`)
    candidatas.forEach(d => console.log(`- ${d.data().nome} (id: ${d.id})`))
    process.exit(1)
  }

  const lojaDoc = candidatas[0]
  const loja = lojaDoc.data()

  if (loja.onboardStatus) {
    console.log(`"${loja.nome}" já está no fluxo de Onboard (status atual: ${loja.onboardStatus}). Nada a fazer.`)
    process.exit(0)
  }

  await updateDoc(doc(db, COLLECTIONS.LOJAS, lojaDoc.id), { onboardStatus: 'dados_pendentes' })
  console.log(`✓ "${loja.nome}" adicionada ao fluxo de Onboard (status: dados_pendentes).`)
  process.exit(0)
}

main().catch(err => {
  console.error('\n✗ Erro:', err.code ?? '', err.message ?? err)
  process.exit(1)
})
