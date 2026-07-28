const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { onDocumentWritten } = require('firebase-functions/v2/firestore')
const { onSchedule } = require('firebase-functions/v2/scheduler')
const { defineSecret } = require('firebase-functions/params')
const { GoogleGenAI } = require('@google/genai')
const Anthropic = require('@anthropic-ai/sdk')
const fs = require('fs')
const path = require('path')
const { initializeApp } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore')

initializeApp()
const auth = getAuth()
const db = getFirestore()

const ROLES_VALIDOS = ['master', 'admin_org', 'gestor']

// Garante que quem chama é master — usado nas funções de administração
// de contas, que só fazem sentido para quem gerencia a plataforma inteira.
function exigirSuperAdmin(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário')
  if (request.auth.token.role !== 'master') {
    throw new HttpsError('permission-denied', 'Apenas master pode executar esta ação')
  }
}

// Garante que quem chama é admin_org da MESMA organização informada, ou master —
// usado na criação de gestor, que é uma ação do dono da organização sobre a própria org.
function exigirAdminDaOrg(request, organizacaoId) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário')
  const { role, organizacaoId: orgDoToken } = request.auth.token
  if (role === 'master') return
  if (role === 'admin_org' && orgDoToken === organizacaoId) return
  throw new HttpsError('permission-denied', 'Sem permissão para gerenciar usuários desta organização')
}

// Traduz erros conhecidos do Firebase Auth pra HttpsError com mensagem clara —
// sem isso, o client só via um "internal" genérico (ex: e-mail duplicado virava
// um erro opaco "INTERNAL" sem dizer qual era o problema real).
const AUTH_ERROS_CRIACAO = {
  'auth/email-already-exists': ['already-exists', 'Este e-mail já está cadastrado em outra conta.'],
  'auth/invalid-email':        ['invalid-argument', 'E-mail inválido.'],
  'auth/invalid-password':     ['invalid-argument', 'A senha precisa ter ao menos 6 caracteres.'],
}

// Cria a conta no Firebase Auth + custom claims + doc em users/{uid}.
// role e organizacaoId (null para master) viram claim imediatamente —
// o próprio doc em users/ é a fonte de verdade "de leitura fácil" (nome, etc),
// mas quem decide acesso via Security Rules é sempre o claim do token.
async function criarConta({ email, senha, nome, role, organizacaoId }) {
  let userRecord
  try {
    userRecord = await auth.createUser({ email, password: senha, displayName: nome })
  } catch (err) {
    const [code, mensagem] = AUTH_ERROS_CRIACAO[err.code] ?? ['internal', 'Erro ao criar a conta. Tente novamente.']
    throw new HttpsError(code, mensagem)
  }
  await auth.setCustomUserClaims(userRecord.uid, { role, organizacaoId: organizacaoId ?? null })
  await db.collection('users').doc(userRecord.uid).set({
    nome,
    email,
    role,
    organizacaoId: organizacaoId ?? null,
    status: 'ativo',
    criadoEm: FieldValue.serverTimestamp(),
  })
  return { uid: userRecord.uid }
}

exports.criarSuperAdmin = onCall(async (request) => {
  exigirSuperAdmin(request)
  const { email, senha, nome } = request.data || {}
  if (!email || !senha || !nome) throw new HttpsError('invalid-argument', 'email, senha e nome são obrigatórios')
  return criarConta({ email, senha, nome, role: 'master', organizacaoId: null })
})

exports.criarAdminOrg = onCall(async (request) => {
  exigirSuperAdmin(request)
  const { email, senha, nome, organizacaoId } = request.data || {}
  if (!email || !senha || !nome || !organizacaoId) {
    throw new HttpsError('invalid-argument', 'email, senha, nome e organizacaoId são obrigatórios')
  }
  const org = await db.collection('organizacoes').doc(organizacaoId).get()
  if (!org.exists) throw new HttpsError('not-found', 'Organização não encontrada')
  return criarConta({ email, senha, nome, role: 'admin_org', organizacaoId })
})

exports.criarGestor = onCall(async (request) => {
  const { email, senha, nome, organizacaoId } = request.data || {}
  if (!email || !senha || !nome || !organizacaoId) {
    throw new HttpsError('invalid-argument', 'email, senha, nome e organizacaoId são obrigatórios')
  }
  exigirAdminDaOrg(request, organizacaoId)
  return criarConta({ email, senha, nome, role: 'gestor', organizacaoId })
})

// Exclui a conta de um gestor por completo (Firebase Auth + doc em users/{uid})
// via privilégio de admin — não depende mais de conhecer a senha do gestor pra
// revogar o acesso no Auth. Sem isso, a única forma de remover o acesso sem
// saber a senha era "desativar" o cadastro no Firestore, o que podia deixar
// a conta do Auth órfã (existindo, mas sem doc correspondente) caso alguém
// removesse o doc por fora sem passar pela function.
exports.excluirGestor = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário')
  const { gestorUid } = request.data || {}
  if (!gestorUid) throw new HttpsError('invalid-argument', 'gestorUid é obrigatório')

  const gestorDoc = await db.collection('users').doc(gestorUid).get()
  if (!gestorDoc.exists) throw new HttpsError('not-found', 'Gestor não encontrado')
  const gestorData = gestorDoc.data()
  if (gestorData.role !== 'gestor') {
    throw new HttpsError('failed-precondition', 'Esta função só exclui contas de gestor')
  }

  exigirAdminDaOrg(request, gestorData.organizacaoId)

  try {
    await auth.deleteUser(gestorUid)
  } catch (err) {
    // Conta já não existia no Auth (ex: exclusão anterior parcial) — segue e
    // limpa o Firestore mesmo assim, em vez de travar numa conta já órfã.
    if (err.code !== 'auth/user-not-found') throw err
  }
  await db.collection('users').doc(gestorUid).delete()

  return { ok: true }
})

