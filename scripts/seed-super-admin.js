// Cria a PRIMEIRA conta master da plataforma — só existe porque nenhuma
// outra function pode criar isso (criarSuperAdmin exige um master já
// logado). Roda uma única vez, direto com o Admin SDK via service account,
// nunca pelo client. Depois de existir 1 master, use a function
// `criarSuperAdmin` (callable, autenticada) para criar os demais.
//
// Uso:
//   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json \
//   node scripts/seed-super-admin.js <email> <senha> <nome>

import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const [, , email, senha, nome] = process.argv

if (!email || !senha || !nome) {
  console.error('Uso: node scripts/seed-super-admin.js <email> <senha> <nome>')
  process.exit(1)
}

initializeApp()
const auth = getAuth()
const db = getFirestore()

async function main() {
  const userRecord = await auth.createUser({ email, password: senha, displayName: nome })
  await auth.setCustomUserClaims(userRecord.uid, { role: 'master', organizacaoId: null })
  await db.collection('users').doc(userRecord.uid).set({
    nome,
    email,
    role: 'master',
    organizacaoId: null,
    status: 'ativo',
    criadoEm: FieldValue.serverTimestamp(),
  })
  console.log(`✓ master criado: uid=${userRecord.uid} email=${email}`)
}

main().catch((err) => {
  console.error('✗ Falha ao criar master:', err.message)
  process.exit(1)
})
