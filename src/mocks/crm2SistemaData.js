// ============================================================================
// CRM 2 (Operações, CS & Retenção, RH, Administração e Design) — Dados Mockados
// Salvo para futura extração em um segundo sistema independente.
// ============================================================================

export const CRM2_MODULES = [
  { id: 'cs', label: 'CS & Retenção', route: '/cs/saude' },
  { id: 'rh', label: 'Recursos Humanos', route: '/rh/equipe' },
  { id: 'administracao', label: 'Administração', route: '/operacoes/administracao' },
  { id: 'design', label: 'Designer & Criação', route: '/operacoes/design' },
];

// ----------------------------------------------------------------------------
// 1. CS & RETENÇÃO
// ----------------------------------------------------------------------------
export const MOCK_CS_INDICADORES = {
  healthScoreMedio: 8.4,
  taxaRetencaoMensal: 96.8,
  clientesSaudaveis: 34,
  clientesEmAtencao: 6,
  clientesCriticos: 2,
  mrrEmRisco: 18400,
};

export const MOCK_CS_ANALISES = [
  {
    id: 'cs-ana-01',
    cliente: { nomeFantasia: 'Rede Supermercados Paraná', unidade: 'Matriz Curitiba' },
    csResponsavel: 'Camila Rocha',
    mesReferencia: '2026-11-01T00:00:00.000Z',
    notaCSAT: 9,
    classificacao: 'SAUDAVEL',
    ultimoContato: '2026-11-08',
    riscos: 'Nenhum risco mapeado. Cliente renovou escopo de tráfego pago.',
    planoAcao: 'Apresentar proposta de expansão para novas filiais em dezembro.',
  },
  {
    id: 'cs-ana-02',
    cliente: { nomeFantasia: 'Clínica Odontológica Sorriso Prime', unidade: 'Unidade Londrina' },
    csResponsavel: 'Camila Rocha',
    mesReferencia: '2026-11-01T00:00:00.000Z',
    notaCSAT: 7,
    classificacao: 'ATENCAO',
    ultimoContato: '2026-11-06',
    riscos: 'Atraso no envio de materiais pela equipe interna do cliente gerou queda de leads na 2ª semana.',
    planoAcao: 'Reunião semanal de alinhamento toda segunda-feira às 10h com gestor da clínica.',
  },
  {
    id: 'cs-ana-03',
    cliente: { nomeFantasia: 'Construtora Horizonte Sul', unidade: 'Matriz Curitiba' },
    csResponsavel: 'Lucas Mendes',
    mesReferencia: '2026-11-01T00:00:00.000Z',
    notaCSAT: 5,
    classificacao: 'CRITICO',
    ultimoContato: '2026-11-09',
    riscos: 'Insatisfação com custo por lead no lançamento imobiliário de outubro.',
    planoAcao: 'Plano de recuperação de 15 dias com revisão completa de criativos e landing page.',
  },
  {
    id: 'cs-ana-04',
    cliente: { nomeFantasia: 'Grupo AutoCenter Brasil', unidade: 'Unidade Maringá' },
    csResponsavel: 'Lucas Mendes',
    mesReferencia: '2026-11-01T00:00:00.000Z',
    notaCSAT: 10,
    classificacao: 'SAUDAVEL',
    ultimoContato: '2026-11-07',
    riscos: 'Nenhum.',
    planoAcao: 'Coletar depoimento em vídeo para case de sucesso.',
  },
];

export const MOCK_CS_CANCELAMENTOS = [
  {
    id: 'cs-canc-01',
    cliente: { nomeFantasia: 'Bistrô & Café Colonial Vila Verde', unidade: 'Unidade Londrina' },
    dataCancelamento: '2026-10-22T00:00:00.000Z',
    receitaPerdida: 3500.0,
    motivo: 'Redução de orçamento interno após reforma física do estabelecimento.',
    tentativasRetencao: 'Oferecido downgrade temporário de 50% por 60 dias, porém cliente optou por pausar.',
    statusReversao: 'PAUSADO_RETORNO_JAN',
  },
  {
    id: 'cs-canc-02',
    cliente: { nomeFantasia: 'TechParts Distribuidora', unidade: 'Matriz Curitiba' },
    dataCancelamento: '2026-09-18T00:00:00.000Z',
    receitaPerdida: 4800.0,
    motivo: 'Internalização da equipe de marketing pelo grupo comprador.',
    tentativasRetencao: 'Proposta de consultoria híbrida apresentada à diretoria.',
    statusReversao: 'ENCERRADO',
  },
];

export const MOCK_CS_PONTUACAO_HANDOFF = [
  {
    id: 'cs-hand-01',
    nomeFantasia: 'Rede Supermercados Paraná',
    vendedor: { nome: 'Rafael Almeida' },
    csResponsavel: 'Camila Rocha',
    notaOperador: 5,
    observacao: 'Expectativa alinhada perfeitamente com o contrato assinado.',
  },
  {
    id: 'cs-hand-02',
    nomeFantasia: 'Clínica Odontológica Sorriso Prime',
    vendedor: { nome: 'Beatriz Santos' },
    csResponsavel: 'Camila Rocha',
    notaOperador: 4,
    observacao: 'Bom repasse, faltou apenas anexar manual da marca no onboarding inicial.',
  },
  {
    id: 'cs-hand-03',
    nomeFantasia: 'Construtora Horizonte Sul',
    vendedor: { nome: 'Rafael Almeida' },
    csResponsavel: 'Lucas Mendes',
    notaOperador: 3,
    observacao: 'Prazo de campanha de lançamento prometido muito curto.',
  },
];