// Mantém o custom claim sincronizado com o doc em users/{uid}: sempre que role
// ou organizacaoId mudarem no Firestore (ex: promoção, transferência de org),
// o claim é atualizado — sem isso, o token continuaria com o papel antigo até
// expirar. O client ainda precisa forçar um refresh (getIdToken(true)) para
// enxergar o novo claim numa sessão já aberta.
exports.sincronizarClaimsUsuario = onDocumentWritten('users/{userId}', async (event) => {
  const depois = event.data?.after?.data()
  if (!depois) return // documento deletado — claims da conta ficam órfãos, tratar exclusão de Auth à parte

  const { role, organizacaoId } = depois
  if (!ROLES_VALIDOS.includes(role)) {
    console.error(`[sincronizarClaimsUsuario] role inválida para ${event.params.userId}: ${role}`)
    return
  }

  await auth.setCustomUserClaims(event.params.userId, { role, organizacaoId: organizacaoId ?? null })
})

// Definido via `firebase functions:secrets:set GEMINI_API_KEY` — nunca em texto plano no código.
const geminiApiKey = defineSecret('GEMINI_API_KEY')

// Definido via `firebase functions:secrets:set ANTHROPIC_API_KEY` — nunca em texto plano no código.
const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY')

// gemini-2.0-flash foi desligado em 01/06/2026 e gemini-2.5-flash não está mais
// disponível para chaves de API novas (ambos retornam 404) — gemini-3.5-flash é
// a substituição direta recomendada pelo Google, já em disponibilidade geral (GA).
const MODEL = 'gemini-3.5-flash'

// Extrai o base64 e o mimeType de uma data URL (ex: "data:image/png;base64,AAA...").
// Os prints chegam do front já como data URL — aceita tanto PNG quanto JPEG.
function parseDataUrl(dataUrl) {
  const match = /^data:(image\/\w+);base64,(.+)$/.exec(dataUrl || '')
  if (!match) return null
  return { mimeType: match[1], data: match[2] }
}

// Chama generateContent com retry/backoff pros erros transitórios do Gemini —
// 429 (cota estourada) e 503 (modelo sobrecarregado) costumam se resolver
// sozinhos em poucos segundos. Sem isso, esses erros chegavam ao front como
// falha imediata mesmo sendo, na maioria das vezes, só um pico passageiro.
async function generateContentComRetry(ai, params, { tentativas = 3, delayBaseMs = 2000 } = {}) {
  let ultimoErro
  for (let tentativa = 0; tentativa < tentativas; tentativa++) {
    try {
      return await ai.models.generateContent(params)
    } catch (err) {
      ultimoErro = err
      const status = err?.status
      const transitorio = status === 429 || status === 503
      if (!transitorio || tentativa === tentativas - 1) throw err
      const espera = delayBaseMs * 2 ** tentativa
      console.warn(`[generateContentComRetry] tentativa ${tentativa + 1}/${tentativas} falhou (status ${status}) — nova tentativa em ${espera}ms`)
      await new Promise(resolve => setTimeout(resolve, espera))
    }
  }
  throw ultimoErro
}

// Traduz erros do Gemini (429/503/outros) pra HttpsError com mensagem clara
// pro gestor, em vez do erro cru do SDK virar um "Unhandled error" no log e
// um erro genérico "internal" pro front.
function tratarErroGemini(err) {
  console.error('[Gemini]', err)
  const status = err?.status
  if (status === 429) {
    throw new HttpsError('resource-exhausted', 'Limite de requisições do Gemini atingido no momento. Tente novamente em alguns segundos.')
  }
  if (status === 503) {
    throw new HttpsError('unavailable', 'O Gemini está sobrecarregado no momento. Tente novamente em instantes.')
  }
  throw new HttpsError('internal', 'Falha ao processar a imagem com o Gemini: ' + (err?.message ?? 'erro desconhecido'))
}

// Conhecimento de domínio da Delivery Elite sobre o algoritmo/métricas do
// iFood — injetado no prompt do gerarResumoRelatorio pra análise consistente.
const CONHECIMENTO_IFOOD = `
MÉTRICAS DE REFERÊNCIA DO IFOOD:
- Taxa de cancelamento: máximo 1% — acima disso impacta negativamente a visibilidade e as vendas
- Taxa de chamados (reclamações sobre atraso, item faltando ou item errado): máximo 2,5% — acima disso prejudica reputação e visibilidade orgânica
- Avaliação mínima saudável: 4,7
- Tempo de loja aberta: mínimo 95% do horário cadastrado — abaixo disso reduz o posicionamento

IMPACTO DAS MÉTRICAS:
- Cancelamentos COM responsabilidade da loja (atraso, item errado, item faltando): prejudicam diretamente o algoritmo
- Cancelamentos sem responsabilidade da loja (endereço errado, cliente desistiu): NÃO prejudicam a loja
- Chamados COM impacto no Selo Super: prejudicam visibilidade
- Chamados SEM impacto no Selo Super: não afetam visibilidade diretamente — não alertar como crítico
- Pausas frequentes penalizam o posicionamento da loja no algoritmo

CAUSAS COMUNS DE QUEDA DE VENDAS:
- Aumento de preço recente: o iFood compara preços históricos e o cliente percebe a diferença na conversão
- Itens pausados no top de vendas reduzem diretamente o volume
- Pausas programadas prejudicam o posicionamento
- Mudanças no cardápio sem adaptação do cliente
- Sazonalidade e contexto externo (feriados, clima, eventos)

ALAVANCAS DO IFOOD (ordem de prioridade):
1. Frete grátis — mais de 80% dos pedidos saem com frete grátis
2. HITS — frete subsidiado pelo iFood
3. Cupom do Clube iFood — clientes premium que pedem 2-3x mais
4. Campanha Inteligente (CI) — R$5 de desconto por pedido
`

