// Importa gestores e lojas a partir de um export de grupos de WhatsApp (JSON) para o Firestore.
//
// Uso:
//   node scripts/importar-cadastro.js <email-admin> <senha-admin> [caminho-do-json]
//
// O e-mail/senha precisam ser de uma conta admin já cadastrada em `users/` — as regras do
// Firestore exigem um usuário autenticado com perfil admin para criar/editar gestores e lojas.
// Se nenhum caminho de JSON for informado, usa scripts/data/cadastro-exportado.json.

import { readFileSync, existsSync } from 'fs'
import { fileURLToPath, pathToFileURL } from 'url'
import { dirname, join, resolve } from 'path'
import { signInWithEmailAndPassword } from 'firebase/auth'
import {
  db, COLLECTIONS, auth,
  doc, getDoc, setDoc, updateDoc,
  serverTimestamp,
} from '../src/services/firebase.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─── Normalização do dia de relatório (formato do JSON → formato usado pelo app) ──────────────

const DIA_MAP = {
  segunda: 'segunda',
  terça:   'terca',
  terca:   'terca',
  quarta:  'quarta',
  quinta:  'quinta',
  sexta:   'sexta',
  sábado:  'sabado',
  sabado:  'sabado',
}

function normalizarDia(dia) {
  if (!dia) return null
  return DIA_MAP[dia.toLowerCase().trim()] ?? null
}

// ─── Extração do nome real da loja a partir do nome do grupo do WhatsApp ───────────────────────
//
// O nome do grupo segue (com variações) o padrão:
//   "<prefixo> - <número(s)> - Gestão iFood[/99/Keeta] - <nome da loja> (<dia da semana>)"
// mas o nome da loja pode vir antes OU depois do bloco "Gestão iFood...", a plataforma pode
// aparecer em maiúsc/minúsc, com "e"/"&"/"/"/"," entre plataformas, e o dia da semana pode vir
// entre parênteses ou solto no final (às vezes com erro de digitação, ex: "Quintal-feira").

const DIA_RAIZ        = /(segund|terç|terc|quart|quint|sext|s[aá]bad)/i
const DIA_FINAL_SOLTO = /(?:^|[\s\-•|])(?:segund|terç|terc|quart|quint|sext|s[aá]bad)[a-zçã]*(?:-feira)?\.?\s*$/i

function limparEspacos(s) {
  return s.replace(/[⁠​﻿]/g, '').replace(/\s+/g, ' ').trim()
}

function removerEmojis(s) {
  return s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2B50}]/gu, '')
}

function removerDiaFinal(s) {
  let out = s
  for (let i = 0; i < 3; i++) {
    const antes = out
    out = out.replace(/\s*\([^)]*\)\s*\.?\s*$/i, m => (DIA_RAIZ.test(m) ? '' : m))
    out = out.replace(/\s*\(\s*\d+\s*lojas?\s*\)\s*$/i, '')
    out = out.replace(DIA_FINAL_SOLTO, '')
    out = out.trim()
    if (out === antes) break
  }
  return out
}

function limparSeparadoresBordas(s) {
  return s.replace(/^[\s\-•|:.,]+/, '').replace(/[\s\-•|:.,]+$/, '').trim()
}

function removerPrefixoCodigo(s) {
  // Ex: "VI - 159 -", "W - 146-", "MF - 266•", "J -", "J• 358 |" (letras do gestor + número(s) + separador)
  // O separador pode vir colado direto nas letras do prefixo, sem espaço antes (ex: "J•"),
  // então o slot de separador logo após as letras é opcional e independente do `-{0,3}` —
  // sem ele, um bullet/traço colado ali era consumido como se fosse o separador FINAL,
  // deixando o número do grupo (e o separador seguinte) sem ser removido.
  return s.replace(/^\s*[A-Za-zÀ-ÿ]{1,4}\s*[-•|.]?\s*-{0,3}\s*(?:\d+[\d\saeé/\-]*)?\s*[-•|.]\s*/, '')
}

const GESTAO_RE = /gest[ãa]o\s*(?:de\s*)?(?:\d+\s*(?:lojas?)?\s*)?(?:i\s*food|99\s*food|99|keeta)?(?:\s*(?:e|&|\/|,)\s*(?:i\s*food|99\s*food|99|keeta))*\s*/i

