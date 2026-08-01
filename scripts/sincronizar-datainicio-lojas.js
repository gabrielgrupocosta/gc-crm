// Preenche a dataInicio das lojas que já existem mas ficaram sem essa data —
// isso acontecia com lojas criadas antes da sincronização com o contrato
// existir (ou vinculadas a um contrato que nunca foi reeditado depois disso).
// Para cada loja sem dataInicio, procura o contrato que a referencia em
// itensLojas (preferindo o contrato "ativo"; sem um ativo, o mais recente por
// dataInicio) e copia a dataInicio de lá.
//
// Uso:
//   node scripts/sincronizar-datainicio-lojas.js <email-admin> <senha-admin>

import { signInWithEmailAndPassword } from 'firebase/auth'
import {
  db, COLLECTIONS, auth,
  collection, getDocs, doc, updateDoc,
} from '../src/services/firebase.js'

function tsMillis(ts) {
  if (!ts) return 0
  return typeof ts.toMillis === 'function' ? ts.toMillis() : new Date(ts).getTime()
}

async function main() {
  const [, , email, password] = process.argv
  if (!email || !password) {
    console.error('Uso: node scripts/sincronizar-datainicio-lojas.js <email-admin> <senha-admin>')
    process.exit(1)
  }

  console.log('Autenticando...')
  await signInWithEmailAndPassword(auth, email, password)
  console.log('✓ Autenticado\n')

  const [lojasSnap, contratosSnap] = await Promise.all([
    getDocs(collection(db, COLLECTIONS.LOJAS)),
    getDocs(collection(db, COLLECTIONS.CONTRATOS)),
  ])

  const contratos = contratosSnap.docs.map(d => ({ id: d.id, ...d.data() }))

  // Índice lojaId -> lista de contratos que a referenciam, pra escolher o melhor.
  const contratosPorLoja = {}
  for (const contrato of contratos) {
    for (const item of contrato.itensLojas ?? []) {
      if (!item.lojaId) continue
      contratosPorLoja[item.lojaId] = contratosPorLoja[item.lojaId] ?? []
      contratosPorLoja[item.lojaId].push(contrato)
    }
  }

  function melhorContrato(lista) {
    const ativo = lista.find(c => c.status === 'ativo')
    if (ativo) return ativo
    return lista.slice().sort((a, b) => tsMillis(b.dataInicio) - tsMillis(a.dataInicio))[0]
  }

  console.log(`Encontradas ${lojasSnap.docs.length} lojas, ${contratos.length} contratos.`)

  let corrigidas = 0
  let semContrato = 0
  for (const d of lojasSnap.docs) {
    const loja = d.data()
    if (loja.dataInicio) continue // já tem data, não mexe

    const candidatos = contratosPorLoja[d.id]
    if (!candidatos || candidatos.length === 0) { semContrato++; continue }

    const contrato = melhorContrato(candidatos)
    if (!contrato?.dataInicio) { semContrato++; continue }

    console.log(`Preenchendo "${loja.nome ?? d.id}" com dataInicio do contrato ${contrato.id}`)
    await updateDoc(doc(db, COLLECTIONS.LOJAS, d.id), { dataInicio: contrato.dataInicio })
    corrigidas++
  }

  console.log(`\n${corrigidas} lojas corrigidas.`)
  console.log(`${semContrato} lojas sem dataInicio e sem contrato correspondente pra copiar (ficaram como estavam).`)
  process.exit(0)
}

main().catch(err => {
  console.error('\n✗ Erro:', err.code ?? '', err.message ?? err)
  process.exit(1)
})