exports.gerarResumoRelatorio = onCall({ secrets: [geminiApiKey], timeoutSeconds: 60, memory: '256MiB' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário')

  const {
    nomeLoja, semana, plataforma, faturamento, variacao,
    cancelamento, chamados, tempoLoja, contextoGestor, prints,
  } = request.data || {}

  if (!nomeLoja || !semana) {
    throw new HttpsError('invalid-argument', 'Dados da loja/semana ausentes')
  }

  const ai = new GoogleGenAI({ apiKey: geminiApiKey.value() })

  const imageParts = []
  for (const key of ['desempenho', 'financeiro', 'operacao']) {
    const parsed = parseDataUrl(prints?.[key])
    if (parsed) imageParts.push({ inlineData: parsed })
  }

  const prompt = `Você é um analista especializado em gestão de delivery da empresa Delivery Elite, com profundo conhecimento do algoritmo e métricas do iFood.

${CONHECIMENTO_IFOOD}

Analise os dados e prints fornecidos e gere um relatório semanal profissional em português para ser enviado diretamente ao dono da loja via WhatsApp. O texto deve estar PRONTO para envio — sem avisos de validação, sem "recomenda-se confirmar", sem "verifique antes de enviar".

DADOS DA SEMANA:
- Loja: ${nomeLoja}
- Plataforma: ${plataforma}
- Período: ${semana}
- Faturamento: R$ ${faturamento}
- Variação vs semana anterior: ${variacao}%
- Taxa de cancelamento: ${cancelamento}%
- Chamados: ${chamados}%
- Tempo de loja aberta: ${tempoLoja}%
${contextoGestor ? `- Contexto do gestor: ${contextoGestor}` : ''}

REGRAS DE ANÁLISE — SIGA RIGOROSAMENTE:
1. Variação positiva: pontue o crescimento com entusiasmo controlado, cite o contexto do gestor se disponível como fator contribuinte
2. Variação negativa: analise de forma construtiva usando o contexto do gestor para explicar a causa — nunca só "as vendas caíram"
3. Cancelamento > 1%: alerte que impacta a visibilidade e vendas — apenas se for cancelamento por responsabilidade da loja
4. Chamados > 2,5%: alerte que prejudica reputação e visibilidade orgânica
5. Chamados SEM impacto no Selo Super: NÃO alerte como crítico — mencione apenas como ponto de atenção leve
6. Métricas dentro dos limites: pontue como positivo explicitamente
7. Use os prints para extrair dados adicionais e enriquecer a análise
8. Contexto do gestor é PRIORIDADE — se informou algo (ex: "faltou motoboy", "ajustou preço"), isso deve ser a explicação central da análise

LINGUAGEM — OBRIGATÓRIO:
- Tom direto, como um gestor experiente falando com o dono da loja
- NUNCA use: "A performance de X", "Registramos", "Observamos", "Recomenda-se"
- USE: o nome da loja diretamente, "teve", "fechou a semana", "vale acompanhar"
- Sem corporativês, sem relatório formal — é uma mensagem de WhatsApp profissional

FORMATO OBRIGATÓRIO:
**📊 Análise Semanal – [Nome da Loja]**
_Período: [período]_

**1️⃣ Vendas**
[dados + análise contextualizada]

**2️⃣ Cancelamentos e Atendimento**
[apenas se houver dados dos prints ou métricas preenchidas — omitir seção se não houver dados]

**3️⃣ Operação**
[tempo aberto e outros dados operacionais dos prints]

**4️⃣ Campanhas e Cupons** (omitir se não houver nos prints)
[dados de campanhas]

**5️⃣ Funil de Vendas** (omitir se não houver nos prints)
[dados do funil com análise de conversão]

---
**Resumo geral:** [parágrafo final com análise consolidada, causa da variação baseada no contexto, e perspectiva para próxima semana]

Use ✅ para positivo e ⚠️ para atenção. Máximo 400 palavras. Omita seções que não tiverem dados.`

  let response
  try {
    response = await generateContentComRetry(ai, {
      model: MODEL,
      contents: [{ text: prompt }, ...imageParts],
    })
  } catch (err) {
    tratarErroGemini(err)
  }

  return { resumo: response.text }
})

// Schema dos dados numéricos extraídos dos prints — `nullable: true` cobre os
// casos em que o dado não aparece na imagem (ex: loja sem campanha ativa).
const NUMERO_OU_NULO = { type: 'number', nullable: true }