// ----------------------------------------------------------------------------
// 2. RECURSOS HUMANOS (RH)
// ----------------------------------------------------------------------------
export const MOCK_RH_INDICADORES = {
  totalColaboradores: 18,
  mediaDesempenhoGeral: 4.6,
  avaliacoesNoMes: 14,
  pdisAtivos: 7,
};

export const MOCK_RH_COLABORADORES = [
  {
    id: 'rh-col-01',
    nome: 'Camila Rocha',
    cargo: 'Head de CS & Retenção',
    setor: 'Customer Success',
    unidade: 'Matriz Curitiba',
    admissao: '2024-03-10',
    status: 'ATIVO',
  },
  {
    id: 'rh-col-02',
    nome: 'Matheus Oliveira',
    cargo: 'Designer Sênior / Diretor de Arte',
    setor: 'Design & Criação',
    unidade: 'Matriz Curitiba',
    admissao: '2024-06-01',
    status: 'ATIVO',
  },
  {
    id: 'rh-col-03',
    nome: 'Fernanda Lima',
    cargo: 'Analista Administrativo & Compras',
    setor: 'Administração',
    unidade: 'Matriz Curitiba',
    admissao: '2025-01-15',
    status: 'ATIVO',
  },
  {
    id: 'rh-col-04',
    nome: 'Gabriel Teixeira',
    cargo: 'Motion Designer & Video Maker',
    setor: 'Design & Criação',
    unidade: 'Unidade Londrina',
    admissao: '2025-04-02',
    status: 'ATIVO',
  },
  {
    id: 'rh-col-05',
    nome: 'Lucas Mendes',
    cargo: 'Especialista em Customer Success',
    setor: 'Customer Success',
    unidade: 'Unidade Maringá',
    admissao: '2025-02-20',
    status: 'ATIVO',
  },
];

export const MOCK_RH_AVALIACOES = [
  {
    id: 'rh-ava-01',
    colaborador: { id: 'rh-col-01', nome: 'Camila Rocha', cargo: 'Head de CS & Retenção' },
    avaliador: { nome: 'Diretoria Grupo Costa' },
    mesReferencia: '2026-11-01T00:00:00.000Z',
    notas: { comunicacao: 5, tecnica: 5, prazos: 5 },
    notaGeral: 5,
    feedbackTexto: 'Excelente condução das contas estratégicas e redução do churn no trimestre.',
  },
  {
    id: 'rh-ava-02',
    colaborador: { id: 'rh-col-02', nome: 'Matheus Oliveira', cargo: 'Designer Sênior' },
    avaliador: { nome: 'Diretoria Grupo Costa' },
    mesReferencia: '2026-11-01T00:00:00.000Z',
    notas: { comunicacao: 4, tecnica: 5, prazos: 5 },
    notaGeral: 4.7,
    feedbackTexto: 'Altíssimo índice de aprovação de primeira nos key visuals das campanhas.',
  },
  {
    id: 'rh-ava-03',
    colaborador: { id: 'rh-col-04', nome: 'Gabriel Teixeira', cargo: 'Motion Designer' },
    avaliador: { nome: 'Matheus Oliveira' },
    mesReferencia: '2026-11-01T00:00:00.000Z',
    notas: { comunicacao: 4, tecnica: 4, prazos: 4 },
    notaGeral: 4.0,
    feedbackTexto: 'Ótima evolução na edição de Reels dinâmicos; focar em padronizar nomenclatura de arquivos.',
  },
];

// ----------------------------------------------------------------------------
// 3. ADMINISTRAÇÃO (ADM)
// ----------------------------------------------------------------------------
export const MOCK_ADM_INDICADORES = {
  solicitacoesAbertas: 6,
  contratosFornecedoresAtivos: 14,
  custoOperacionalMensal: 28950.0,
  complianceUnidades: '100% Regular',
};

