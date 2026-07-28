// Atualiza o campo `responsavel` das lojas no Firestore a partir do ID do grupo do
// WhatsApp (número presente em `nomeGrupoOriginal`, ex: "- 159 -" ou "• 159 "). Itens
// sem ID são resolvidos por fuzzy matching no campo `nome` da loja.
//
// Uso:
//   node scripts/atualizar-clientes.js <email-admin> <senha-admin> [caminho-do-json]
//
// Se nenhum caminho de JSON for informado, usa scripts/data/clientes.json.

import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join, resolve } from 'path'
import { signInWithEmailAndPassword } from 'firebase/auth'
import {
  db, COLLECTIONS, auth,
  collection, getDocs, doc, updateDoc,
} from '../src/services/firebase.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─── Normalização para comparação fuzzy de nomes ───────────────────────────────────────────────

function normalizarNome(s) {
  return (s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ') // remove pontuação
    .replace(/\s+/g, ' ')
    .trim()
}

function nomesCorrespondem(a, b) {
  const na = normalizarNome(a)
  const nb = normalizarNome(b)
  if (!na || !nb) return false
  return na === nb || na.includes(nb) || nb.includes(na)
}

// ─── Busca por ID do grupo dentro de `nomeGrupoOriginal` ("- 159 -", "• 159 ", etc) ────────────

function encontrarPorId(lojas, id) {
  const re = new RegExp(`\\b${id}\\b`)
  return lojas.filter(l => re.test(l.data.nomeGrupoOriginal ?? ''))
}

function encontrarPorNome(lojas, nomeAlvo) {
  return lojas.filter(l => nomesCorrespondem(l.data.nome, nomeAlvo))
}

// ─── Resolve o documento certo para um item do JSON ────────────────────────────────────────────

function resolverLoja(lojas, item) {
  // Com ID: só considera lojas cujo nomeGrupoOriginal contém esse número — nunca cai para
  // fuzzy matching no catálogo inteiro, senão um nome curto (ex: "Big Pizza") pode colidir
  // por substring com o nome de outra loja/grupo que nada tem a ver com esse ID.
  if (item.id) {
    let candidatas = encontrarPorId(lojas, item.id)

    if (candidatas.length > 1) {
      const porNome = candidatas.filter(l => nomesCorrespondem(l.data.nome, item.loja))
      if (porNome.length >= 1) candidatas = porNome
    }

    return candidatas.length === 1 ? candidatas[0] : null
  }

  // Sem ID: única forma de resolver é fuzzy matching pelo nome.
  const candidatas = encontrarPorNome(lojas, item.loja)
  return candidatas.length === 1 ? candidatas[0] : null
}

// ─── Atualização ────────────────────────────────────────────────────────────────────────────────

async function main() {
  const [, , email, password, jsonArg] = process.argv

  if (!email || !password) {
    console.error('Uso: node scripts/atualizar-clientes.js <email-admin> <senha-admin> [caminho-do-json]')
    process.exit(1)
  }

  const jsonPath = jsonArg
    ? resolve(jsonArg)
    : join(__dirname, 'data', 'clientes.json')

  if (!existsSync(jsonPath)) {
    console.error(`Arquivo não encontrado: ${jsonPath}`)
    process.exit(1)
  }

  console.log('Autenticando...')
  await signInWithEmailAndPassword(auth, email, password)
  console.log('✓ Autenticado\n')

  const itens = JSON.parse(readFileSync(jsonPath, 'utf8'))

  const snap  = await getDocs(collection(db, COLLECTIONS.LOJAS))
  const lojas = snap.docs.map(d => ({ id: d.id, data: d.data() }))
  console.log(`Encontradas ${lojas.length} lojas no Firestore.\n`)

  let atualizados   = 0
  let naoEncontrados = 0

  for (const item of itens) {
    const loja = resolverLoja(lojas, item)

    if (!loja) {
      console.log(`✗ Loja ${item.loja} não encontrada`)
      naoEncontrados++
      continue
    }

    await updateDoc(doc(db, COLLECTIONS.LOJAS, loja.id), { responsavel: item.responsavel })
    console.log(`✓ Loja ${loja.data.nome ?? item.loja} → responsável: ${item.responsavel}`)
    atualizados++
  }

  console.log(`\n${atualizados} atualizados, ${naoEncontrados} não encontrados`)
  process.exit(0)
}

main().catch(err => {
  console.error('\n✗ Erro:', err.code ?? '', err.message ?? err)
  process.exit(1)
})