// Cada tipo de print só cobre um subconjunto de campos — evita pedir ao Gemini
// dados que aquele print específico não tem como mostrar.
const SCHEMAS_POR_TIPO = {
  desempenho: {
    type: 'object',
    properties: {
      faturamento:   NUMERO_OU_NULO,
      variacao:      NUMERO_OU_NULO,
      totalVendas:   NUMERO_OU_NULO,
      ticketMedio:   NUMERO_OU_NULO,
      clientesNovos: NUMERO_OU_NULO,
    },
    required: ['faturamento', 'variacao', 'totalVendas', 'ticketMedio', 'clientesNovos'],
  },
  financeiro: {
    type: 'object',
    properties: {
      faturamento: NUMERO_OU_NULO,
      variacao:    NUMERO_OU_NULO,
      ticketMedio: NUMERO_OU_NULO,
      totalVendas: NUMERO_OU_NULO,
    },
    required: ['faturamento', 'variacao', 'ticketMedio', 'totalVendas'],
  },
  operacao: {
    type: 'object',
    properties: {
      cancelamento: NUMERO_OU_NULO,
      chamados:     NUMERO_OU_NULO,
      tempoLoja:    NUMERO_OU_NULO,
    },
    required: ['cancelamento', 'chamados', 'tempoLoja'],
  },
}

const PROMPTS_POR_TIPO = {
  desempenho: 'Analise este print de desempenho do iFood/99Food/Keeta e extraia: faturamento, variação (número com sinal, ex: -8.54 ou 12.3), total de vendas (número de pedidos), ticket médio e clientes novos. Se um dado não aparecer no print, retorne null para ele. Apenas números, sem símbolos R$ ou %.',
  financeiro: 'Analise este print financeiro do iFood/99Food/Keeta e extraia: faturamento, variação (número com sinal, ex: -8.54 ou 12.3), ticket médio e total de vendas (número de pedidos). Se um dado não aparecer no print, retorne null para ele. Apenas números, sem símbolos R$ ou %.',
  operacao: 'Analise este print de operação do iFood/99Food/Keeta e extraia: taxa de cancelamento (%), taxa de chamados (%) e tempo de loja aberta (%). Se um dado não aparecer no print, retorne null para ele. Apenas números, sem símbolo %.',
}

