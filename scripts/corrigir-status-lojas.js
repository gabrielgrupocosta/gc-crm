// Corrige o campo `status` de documentos em `lojas` que foram gravados com grafia
// diferente da usada pelo app (ex: "ativa"/"ativo" em vez de "Ativa"), causando
// contagens erradas em Dashboard/Ranking/Carteira/etc.
//
// Uso:
//   node scripts/corrigir-status-lojas.js <email-admin> <senha-admin>

import { signInWithEmailAndPassword } from 'firebase/auth'
import {
  db, COLLECTIONS, auth,
  collection, getDocs, doc, updateDoc,
} from '../src/services/firebase.js'

const CANONICO = {
  ativa:     'Ativa',
  ativo:     'Ativa',
  pausada:   'Pausada',
  cancelada: 'Cancelada',
}

async function main() {
  const [, , email, password] = process.argv
  if (!email || !password) {
    console.error('Uso: node scripts/corrigir-status-lojas.js <email-admin> <senha-admin>')
    process.exit(1)
  }

  console.log('Autenticando...')
  await signInWithEmailAndPassword(auth, email, password)
  console.log('✓ Autenticado\n')

  const snap = await getDocs(collection(db, COLLECTIONS.LOJAS))
  console.log(`Encontradas ${snap.docs.length} lojas.`)

  let corrigidas = 0
  for (const d of snap.docs) {
    const loja   = d.data()
    const atual  = loja.status
    const chave  = atual?.toLowerCase()
    const certo  = CANONICO[chave]

    if (certo && atual !== certo) {
      console.log(`Corrigindo "${loja.nome ?? d.id}": "${atual}" → "${certo}"`)
      await updateDoc(doc(db, COLLECTIONS.LOJAS, d.id), { status: certo })
      corrigidas++
    }
  }

  console.log(`\n${corrigidas} de ${snap.docs.length} lojas corrigidas.`)
  process.exit(0)
}

main().catch(err => {
  console.error('\n✗ Erro:', err.code ?? '', err.message ?? err)
  process.exit(1)
})
