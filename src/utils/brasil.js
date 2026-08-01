// Tabela fixa de códigos de UF do IBGE — a malha geográfica da API do IBGE
// (servicodados.ibge.gov.br) só traz o código numérico (`codarea`) em cada
// feature, sem nome nem sigla, então esse mapeamento é necessário pra
// identificar cada estado no mapa.

export const UF_POR_CODAREA = {
  '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO',
  '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL', '28': 'SE', '29': 'BA',
  '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP',
  '41': 'PR', '42': 'SC', '43': 'RS',
  '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF',
}

export const UF_INFO = {
  RO: { nome: 'Rondônia',            regiao: 'Norte' },
  AC: { nome: 'Acre',                regiao: 'Norte' },
  AM: { nome: 'Amazonas',            regiao: 'Norte' },
  RR: { nome: 'Roraima',             regiao: 'Norte' },
  PA: { nome: 'Pará',                regiao: 'Norte' },
  AP: { nome: 'Amapá',               regiao: 'Norte' },
  TO: { nome: 'Tocantins',           regiao: 'Norte' },
  MA: { nome: 'Maranhão',            regiao: 'Nordeste' },
  PI: { nome: 'Piauí',               regiao: 'Nordeste' },
  CE: { nome: 'Ceará',               regiao: 'Nordeste' },
  RN: { nome: 'Rio Grande do Norte', regiao: 'Nordeste' },
  PB: { nome: 'Paraíba',             regiao: 'Nordeste' },
  PE: { nome: 'Pernambuco',          regiao: 'Nordeste' },
  AL: { nome: 'Alagoas',             regiao: 'Nordeste' },
  SE: { nome: 'Sergipe',             regiao: 'Nordeste' },
  BA: { nome: 'Bahia',               regiao: 'Nordeste' },
  MG: { nome: 'Minas Gerais',        regiao: 'Sudeste' },
  ES: { nome: 'Espírito Santo',      regiao: 'Sudeste' },
  RJ: { nome: 'Rio de Janeiro',      regiao: 'Sudeste' },
  SP: { nome: 'São Paulo',           regiao: 'Sudeste' },
  PR: { nome: 'Paraná',              regiao: 'Sul' },
  SC: { nome: 'Santa Catarina',      regiao: 'Sul' },
  RS: { nome: 'Rio Grande do Sul',   regiao: 'Sul' },
  MS: { nome: 'Mato Grosso do Sul',  regiao: 'Centro-Oeste' },
  MT: { nome: 'Mato Grosso',         regiao: 'Centro-Oeste' },
  GO: { nome: 'Goiás',               regiao: 'Centro-Oeste' },
  DF: { nome: 'Distrito Federal',    regiao: 'Centro-Oeste' },
}

export const REGIOES_ORDEM = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul']

// Normaliza o texto livre do campo endereço.estado pra sigla de 2 letras —
// aceita tanto "SP" quanto "São Paulo" (com ou sem acento), já que o campo é
// preenchido tanto pelo autofill do CEP (sempre sigla) quanto manualmente.
const NOME_PARA_SIGLA = Object.fromEntries(
  Object.entries(UF_INFO).map(([sigla, info]) => [
    info.nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(),
    sigla,
  ])
)

export function normalizarUF(valor) {
  if (!valor) return null
  const v = valor.trim()
  if (v.length === 2 && UF_INFO[v.toUpperCase()]) return v.toUpperCase()
  const semAcento = v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  return NOME_PARA_SIGLA[semAcento] ?? null
}