// Processa UM print por vez — usado pelo front pra disparar os 3 prints em
// paralelo (Promise.all) e atualizar os campos de cada um assim que aquele
// print específico terminar, sem esperar os outros.
exports.extrairPrintIndividual = onCall({ secrets: [geminiApiKey], timeoutSeconds: 30, memory: '256MiB' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário')

  const { print, tipoPrint } = request.data || {}

  const schema = SCHEMAS_POR_TIPO[tipoPrint]
  const promptBase = PROMPTS_POR_TIPO[tipoPrint]
  if (!schema || !promptBase) {
    throw new HttpsError('invalid-argument', 'tipoPrint inválido — use desempenho, financeiro ou operacao')
  }

  const parsed = parseDataUrl(print)
  if (!parsed) {
    throw new HttpsError('invalid-argument', 'Print inválido')
  }

  const ai = new GoogleGenAI({ apiKey: geminiApiKey.value() })

  let response
  try {
    response = await generateContentComRetry(ai, {
      model: MODEL,
      contents: [{ text: promptBase }, { inlineData: parsed }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    })
  } catch (err) {
    tratarErroGemini(err)
  }

  let dados
  try {
    dados = JSON.parse(response.text)
  } catch (err) {
    throw new HttpsError('internal', 'Não foi possível interpretar os dados extraídos')
  }

  return { dados }
})

// Corte de faturamento: tudo cadastrado até dia 25 (23:59:59, horário de Brasília)
// entra na fatura do mês corrente; roda às 3h do dia 26 pra garantir que o dia 25
// já fechou completamente antes do corte, mesmo com pequena variação de clock.
exports.gerarFaturasMensais = onSchedule(
  { schedule: '0 3 26 * *', timeZone: 'America/Sao_Paulo' },
  async () => {
    const agora = new Date()
    // Dia 26 rodando para o mês corrente => corte é o dia 25 do mesmo mês corrente.
    const corte = new Date(agora.getFullYear(), agora.getMonth(), 25, 23, 59, 59, 999)
    const periodo = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`

    const precificacaoSnap = await db.collection('configuracoes').doc('precificacao').get()
    const valorPadraoGlobal = precificacaoSnap.data()?.valorPadraoPorLoja ?? 0

    const orgsSnap = await db.collection('organizacoes')
      .where('status', 'in', ['ativo', 'inadimplente'])
      .get()

    for (const orgDoc of orgsSnap.docs) {
      const organizacaoId = orgDoc.id
      const org = orgDoc.data()

      const faturaId = `${organizacaoId}_${periodo}`
      const faturaExistente = await db.collection('faturas').doc(faturaId).get()
      if (faturaExistente.exists) {
        console.log(`[gerarFaturasMensais] fatura ${faturaId} já existe — pulando`)
        continue
      }

      const lojasSnap = await db.collection('lojas')
        .where('organizacaoId', '==', organizacaoId)
        .where('dataCadastro', '<=', Timestamp.fromDate(corte))
        .get()

      if (lojasSnap.empty) continue

      const itens = lojasSnap.docs.map((lojaDoc) => {
        const loja = lojaDoc.data()
        const valorAplicado = loja.valorCustomizado ?? org.valorPorLoja ?? valorPadraoGlobal
        return { lojaId: lojaDoc.id, nome: loja.nome ?? '', valorAplicado }
      })

      const valorTotal = itens.reduce((soma, item) => soma + item.valorAplicado, 0)

      await db.collection('faturas').doc(faturaId).set({
        organizacaoId,
        periodo,
        status: 'pendente',
        itens,
        valorTotal,
        geradaEm: FieldValue.serverTimestamp(),
      })
    }
  }
)

// ─── Financeiro: geração automática de cobranças por ciclo de contrato ────────
// Cada contrato (mensal ou semanal) gera uma "cobrança" por ciclo, com uma
// parcela única de 100% no dia do ciclo — o admin pode depois abrir a
// cobrança na tela Financeiro e dividir em parcelas (ex: 50/50 em 15 dias).

const MESES_LABEL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

// Clampa o dia no último dia do mês quando o mês não tiver esse dia (ex:
// contrato começado dia 31 → fevereiro vira dia 28/29).
function diaSeguroDoMes(ano, mes, dia) {
  const ultimoDia = new Date(ano, mes + 1, 0).getDate()
  return new Date(ano, mes, Math.min(dia, ultimoDia))
}

// Janela de geração — nunca cria cobrança com vencimento no passado (evita
// backfill de ciclos antigos de contratos já ativos há tempo) e olha só um
// pouco pra frente, o suficiente pra o calendário do Financeiro mostrar o
// próximo vencimento antes do dia chegar. O schedule diário rola essa janela
// dia a dia, então o "próximo ciclo" sempre acaba sendo gerado a tempo.
const LOOKAHEAD_DIAS = 60

// Primeira ocorrência do dia da semana alvo (0=domingo..6=sábado, igual ao
// Date#getDay()) a partir de uma data-base (inclusive, se já bater o dia).
function proximaOcorrenciaSemanal(dataBase, diaSemanaAlvo) {
  const d = new Date(dataBase)
  const diff = (diaSemanaAlvo - d.getDay() + 7) % 7
  d.setDate(d.getDate() + diff)
  return d
}

// Gera as datas de vencimento de cada ciclo de um contrato entre `desde` e
// `ate` (ambos inclusive) — mensal usa o dia de dataInicio como âncora
// (clampado no fim do mês quando necessário); semanal usa o dia da semana
// escolhido no contrato (`diaVencimentoSemanal`), ou o dia da semana de
// dataInicio como fallback pra contratos antigos sem esse campo.
function gerarCiclosContrato(dataInicio, tipoPagamento, desde, ate, diaVencimentoSemanal) {
  const ciclos = []
  if (tipoPagamento === 'semanal') {
    const diaAlvo = diaVencimentoSemanal ?? dataInicio.getDay()
    let cursor = proximaOcorrenciaSemanal(dataInicio, diaAlvo)
    while (cursor <= ate) {
      if (cursor >= desde) {
        ciclos.push({
          competencia: cursor.toISOString().split('T')[0],
          competenciaLabel: `Semana de ${String(cursor.getDate()).padStart(2, '0')}/${String(cursor.getMonth() + 1).padStart(2, '0')}`,
          dataVencimento: new Date(cursor),
        })
      }
      cursor = new Date(cursor.getTime() + 7 * 86400000)
    }
  } else {
    const diaAncora = dataInicio.getDate()
    let ano = dataInicio.getFullYear()
    let mes = dataInicio.getMonth()
    let cursor = diaSeguroDoMes(ano, mes, diaAncora)
    while (cursor <= ate) {
      if (cursor >= desde) {
        ciclos.push({
          competencia: `${ano}-${String(mes + 1).padStart(2, '0')}`,
          competenciaLabel: `${MESES_LABEL[mes]}/${ano}`,
          dataVencimento: new Date(cursor),
        })
      }
      mes += 1
      if (mes > 11) { mes = 0; ano += 1 }
      cursor = diaSeguroDoMes(ano, mes, diaAncora)
    }
  }
  return ciclos
}

// Cria as cobranças que ainda não existem pra um contrato, respeitando a
// janela [hoje, hoje + LOOKAHEAD_DIAS] (nunca backdata) — usa ID
// determinístico (`${contratoId}_${competencia}`) pra ser idempotente: rodar
// de novo (schedule diário ou sync manual) nunca duplica.
async function gerarCobrancasParaContrato(contrato, contratoId, hoje) {
  if (!contrato.dataInicio) return 0
  const dataInicio = contrato.dataInicio.toDate()

  const desde = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  let ate = new Date(desde.getTime() + LOOKAHEAD_DIAS * 86400000)
  const dataFim = contrato.dataFim ? contrato.dataFim.toDate() : null
  if (dataFim && dataFim < ate) ate = dataFim
  if (dataInicio > ate) return 0

  const ciclos = gerarCiclosContrato(dataInicio, contrato.tipoPagamento, desde, ate, contrato.diaVencimentoSemanal ?? null)
  let criadas = 0
  for (const ciclo of ciclos) {
    const cobrancaId = `${contratoId}_${ciclo.competencia}`
    const ref = db.collection('cobrancas').doc(cobrancaId)
    if ((await ref.get()).exists) continue

    const valorTotal = contrato.valorTotal ?? 0
    await ref.set({
      organizacaoId:    contrato.organizacaoId,
      contratoId,
      clienteId:        contrato.clienteId,
      tipoPagamento:    contrato.tipoPagamento,
      competencia:      ciclo.competencia,
      competenciaLabel: ciclo.competenciaLabel,
      valorTotal,
      parcelas: [{
        id:             `${cobrancaId}_1`,
        percentual:     100,
        valor:          valorTotal,
        dataVencimento: Timestamp.fromDate(ciclo.dataVencimento),
        pago:           false,
        dataPagamento:  null,
      }],
      origem:  'automatica',
      geradaEm: FieldValue.serverTimestamp(),
    })
    criadas++
  }
  return criadas
}

// Roda todo dia — como a janela de geração rola dia a dia (sempre [hoje, hoje
// + 60d]), qualquer ciclo que "entrar" na janela é criado; nada é retroativo.
exports.gerarCobrancasAutomaticas = onSchedule(
  { schedule: '0 6 * * *', timeZone: 'America/Sao_Paulo' },
  async () => {
    const hoje = new Date()
    const contratosSnap = await db.collection('contratos').get()
    for (const contratoDoc of contratosSnap.docs) {
      try {
        await gerarCobrancasParaContrato(contratoDoc.data(), contratoDoc.id, hoje)
      } catch (err) {
        console.error(`[gerarCobrancasAutomaticas] contrato ${contratoDoc.id}:`, err)
      }
    }
  }
)

// Callable pra sincronizar na hora, sem esperar a próxima execução do
// schedule (ex: logo após ativar um contrato novo) — mesma lógica, restrita
// à organização de quem chama (master sincroniza todas).
exports.sincronizarCobrancasAgora = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário')
  const { role, organizacaoId } = request.auth.token
  if (role !== 'master' && role !== 'admin_org') {
    throw new HttpsError('permission-denied', 'Sem permissão')
  }

  const hoje = new Date()
  let contratosQuery = db.collection('contratos')
  if (role !== 'master') contratosQuery = contratosQuery.where('organizacaoId', '==', organizacaoId)
  const contratosSnap = await contratosQuery.get()

  let totalCriadas = 0
  for (const contratoDoc of contratosSnap.docs) {
    totalCriadas += await gerarCobrancasParaContrato(contratoDoc.data(), contratoDoc.id, hoje)
  }
  return { criadas: totalCriadas }
})

// Callable de limpeza única — remove cobranças com vencimento no passado que
// ainda estão 100% pendentes (nenhuma parcela paga). Existe pra corrigir o
// efeito colateral da geração antiga, que backdatava cobranças desde o início
// do contrato; nunca mexe numa cobrança que já teve alguma parcela paga.
exports.limparCobrancasAntigasNaoPagas = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário')
  const { role, organizacaoId } = request.auth.token
  if (role !== 'master' && role !== 'admin_org') {
    throw new HttpsError('permission-denied', 'Sem permissão')
  }

  const hoje = new Date()
  let cobrancasQuery = db.collection('cobrancas')
  if (role !== 'master') cobrancasQuery = cobrancasQuery.where('organizacaoId', '==', organizacaoId)
  const cobrancasSnap = await cobrancasQuery.get()

  let removidas = 0
  for (const cobrancaDoc of cobrancasSnap.docs) {
    const cobranca = cobrancaDoc.data()
    const parcelas = cobranca.parcelas ?? []
    const todasNoPassado = parcelas.length > 0 && parcelas.every(p => p.dataVencimento.toDate() < hoje)
    const nenhumaPaga = parcelas.every(p => !p.pago)
    if (todasNoPassado && nenhumaPaga) {
      await cobrancaDoc.ref.delete()
      removidas++
    }
  }
  return { removidas }
})

// ─── Assistente Delivery — chat de conhecimento operacional sobre iFood ────────
// O conhecimento de plataforma (taxas, promoções, métricas, diagnóstico) vive
// em base-conhecimento-ifood.md, carregado como fonte única da verdade — NUNCA
// reescrever esse conteúdo à mão aqui dentro (foi exatamente isso que causou
// um bug real: ao condensar manualmente a seção do HITS, a frase "a loja
// oferece... em troca" virou ambígua e o modelo inferiu errado quem pagava o
// cupom). Editar o .md editando o conhecimento; este arquivo só define
// persona/comportamento/formatação, que são preocupações separadas.
const BASE_CONHECIMENTO_IFOOD = fs.readFileSync(path.join(__dirname, 'base-conhecimento-ifood.md'), 'utf8')

const PERSONA_E_COMPORTAMENTO = `Você é o Assistente Delivery, especializado em gestão de lojas no iFood.

Seu papel é ajudar gestores da consultoria a diagnosticar problemas operacionais, entender métricas e orientar os clientes (donos de loja) a melhorar seus resultados no iFood.

Responda sempre em português brasileiro, de forma direta e prática. Identifique pelo jeito que a pessoa escreve se ela é leiga ou tem conhecimento técnico — se for leiga, evite jargão e explique termos técnicos entre parênteses na primeira vez que usar (ex: "sacola — quando o cliente adiciona itens mas ainda não finalizou o pedido"). Quando a pergunta for vaga ou de diagnóstico, faça no máximo 3 perguntas por vez antes de responder.

FORMATAÇÃO — MUITO IMPORTANTE: suas respostas aparecem dentro de um balão de chat que só exibe texto puro, sem renderizar Markdown. Nunca use sintaxe de Markdown: nada de "#", "##", "**negrito**", "_itálico_" ou "---". Para destacar algo, use CAIXA ALTA pontual ou reformule a frase — nunca asteriscos. Para listas de passos, use "1)", "2)", "3)" direto no texto (sem colchetes nem markdown). Para itens sem ordem, use um traço "-" no início da linha. Separe seções com uma linha em branco e um título curto seguido de dois-pontos (ex: "Faixas de desconto:"), nunca com "#" ou "##". Escreva como uma mensagem de WhatsApp bem escrita — direta, sem formatação de documento.

Este assistente é especializado exclusivamente em iFood — para 99Food ou Keeta, diga que não tem essa base de conhecimento ainda.

REGRA CRÍTICA — não invente detalhes financeiros: responda SOMENTE com base nas informações explícitas na base de conhecimento abaixo, principalmente sobre quem paga o quê (loja vs. iFood) em cada promoção. Nunca complete uma lacuna usando conhecimento geral que você possa ter sobre o iFood de outras fontes — se a base não deixar claro quem banca um valor específico, diga literalmente "não tenho certeza desse detalhe específico, recomendo confirmar no Portal do Parceiro ou com o gestor" em vez de supor. Isso vale especialmente para valores de cupom, percentuais e quem investe em cada campanha.

Nunca invente números ou percentuais que não estejam na base de conhecimento ou nos dados reais da loja informados abaixo. Ao final de respostas complexas, pergunte se a dúvida foi resolvida.

CRIAÇÃO DE TAREFAS: se o gestor pedir explicitamente para lembrar, agendar ou criar uma tarefa sobre uma loja (ex: "desligar anúncio dia 30/07 da loja North Burguer", "lembrar de ligar pro cliente amanhã"), use a ferramenta criar_tarefa. Extraia o nome da loja exatamente como o gestor escreveu, uma descrição curta da ação e, se houver, a data (resolva datas relativas ou parciais como "dia 30/07" ou "amanhã" usando a data de hoje informada abaixo). Não use essa ferramenta para perguntas de diagnóstico ou dúvidas gerais — só quando a intenção for claramente criar uma tarefa/lembrete. Depois que a ferramenta responder, confirme para o gestor em português natural o que foi criado (ou explique o problema, se a loja não foi encontrada).

---

BASE DE CONHECIMENTO (única fonte de fatos sobre o iFood — use isso, não conhecimento geral):

`

const SYSTEM_PROMPT_ASSISTENTE = PERSONA_E_COMPORTAMENTO + BASE_CONHECIMENTO_IFOOD

const TOOLS_ASSISTENTE = [
  {
    name: 'criar_tarefa',
    description: 'Cria uma tarefa na aba Atividades do sistema, associada a uma loja do gestor. Use somente quando o gestor pedir explicitamente para criar/agendar uma tarefa ou lembrete.',
    input_schema: {
      type: 'object',
      properties: {
        loja: { type: 'string', description: 'Nome da loja mencionada pelo gestor, como ele escreveu (ex: "North Burguer").' },
        descricao: { type: 'string', description: 'Descrição curta e clara da tarefa (ex: "Desligar anúncio").' },
        data: { type: 'string', description: 'Data da tarefa no formato AAAA-MM-DD, se o gestor mencionou uma data (resolva datas relativas/parciais usando a data de hoje). Omita se nenhuma data foi mencionada.' },
        prioridade: { type: 'string', enum: ['normal', 'urgente', 'agendada'], description: 'Só informe "urgente" se o gestor usar palavras como urgente/crítico/prioridade máxima. Caso contrário, omita este campo — o sistema decide automaticamente.' },
      },
      required: ['loja', 'descricao'],
    },
  },
]

// Remove acentos/caixa pra comparar nomes de loja de forma tolerante ao jeito
// que o gestor escreveu no chat (ex: "north burguer" vs "North Burguer").
function normalizarTexto(s) {
  return (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

// Busca a loja pelo nome dentro do que o chamador pode acessar (gestor só as
// suas, admin/master toda a org) — evita que o assistente crie uma tarefa
// numa loja que o gestor não gerencia.
async function buscarLojaPorNome(nomeBuscado, { role, organizacaoId, uid }) {
  let q = db.collection('lojas')
  if (role !== 'master') q = q.where('organizacaoId', '==', organizacaoId ?? null)
  if (role === 'gestor') q = q.where('gestorId', '==', uid)
  const snap = await q.get()

  const alvo = normalizarTexto(nomeBuscado)
  let melhor = null
  for (const docSnap of snap.docs) {
    const loja = docSnap.data()
    const nomeNorm = normalizarTexto(loja.nome)
    if (nomeNorm === alvo) return { id: docSnap.id, ...loja }
    if (!melhor && (nomeNorm.includes(alvo) || alvo.includes(nomeNorm))) melhor = { id: docSnap.id, ...loja }
  }
  return melhor
}

async function executarCriarTarefa(input, request) {
  const { role, organizacaoId, uid } = request.auth.token

  const loja = await buscarLojaPorNome(input.loja, { role, organizacaoId, uid })
  if (!loja) {
    return { erro: true, mensagem: `Não encontrei nenhuma loja chamada "${input.loja}" entre as lojas que você tem acesso.` }
  }

  let dataLembrete = null
  if (input.data) {
    const [ano, mes, dia] = String(input.data).split('-').map(Number)
    // A Cloud Function roda em UTC (não no fuso do usuário), então construir a
    // data com o offset de Brasília fixo (-03:00, sem horário de verão desde
    // 2019) evita o bug de "dia 30" virar 29 quando o cliente exibe em local time.
    if (ano && mes && dia) {
      const dataStr = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}T00:00:00-03:00`
      dataLembrete = Timestamp.fromDate(new Date(dataStr))
    }
  }

  const prioridade = input.prioridade || (dataLembrete ? 'agendada' : 'normal')

  const gestorDoc = await db.collection('users').doc(uid).get()
  const gestorNome = gestorDoc.exists ? (gestorDoc.data().nome ?? '') : ''

  const docRef = await db.collection('tarefas').add({
    lojaId: loja.id,
    lojaNome: loja.nome ?? '',
    gestorId: uid,
    gestorNome,
    organizacaoId: loja.organizacaoId ?? organizacaoId ?? null,
    descricao: String(input.descricao || '').trim(),
    dataLembrete,
    observacao: null,
    status: 'pendente',
    tipo: 'tarefa',
    prioridade,
    criadoEm: FieldValue.serverTimestamp(),
    origem: 'assistente_chat',
  })

  return {
    erro: false,
    tarefaId: docRef.id,
    loja: loja.nome,
    descricao: String(input.descricao || '').trim(),
    data: input.data || null,
    prioridade,
  }
}