export const MOCK_ADM_DEMANDAS = [
  {
    id: 'adm-dem-01',
    protocolo: 'ADM-2026-104',
    titulo: 'Renovação de Licenças Adobe Creative Cloud (Equipe Design)',
    categoria: 'Software & Licenças',
    unidade: 'Matriz Curitiba',
    solicitante: 'Matheus Oliveira',
    prioridade: 'ALTA',
    prazo: '2026-11-15',
    valorEstimado: 4200.0,
    status: 'EM_ANDAMENTO',
  },
  {
    id: 'adm-dem-02',
    titulo: 'Aquisição de 2 Monitores Ultrawide 29" para Ilha de Edição',
    protocolo: 'ADM-2026-105',
    categoria: 'Compras & Patrimônio',
    unidade: 'Unidade Londrina',
    solicitante: 'Gabriel Teixeira',
    prioridade: 'MEDIA',
    prazo: '2026-11-20',
    valorEstimado: 3180.0,
    status: 'AGUARDANDO_APROVACAO',
  },
  {
    id: 'adm-dem-03',
    protocolo: 'ADM-2026-101',
    titulo: 'Aditivo Contratual de Locação — Sala Comercial Maringá',
    categoria: 'Jurídico & Societário',
    unidade: 'Unidade Maringá',
    solicitante: 'Fernanda Lima',
    prioridade: 'ALTA',
    prazo: '2026-11-12',
    valorEstimado: 0,
    status: 'CONCLUIDO',
  },
  {
    id: 'adm-dem-04',
    protocolo: 'ADM-2026-106',
    titulo: 'Manutenção Preventiva de Ar-Condicionado e Rede Elétrica',
    categoria: 'Infraestrutura & Facilities',
    unidade: 'Matriz Curitiba',
    solicitante: 'Fernanda Lima',
    prioridade: 'BAIXA',
    prazo: '2026-11-28',
    valorEstimado: 1450.0,
    status: 'ABERTO',
  },
];

export const MOCK_ADM_FORNECEDORES = [
  {
    id: 'adm-forn-01',
    fornecedor: 'Adobe Systems Brasil',
    servico: 'Licenças Creative Cloud Equipe',
    unidade: 'Todas as Unidades',
    valorMensal: 4200.0,
    vencimentoDia: 15,
    status: 'ATIVO',
  },
  {
    id: 'adm-forn-02',
    fornecedor: 'Condomínio Empresarial Centro Cívico',
    servico: 'Locação + Condomínio Matriz',
    unidade: 'Matriz Curitiba',
    valorMensal: 9800.0,
    vencimentoDia: 10,
    status: 'ATIVO',
  },
  {
    id: 'adm-forn-03',
    fornecedor: 'Contabilidade Prisma Empresarial',
    servico: 'Assessoria Contábil e Folha',
    unidade: 'Todas as Unidades',
    valorMensal: 3200.0,
    vencimentoDia: 20,
    status: 'ATIVO',
  },
];

// ----------------------------------------------------------------------------
// 4. DESIGNER & CRIAÇÃO
// ----------------------------------------------------------------------------
export const MOCK_DESIGN_INDICADORES = {
  pecasEntreguesMes: 68,
  emProducao: 9,
  aguardandoAprovacao: 5,
  slaMedioHoras: 18,
  taxaAprovacaoPrimeira: 91,
};

export const MOCK_DESIGN_DEMANDAS = [
  {
    id: 'des-01',
    codigo: 'CRI-401',
    titulo: 'Key Visual Campanha Black November + Desdobramento Feed/Stories',
    cliente: 'Rede Supermercados Paraná',
    unidade: 'Matriz Curitiba',
    formato: 'Key Visual + Pack 6 Criativos',
    designer: 'Matheus Oliveira',
    prioridade: 'ALTA',
    prazo: '2026-11-11',
    status: 'APROVACAO_CLIENTE',
    revisoes: 0,
  },
  {
    id: 'des-02',
    codigo: 'CRI-402',
    titulo: 'Edição de 4 Reels Dinâmicos (Implantes & Invisalign)',
    cliente: 'Clínica Odontológica Sorriso Prime',
    unidade: 'Unidade Londrina',
    formato: 'Reels / Vídeo Vertical (9:16)',
    designer: 'Gabriel Teixeira',
    prioridade: 'ALTA',
    prazo: '2026-11-12',
    status: 'EM_PRODUCAO',
    revisoes: 1,
  },
  {
    id: 'des-03',
    codigo: 'CRI-403',
    titulo: 'Redesign de Landing Page de Alta Conversão — Residencial Aurora',
    cliente: 'Construtora Horizonte Sul',
    unidade: 'Matriz Curitiba',
    formato: 'UI/UX Landing Page (Figma)',
    designer: 'Matheus Oliveira',
    prioridade: 'ALTA',
    prazo: '2026-11-13',
    status: 'EM_PRODUCAO',
    revisoes: 0,
  },
  {
    id: 'des-04',
    codigo: 'CRI-404',
    titulo: 'Carrossel Educativo: Revisão Preventiva de Fim de Ano',
    cliente: 'Grupo AutoCenter Brasil',
    unidade: 'Unidade Maringá',
    formato: 'Carrossel 8 Telas (1080x1350)',
    designer: 'Gabriel Teixeira',
    prioridade: 'MEDIA',
    prazo: '2026-11-14',
    status: 'BRIEFING',
    revisoes: 0,
  },
  {
    id: 'des-05',
    codigo: 'CRI-399',
    titulo: 'Identidade Visual & Selo Comemorativo 15 Anos',
    cliente: 'Grupo AutoCenter Brasil',
    unidade: 'Unidade Maringá',
    formato: 'Branding / Manual de Marca',
    designer: 'Matheus Oliveira',
    prioridade: 'MEDIA',
    prazo: '2026-11-08',
    status: 'APROVADO',
    revisoes: 0,
  },
];
