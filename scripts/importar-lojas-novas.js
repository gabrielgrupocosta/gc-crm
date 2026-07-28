// Cria no Firestore as lojas listadas em scripts/data/lojas-novas.json — clientes que já têm
// responsável identificado (via scripts/atualizar-clientes.js) mas nenhum documento em `lojas/`
// correspondente. Criadas sem `gestorId` (fica em branco até alguém atribuir um gestor pela
// tela /lojas — até lá, a loja só aparece pro admin, nenhum gestor consegue vê-la).
//
// Uso:
//   node scripts/importar-lojas-novas.js <email-admin> <senha-admin> [caminho-do-json]
//
// Se nenhum caminho de JSON for informado, usa scripts/data/lojas-novas.json.

import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join, resolve } from 'path'
import { signInWithEmailAndPassword } from 'firebase/auth'
import {
  db, COLLECTIONS, auth,
  collection, getDocs, addDoc, serverTimestamp,
} from '../src/services/firebase.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function main() {
  const [, , email, password, jsonArg] = process.argv

  if (!email || !password) {
    console.error('Uso: node scripts/importar-lojas-novas.js <email-admin> <senha-admin> [caminho-do-json]')
    process.exit(1)
  }

  const jsonPath = jsonArg
    ? resolve(jsonArg)
    : join(__dirname, 'data', 'lojas-novas.json')

  if (!existsSync(jsonPath)) {
    console.error(`Arquivo não encontrado: ${jsonPath}`)
    process.exit(1)
  }

  console.log('Autenticando...')
  await signInWithEmailAndPassword(auth, email, password)
  console.log('✓ Autenticado\n')

  const itens = JSON.parse(readFileSync(jsonPath, 'utf8'))

  const snap = await getDocs(collection(db, COLLECTIONS.LOJAS))
  const nomesExistentes = new Set(snap.docs.map(d => (d.data().nome ?? '').trim().toLowerCase()))

  let criadas   = 0
  let puladas   = 0

  for (const item of itens) {
    const chave = item.nome.trim().toLowerCase()

    if (nomesExistentes.has(chave)) {
      console.log(`✗ Loja ${item.nome} já existe — pulando`)
      puladas++
      continue
    }

    await addDoc(collection(db, COLLECTIONS.LOJAS), {
      nome:            item.nome,
      responsavel:     item.responsavel,
      idGrupoWhatsapp: item.idGrupoWhatsapp,
      clienteId:       item.clienteId,
      gestorId:        item.gestorId,
      plataforma:      item.plataforma,
      segmento:        item.segmento,
      status:          item.status,
      dataInicio:      item.dataInicio,
      observacoes:     item.observacoes,
      criadoEm:        serverTimestamp(),
    })

    console.log(`✓ Loja ${item.nome} criada (sem gestor)`)
    nomesExistentes.add(chave)
    criadas++
  }

  console.log(`\n${criadas} criadas, ${puladas} já existiam`)
  process.exit(0)
}

main().catch(err => {
  console.error('\n✗ Erro:', err.code ?? '', err.message ?? err)
  process.exit(1)
})