// O modelo às vezes ignora a instrução de "não usar Markdown" (comportamento
// de LLM não é 100% confiável só por prompt) — essa limpeza garante que
// símbolos de Markdown nunca cheguem no balão de chat, que só exibe texto puro.
function limparMarkdown(texto) {
  return texto
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-_*]{3,}\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

exports.assistenteChat = onCall({ secrets: [anthropicApiKey], timeoutSeconds: 30, memory: '256MiB' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário')

  const { messages, lojaId } = request.data || {}
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new HttpsError('invalid-argument', 'messages é obrigatório')
  }

  let contextoLoja = ''
  if (lojaId) {
    const lojaDoc = await db.collection('lojas').doc(lojaId).get()
    if (lojaDoc.exists) {
      const loja = lojaDoc.data()
      const { role, organizacaoId } = request.auth.token
      const podeAcessar = role === 'master' || loja.organizacaoId === organizacaoId
      if (podeAcessar) {
        const resultadosSnap = await db.collection('resultados')
          .where('organizacaoId', '==', loja.organizacaoId ?? null)
          .where('lojaId', '==', lojaId)
          .orderBy('semana', 'desc')
          .limit(8)
          .get()
        const resultados = resultadosSnap.docs.map(d => d.data())
        contextoLoja = `\n\n---\n\nDADOS REAIS DA LOJA SELECIONADA (use pra personalizar o diagnóstico em vez de só perguntar):\nNome: ${loja.nome}\nSegmento: ${loja.segmento || 'não informado'}\nPlataformas: ${(loja.plataformas ?? [loja.plataforma]).filter(Boolean).join(', ') || 'não informado'}\nStatus: ${loja.status}\n\nÚltimos resultados semanais (mais recente primeiro):\n` +
          (resultados.length
            ? resultados.map(r => `- Semana ${r.semana}: faturamento R$${r.faturamento ?? '—'}, variação ${r.variacao ?? '—'}%, cancelamento ${r.cancelamento ?? '—'}%, chamados ${r.chamados ?? '—'}%`).join('\n')
            : '(nenhum resultado lançado ainda)')
      }
    }
  }

  const hojeStr = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'America/Sao_Paulo' }).format(new Date())
  const contextoData = `\n\n---\n\nHoje é ${hojeStr}. Use essa data como referência para resolver datas relativas ou parciais mencionadas pelo gestor (ex: "amanhã", "dia 30/07").`

  const anthropic = new Anthropic({ apiKey: anthropicApiKey.value() })
  const historico = messages.map(m => ({ role: m.role, content: String(m.content ?? '') }))

  let response
  try {
    response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT_ASSISTENTE + contextoData + contextoLoja,
      messages: historico,
      tools: TOOLS_ASSISTENTE,
    })
  } catch (err) {
    console.error('[assistenteChat] erro na API da Anthropic:', err)
    throw new HttpsError('internal', 'Erro ao consultar o assistente. Tente novamente.')
  }

  // Loop de tool-use: só ocorre quando o modelo pede pra criar uma tarefa —
  // executamos a ferramenta no servidor e devolvemos o resultado pro modelo
  // formular a confirmação final em linguagem natural.
  while (response.stop_reason === 'tool_use') {
    const toolUseBlock = response.content.find(b => b.type === 'tool_use')
    if (!toolUseBlock) break

    let resultadoFerramenta
    if (toolUseBlock.name === 'criar_tarefa') {
      try {
        resultadoFerramenta = await executarCriarTarefa(toolUseBlock.input || {}, request)
      } catch (err) {
        console.error('[assistenteChat] erro ao executar criar_tarefa:', err)
        resultadoFerramenta = { erro: true, mensagem: 'Erro interno ao tentar criar a tarefa.' }
      }
    } else {
      resultadoFerramenta = { erro: true, mensagem: 'Ferramenta desconhecida.' }
    }

    historico.push({ role: 'assistant', content: response.content })
    historico.push({
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: toolUseBlock.id, content: JSON.stringify(resultadoFerramenta) }],
    })

    try {
      response = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 1024,
        system: SYSTEM_PROMPT_ASSISTENTE + contextoData + contextoLoja,
        messages: historico,
        tools: TOOLS_ASSISTENTE,
      })
    } catch (err) {
      console.error('[assistenteChat] erro na API da Anthropic (pós tool-use):', err)
      throw new HttpsError('internal', 'Erro ao consultar o assistente. Tente novamente.')
    }
  }

  const textBlock = response.content.find(b => b.type === 'text')
  return { reply: limparMarkdown(textBlock?.text ?? '') }
})
