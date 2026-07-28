// Remove todos os documentos marcados com um `seedTag` específico — usado
// pra apagar dados de teste gerados em massa (clientes/lojas/contratos/
// resultados/relatorios_semanais/tarefas/acoes) sem afetar dados reais.
// Roda direto com o Admin SDK via service account (mesmo padrão de
// seed-super-admin.js), nunca pelo client.
//
// Uso:
//   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json \
//   node scripts/limpar-dados-por-tag.js <seedTag>

import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const [, , seedTag] = process.argv

if (!seedTag) {
  console.error('Uso: node scripts/limpar-dados-por-tag.js <seedTag>')
  process.exit(1)
}

initializeApp()
const db = getFirestore()

const COLECOES = ['clientes', 'lojas', 'contratos', 'resultados', 'relatorios_semanais', 'tarefas', 'acoes', 'cobrancas']

async function apagarColecao(nome) {
  const snap = await db.collection(nome).where('seedTag', '==', seedTag).get()
  if (snap.empty) {
    console.log(`  ${nome}: nada encontrado`)
    return 0
  }
  const batches = []
  let batch = db.batch()
  let ops = 0
  snap.docs.forEach(doc => {
    batch.delete(doc.ref)
    ops++
    if (ops >= 400) { batches.push(batch); batch = db.batch(); ops = 0 }
  })
  if (ops > 0) batches.push(batch)
  for (const b of batches) await b.commit()
  console.log(`  ${nome}: ${snap.size} removidos`)
  return snap.size
}

async function main() {
  console.log(`Apagando tudo com seedTag="${seedTag}"...`)
  let total = 0
  for (const col of COLECOES) {
    total += await apagarColecao(col)
  }
  console.log(`\n✓ Concluído — ${total} documentos removidos no total.`)
}

main().catch(err => { console.error('✗ Falha ao limpar:', err.message); process.exit(1) })