export function extrairNomeLoja(nomeGrupo) {
  let s = limparEspacos(removerEmojis(nomeGrupo))
  s = limparEspacos(removerDiaFinal(s))

  const m = s.match(GESTAO_RE)
  let antes = '', depois = ''
  if (m) {
    antes  = s.slice(0, m.index)
    depois = s.slice(m.index + m[0].length)
  } else {
    antes = s
  }

  antes  = limparSeparadoresBordas(removerPrefixoCodigo(antes))
  depois = limparSeparadoresBordas(depois)

  const nome = depois || antes || limparSeparadoresBordas(removerPrefixoCodigo(s))
  return limparEspacos(nome)
}

// ─── Import ─────────────────────────────────────────────────────────────────────────────────

async function main() {
  const [, , email, password, jsonArg] = process.argv

  if (!email || !password) {
    console.error('Uso: node scripts/importar-cadastro.js <email-admin> <senha-admin> [caminho-do-json]')
    process.exit(1)
  }

  const jsonPath = jsonArg
    ? resolve(jsonArg)
    : join(__dirname, 'data', 'cadastro-exportado.json')

  if (!existsSync(jsonPath)) {
    console.error(`Arquivo não encontrado: ${jsonPath}`)
    process.exit(1)
  }

  console.log('Autenticando...')
  await signInWithEmailAndPassword(auth, email, password)
  console.log('✓ Autenticado\n')

  const { gestores = [], lojas = [] } = JSON.parse(readFileSync(jsonPath, 'utf8'))

  // ── Passo 1: gestores ─────────────────────────────────────────────────────────────────────

  const gestorIdPorNome = {}
  let gestoresImportados = 0

  for (const g of gestores) {
    const lojaDoGestor = lojas.find(l => l.gestorNome === g.nome)
    const prefixo = lojaDoGestor?.gestorPrefixo
    if (!prefixo) {
      console.warn(`⚠ Gestor "${g.nome}" sem loja associada — não foi possível determinar o prefixo. Pulando.`)
      continue
    }

    console.log(`Importando gestor ${g.nome}...`)
    const ref  = doc(db, COLLECTIONS.USERS, prefixo)
    const snap = await getDoc(ref)

    if (snap.exists()) {
      // Preserva e-mail já preenchido manualmente (não sobrescreve com vazio num re-import).
      await updateDoc(ref, {
        nome:     g.nome,
        perfil:   'gestor',
        telefone: g.telefones?.[0] ?? '',
        prefixo,
      })
    } else {
      await setDoc(ref, {
        nome:     g.nome,
        email:    '',
        perfil:   'gestor',
        status:   'ativo',
        telefone: g.telefones?.[0] ?? '',
        prefixo,
        criadoEm: serverTimestamp(),
      })
    }

    gestorIdPorNome[g.nome] = prefixo
    gestoresImportados++
  }

  // ── Passo 2: lojas ────────────────────────────────────────────────────────────────────────

  let lojasImportadas = 0

  for (const l of lojas) {
    const nome = extrairNomeLoja(l.nome)
    console.log(`Importando loja ${nome}...`)

    const ref  = doc(db, COLLECTIONS.LOJAS, l.groupId)
    const snap = await getDoc(ref)

    const payloadBase = {
      nome,
      nomeGrupoOriginal: l.nome,
      gestorNome:        l.gestorNome,
      plataforma:        l.plataforma ?? '',
      plataformas:       l.plataformas ?? [],
      diaRelatorio:      normalizarDia(l.diaRelatorio),
      whatsappGroupId:   l.groupId,
    }

    if (snap.exists()) {
      // gestorId não é tocado aqui — é resolvido/preservado no passo 3.
      await updateDoc(ref, payloadBase)
    } else {
      await setDoc(ref, {
        ...payloadBase,
        gestorId: '',
        status:   'ativa',
        segmento: '',
        criadoEm: serverTimestamp(),
      })
    }

    lojasImportadas++
  }

  // ── Passo 3: vincula gestorId pelo gestorNome ────────────────────────────────────────────

  console.log('\nVinculando gestorId...')
  let lojasVinculadas = 0

  for (const l of lojas) {
    const ref  = doc(db, COLLECTIONS.LOJAS, l.groupId)
    const snap = await getDoc(ref)
    if (!snap.exists()) continue

    const gestorIdAtual = snap.data().gestorId
    const gestorId       = gestorIdPorNome[l.gestorNome]

    if (!gestorIdAtual && gestorId) {
      await updateDoc(ref, { gestorId })
      lojasVinculadas++
    }
  }

  console.log(`\n${gestoresImportados} gestores importados, ${lojasImportadas} lojas importadas, ${lojasVinculadas} lojas vinculadas`)
  process.exit(0)
}

const executadoDiretamente = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (executadoDiretamente) {
  main().catch(err => {
    console.error('\n✗ Erro na importação:', err.code ?? '', err.message ?? err)
    process.exit(1)
  })
}
