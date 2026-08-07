import { db, COLLECTIONS, collection, query, where, getDocs } from '../services/firebase'

function tsToDate(ts) {
  if (!ts) return null
  return ts.toDate ? ts.toDate() : new Date(ts)
}

// Formata uma duração (data de início → agora) em texto compacto e humano —
// ex: "8 meses e 12 dias em gestão", "1 ano e 3 meses em gestão", "9 dias em
// gestão". Separada de calcularTempoDeGestao() pra poder ser reaproveitada
// em qualquer lugar que já tenha a data em mãos, sem precisar consultar o
// Firestore de novo.
export function formatarTempoDeGestao(dataInicio, agora = new Date()) {
  const inicio = tsToDate(dataInicio)
  if (!inicio || inicio > agora) return 'Tempo de gestão não disponível'

  let anos  = agora.getFullYear() - inicio.getFullYear()
  let meses = agora.getMonth() - inicio.getMonth()
  let dias  = agora.getDate() - inicio.getDate()

  if (dias < 0) {
    meses -= 1
    // Dias do mês anterior ao mês atual (base pro "empréstimo" de dias).
    dias += new Date(agora.getFullYear(), agora.getMonth(), 0).getDate()
  }
  if (meses < 0) {
    anos -= 1
    meses += 12
  }

  const partes = []
  if (anos > 0)  partes.push(`${anos} ano${anos !== 1 ? 's' : ''}`)
  if (meses > 0) partes.push(`${meses} ${meses !== 1 ? 'meses' : 'mês'}`)
  // Dias só entram na composição quando é a única unidade disponível (não
  // polui "1 ano e 3 meses" com "e 2 dias") — exceto quando ainda estamos
  // no primeiro mês, onde dias é a granularidade que importa.
  if (partes.length === 0 || (anos === 0 && meses === 0)) {
    partes.push(`${dias} dia${dias !== 1 ? 's' : ''}`)
  }

  return `${partes.join(' e ')} em gestão`
}

// Resolve a data de início de gestão de um cliente e já devolve o texto
// pronto pra exibir — encapsula a decisão de qual fonte usar, então quem
// consome (o componente) não precisa saber de onde o dado veio.
//
// Ordem de prioridade:
//   1. dataInicio do contrato já ATIVADO mais antigo do cliente (dataInicio
//      <= hoje) — não o mais recente, já que um cliente pode ter vários
//      contratos ao longo do tempo e o que importa é o início real da
//      relação, não do contrato vigente agora.
//   2. Sem nenhum contrato: criadoEm da loja mais antiga vinculada ao
//      cliente — cobre clientes migrados antes de existir a estrutura de
//      Contratos, ou ainda em processo de onboarding. (O campo populado na
//      criação da loja é `criadoEm`; não existe `dataCadastro` nos
//      documentos de loja hoje, apesar do nome usado em outro lugar do
//      sistema — usamos o campo que realmente existe.)
//   3. Nenhuma das duas fontes disponível: dataInicio null e label
//      "Tempo de gestão não disponível", em vez de quebrar o componente ou
//      mostrar um valor incorreto.
//
// @param {string} clienteId
// @param {string|null} [organizacaoId] - escopo da organização do usuário logado;
//   necessário pra passar nas regras de segurança do Firestore, que exigem esse
//   filtro explícito em queries de listagem (sem ele, o Firestore nega a query
//   inteira por não conseguir garantir que todo documento retornado pertence à
//   org do usuário). Omitir só faz sentido pra master/superadmin.
// @returns {Promise<{ dataInicio: Date|null, label: string }>}
export async function calcularTempoDeGestao(clienteId, organizacaoId) {
  if (!clienteId) return { dataInicio: null, label: 'Tempo de gestão não disponível' }

  const agora = new Date()
  const escopoOrg = organizacaoId ? [where('organizacaoId', '==', organizacaoId)] : []

  try {
    const contratosSnap = await getDocs(query(
      collection(db, COLLECTIONS.CONTRATOS),
      ...escopoOrg,
      where('clienteId', '==', clienteId),
    ))
    const contratosAtivados = contratosSnap.docs
      .map(d => tsToDate(d.data().dataInicio))
      .filter(d => d && d <= agora)

    if (contratosAtivados.length > 0) {
      const maisAntigo = contratosAtivados.reduce((min, d) => (d < min ? d : min))
      return { dataInicio: maisAntigo, label: formatarTempoDeGestao(maisAntigo, agora) }
    }

    const lojasSnap = await getDocs(query(
      collection(db, COLLECTIONS.LOJAS),
      ...escopoOrg,
      where('clienteId', '==', clienteId),
    ))
    const datasLojas = lojasSnap.docs
      .map(d => tsToDate(d.data().criadoEm))
      .filter(Boolean)

    if (datasLojas.length > 0) {
      const maisAntiga = datasLojas.reduce((min, d) => (d < min ? d : min))
      return { dataInicio: maisAntiga, label: formatarTempoDeGestao(maisAntiga, agora) }
    }

    return { dataInicio: null, label: 'Tempo de gestão não disponível' }
  } catch (err) {
    console.error('[calcularTempoDeGestao] erro ao buscar dados:', err?.code, err?.message)
    return { dataInicio: null, label: 'Tempo de gestão não disponível' }
  }
}
