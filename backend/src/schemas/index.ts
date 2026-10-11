import { z } from 'zod';

export const userSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('Formato de e-mail inválido'),
  senha: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  role: z.enum(['ADMIN', 'FINANCEIRO', 'GESTOR_PL', 'VENDEDOR', 'SDR_CLOSER', 'COLABORADOR']),
  tipoVendedor: z.enum(['GC', 'TERCEIRIZADO']).optional().nullable(),
  metas: z.number().or(z.string()).optional().nullable(),
  gestorId: z.string().uuid().optional().nullable(),
  unidadeId: z.string().uuid().optional().nullable()
});

export const unidadeSchema = z.object({
  nome: z.string().min(1, 'Nome da unidade é obrigatório'),
  cnpj: z.string().min(14, 'CNPJ deve ter pelo menos 14 caracteres').optional().or(z.literal('')),
  endereco: z.string().optional().or(z.literal('')),
  responsavelId: z.string().uuid('ID do responsável inválido')
});

export const clienteSchema = z.object({
  razaoSocial: z.string().min(1, 'Razão social é obrigatória'),
  nomeFantasia: z.string().min(1, 'Nome fantasia é obrigatório'),
  cnpjCpf: z.string().min(11, 'Documento inválido'),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  telefone: z.string().min(1, 'Telefone é obrigatório').optional().or(z.literal('')),
  unidadeId: z.string().uuid('ID da unidade é obrigatório'),
  status: z.enum(['ATIVO', 'INATIVO', 'PROSPECCAO']).default('ATIVO'),
  faseFunil: z.enum(['LEAD', 'REUNIAO', 'PROPOSTA', 'FECHAMENTO']).optional(),
  dataVencimentoContrato: z.string().optional().or(z.literal(''))
});

export const financeiroSchema = z.object({
  tipo: z.enum(['MENSALIDADE', 'VENDA_AVULSA']),
  categoriaServico: z.enum(['TRAFEGO', 'SOCIAL_MEDIA', 'SITES', 'SEO', 'BRANDING', 'OUTROS']).optional(),
  descricao: z.string().optional().or(z.literal('')),
  valor: z.number().positive('O valor deve ser maior que zero').or(z.string().regex(/^\d+(\.\d{1,2})?$/).transform(Number)),
  dataCompetencia: z.string().refine(val => !isNaN(Date.parse(val)), 'Data inválida'),
  statusPagamento: z.enum(['PAGO', 'PENDENTE', 'ATRASADO']).default('PENDENTE'),
  clienteId: z.string().uuid('ID do cliente é obrigatório')
});

export const interacaoSchema = z.object({
  tipo: z.enum(['REUNIAO', 'CALL', 'WHATSAPP']),
  descricao: z.string().min(1, 'Descrição é obrigatória'),
  clienteId: z.string().uuid('ID do cliente é obrigatório'),
});

export const propostaSchema = z.object({
  clienteId: z.string().uuid('ID do cliente é obrigatório'),
  vendedorId: z.string().uuid('ID do vendedor é obrigatório'),
  status: z.enum(['RASCUNHO', 'ENVIADO', 'ASSINADO', 'ATIVO']).default('RASCUNHO'),
  valor: z.number().positive('O valor deve ser maior que zero').or(z.string().regex(/^\d+(\.\d{1,2})?$/).transform(Number)),
  descricao: z.string().optional().or(z.literal('')),
});

export const avaliacaoSchema = z.object({
  colaboradorId: z.string().uuid('ID do colaborador é obrigatório'),
  mesReferencia: z.string().refine(val => !isNaN(Date.parse(val)), 'Mês inválido'),
  notas: z.any(), // JSON
  feedback: z.string().optional().or(z.literal('')),
});

export const analiseSchema = z.object({
  clienteId: z.string().uuid('ID do cliente é obrigatório'),
  mesReferencia: z.string().refine(val => !isNaN(Date.parse(val)), 'Mês inválido'),
  notaCSAT: z.number().min(0).max(10).optional().nullable(),
  riscos: z.string().optional().or(z.literal('')),
  planoAcao: z.string().optional().or(z.literal('')),
  classificacao: z.enum(['SAUDAVEL', 'ATENCAO', 'CRITICO']),
});

export const cancelamentoSchema = z.object({
  clienteId: z.string().uuid('ID do cliente é obrigatório'),
  motivo: z.string().min(1, 'Motivo é obrigatório'),
  tentativasRetencao: z.string().optional().or(z.literal('')),
  receitaPerdida: z.number().positive('O valor deve ser maior que zero').or(z.string().regex(/^\d+(\.\d{1,2})?$/).transform(Number)),
});
