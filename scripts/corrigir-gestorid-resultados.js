// Corrige resultados de "Bellato Lanches" e "Açaí Whats" lançados pelo usuário master
// (via ModalLancamentoRapido no Dashboard) que gravaram gestorId = uid do master em vez
// de loja.gestorId, e sem organizacaoId — por isso não apareciam como "preenchido" na
// visão do gestor real (Jhone Kuster) no Controle Semanal. Também finaliza esses
// registros (relatorioEnviado: true), já que os dados foram de fato preenchidos.
//
// Não deleta nada — só corrige campos via updateDoc nos documentos afetados.
//
// Uso:
//   node scripts/corrigir-gestorid-resultados.js <email-admin> <senha-admin>

import { signInWithEmailAndPassword, getIdTokenResult } from 'firebase/auth'
import {
  db, COLLECTIONS, auth,
  collection, getDocs, doc, updateDoc, query, where,
} from '../src/services/firebase.js'

// firestore.rules exige where('organizacaoId', '==', ...) pra listar /lojas
// sem ser master — mesmaOrg(resource.data) não é suficiente pra liberar uma
// query sem filtro, só reads de doc único. Sem esse escopo o getDocs falha
// com permission-denied pra admin_org, mesmo que todas as lojas retornadas
// pertencessem à própria organização dele.

const NOMES_ALVO = ['bellato lanches', 'acai whats', 'açaí whats']

function normalizar(s) {
  return (s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

async function main() {
  const [, , email, password] = process.argv
  if (!email || !password) {
    console.error('Uso: node scripts/corrigir-gestorid-resultados.js <email-admin> <senha-admin>')
    process.exit(1)
  }

  console.log('Autenticando...')
  const cred = await signInWithEmailAndPassword(auth, email, password)
  const token = await getIdTokenResult(cred.user)
  const role = token.claims.role
  const organizacaoId = token.claims.organizacaoId
  console.log(`✓ Autenticado (role: ${role}${organizacaoId ? `, org: ${organizacaoId}` : ''})\n`)

  if (role !== 'master' && !organizacaoId) {
    console.error('Usuário não é master e não tem organizacaoId no token. Abortando.')
    process.exit(1)
  }

  // firestore.rules só libera list/getDocs sem where de organizacaoId pra
  // master — pra admin_org é preciso escopar a query, senão vem permission-denied.
  const escopoLojas = role === 'master' ? [] : [where('organizacaoId', '==', organizacaoId)]
  const lojasSnap = await getDocs(query(collection(db, COLLECTIONS.LOJAS), ...escopoLojas))
  const lojasAlvo = lojasSnap.docs
    .map(d => ({ id: d.id, data: d.data() }))
    .filter(l => NOMES_ALVO.includes(normalizar(l.data.nome)))

  if (lojasAlvo.length === 0) {
    console.error('Nenhuma loja encontrada com os nomes esperados. Abortando.')
    process.exit(1)
  }

  console.log(`Lojas encontradas: ${lojasAlvo.map(l => l.data.nome).join(', ')}\n`)

  let corrigidos = 0

  for (const loja of lojasAlvo) {
    if (!loja.data.gestorId) {
      console.log(`! ${loja.data.nome} (id ${loja.id}): sem gestorId na própria loja — pulando (provavelmente loja de outra organização com nome coincidente)`)
      continue
    }

    const escopoResultados = role === 'master' ? [] : [where('organizacaoId', '==', organizacaoId)]
    const resSnap = await getDocs(query(
      collection(db, COLLECTIONS.RESULTADOS),
      where('lojaId', '==', loja.id),
      ...escopoResultados,
    ))

    for (const d of resSnap.docs) {
      const dados = d.data()
      const patch = {}

      if (dados.gestorId !== loja.data.gestorId) patch.gestorId = loja.data.gestorId
      if (!dados.organizacaoId && loja.data.organizacaoId) patch.organizacaoId = loja.data.organizacaoId
      if (!dados.relatorioEnviado) patch.relatorioEnviado = true

      if (Object.keys(patch).length === 0) {
        console.log(`- ${loja.data.nome} / semana ${dados.semana}: já estava correto`)
        continue
      }

      await updateDoc(doc(db, COLLECTIONS.RESULTADOS, d.id), patch)
      console.log(`✓ ${loja.data.nome} / semana ${dados.semana}: ${JSON.stringify(patch)}`)
      corrigidos++
    }
  }

  console.log(`\n${corrigidos} documento(s) de resultado corrigido(s).`)

  if (corrigidos === 0 && role !== 'master') {
    console.log(
      '\nAviso: se os resultados-alvo foram gravados sem organizacaoId (o bug original),\n' +
      'o filtro where(organizacaoId==...) exigido pelas rules pra admin_org também os\n' +
      'esconde da query — nesse caso só uma conta master consegue ler e corrigir esses\n' +
      'documentos específicos. Rode de novo com credenciais de um usuário master.'
    )
  }

  process.exit(0)
}

main().catch(err => {
  console.error('\n✗ Erro:', err.code ?? '', err.message ?? err)
  process.exit(1)
})
