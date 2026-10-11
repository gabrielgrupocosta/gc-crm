# 📘 PRD - ERP Grupo Costa (Gestão Comercial, CS, Financeiro e RH)
**Versão Atual:** 2.0
**Data da última atualização:** 01/10/2026

## 1. Visão Geral
O sistema evoluiu de um CRM básico para um ERP completo focado na Gestão de Agências de Marketing. Ele centraliza as frentes Comercial, Financeiro, Customer Success (CS) e Recursos Humanos (Equipe), com um rígido controle de permissões granulares (RBAC) e tenant isolation (isolamento por unidade). O objetivo é prover dados acionáveis (MRR, Churn), controle hierárquico, relatórios e gestão de desempenho mensal (equipes e clientes).

## 2. Stack Tecnológica
* **Frontend:** Next.js (App Router), React, Tailwind CSS, Lucide-React, Recharts (Gráficos), @hello-pangea/dnd (Kanban).
* **Backend:** Node.js, Express, Prisma ORM, Zod, JWT. Banco de Dados Relacional (PostgreSQL via Docker).
* **Design System:** Clean & Enterprise (Dark/Light mix).
  * Cores da Marca: Primary (`#031E33`), Secondary (`#883123`), Tertiary (`#9F7E50`).
  * Alertas: Negative (`#DC2626`), Positive (`#007A5A`), Warning (`#CA8A04`).
  * Fundo Principal (`#F7F7F8`), Fundo Sidebar/Primary (`#031E33`).

## 3. Entidades e Banco de Dados (Schema Simplificado 2.0)
*Nota Arquitetural: Todas as tabelas possuem o campo `deletedAt` implementando a exclusão lógica (Soft Delete), garantindo segurança e histórico auditável contra remoções acidentais.*

1. **User (Usuário / Colaborador):** Expansão. Possui `id`, `nome`, `email`, `senha`, `role`, `gestorId` (relacionamento com outro User), `tipoVendedor` (GC ou Terceirizado), `metas`, `unidadeId`, e `permissoes` (Matriz JSON de Acessos Dinâmicos).
2. **Unidade:** Representa um pólo do grupo. Possui `id`, `nome`, `cnpj` e pertence a um `userId` (Gestor/PL).
3. **Cliente:** Possui `razaoSocial`, `cnpjCpf`, `status` (`PROSPECCAO`, `ATIVO`, `INATIVO`, `CANCELADO`), `faseFunil`, `dataVencimentoContrato`, `unidadeId`, e `vendedorId`.
4. **Financeiro (Lançamentos):** Controla as Receitas/Despesas.
5. **Documento:** Armazenamento de arquivos (contratos, briefings). Pertence a um `Cliente`.
6. **Interacao:** Histórico temporal de contatos.
7. **Proposta/Contrato:** Entidade para gerir os templates e aprovações do comercial. Status: `RASCUNHO`, `ASSINADO`, `ATIVO`. O sistema não gera PDFs automaticamente; o processo exige o upload manual do documento físico ou digital pelo usuário para garantir a integridade de cláusulas personalizadas. O arquivo é armazenado via `Documento`.
8. **AvaliacaoDesempenho (RH):** Avaliação mensal do colaborador. Campos: `colaboradorId`, `mesReferencia`, `notaGeral` (1 a 5), `feedbackTexto`.
9. **SnapshotUnidade (Histórico):** Histórico Mensal de Faturamento, MRR, Churn Rate da Unidade para resgate temporal.
10. **AnaliseCliente (CS):** Saúde do cliente por mês. Campos: `clienteId`, `mesReferencia`, `notaCSAT`, `riscos`, `planoAcao`, `classificacao`, `notaOperador` (1 a 5 atribuída pelo gestor).
11. **Cancelamento (Churn):** Registra quebras de contrato. Campos: `clienteId`, `motivo`, `tentativasRetencao`, `receitaPerdida`, `dataCancelamento`.

## 4. Regras de Negócio e Permissões (RBAC)
A hierarquia fundamental é: **Unidade -> Usuários -> Clientes -> Processos**.

As permissões deixaram de ser estáticas. O Super Admin possui total autonomia para parametrizar, através da Interface de Usuários, uma Matriz de Permissões (CRUD) por módulo para cada colaborador, garantindo extrema flexibilidade na operação.

**Dinâmica Top-Down de Feedbacks e Pontuação:**
Existe uma regra de ouro na avaliação de desempenho: O Vendedor está atrelado a uma Unidade/Gestor, e o Cliente está atrelado ao Vendedor. Todas as notas e feedbacks são imputados EXCLUSIVAMENTE pelo Gestor da Unidade (ou Admin) nas interfaces de `Gestão de Feedbacks` (RH) e `Pontuação de Vendedores` (CS). O Vendedor consome seus próprios dados passivamente e apenas em modo "Read-Only" em sua tela `/meu-desempenho`.

* **Administrador (Admin):** Visão, edição e controle absolutos sobre todas as Unidades, Financeiro, Usuários e Dashboards Globais.
* **Financeiro:** Acesso irrestrito a todos os Lançamentos e Propostas (cobrança, notas fiscais, faturamento e gestão de assinaturas).
* **Gestor / PL:** Visualiza e edita apenas a sua própria Unidade. Tem acesso aos relatórios da unidade, gerencia os colaboradores e avalia desempenhos.
* **Vendedor GC & Vendedor Terceirizado:** Acesso estritamente focado no Comercial (Funil e Contratos). Eles cadastram os leads, interações e propostas com o valor bruto da venda. **Não** acessam o módulo Financeiro geral.
* **SDR / Closer:** Acesso restrito ao Kanban de Prospecção (Funil) e agendamentos. Só visualizam Leads da sua Unidade.
* **Demais Colaboradores (CS, Operação, etc):** Acessam recursos baseados nas suas rotinas, ex: a equipe de CS foca na tabela `AnaliseCliente` e controle de Retenção.

*Nota de Rankings:* Ranking da Unidade baseia-se em (Nota Cliente + Nota PL) / 2. Rankings de Vendedores são isolados por tipo (`GC` x `Terceirizado`).

## 5. Estrutura de Rotas 2.0

**Principais Rotas da API (Backend):**
* `POST /login`: Autenticação e geração de JWT (com payloads dinâmicos).
* `GET, POST, PUT, DELETE /usuarios`: Gestão de usuários, metas, feedbacks e relatórios de subordinação (`gestorId`).
* `GET, POST, PUT, DELETE /unidades`: Gestão de polos, franquias e extração de snapshots.
* `GET, POST, PUT, DELETE /clientes`: Gestão de leads e clientes 360º.
* `GET, POST, PUT /financeiro`: Movimentação financeira, restrita e hierarquizada.
* `GET, POST, PUT /contratos`: Fluxo de vida da proposta.
* `GET, POST, PUT /avaliacoes`: RH. Avaliações de desempenho mensais (Colaborador x Mês).
* `GET, POST, PUT /analises-cliente`: CS. Saúde mensal de cada contrato.
* `GET, POST /cancelamentos`: Análise de Churn, motivos de quebra de contrato e resgate.
* `GET /alertas`: Central de notificações polimórfica baseada no cargo.
* `GET /dashboards`: Retorna dados específicos para montar a "Visão Meu Desempenho" (ex: Vendedor vê funil próprio, Gestor vê Unidade, Admin vê MRR Geral).

**Principais Telas (Frontend):**
* `/login`: Entrada.
* `/dashboard`: Painel mutável e reativo baseado na role (Admin Global, Gestão Local, Operacional).
* `/meu-desempenho`: Tela isolada (Read-Only) para os Vendedores acompanharem seus feedbacks e notas (Operação) recebidos de seu Gestor.
* **Módulo de Operações (Nova Estrutura Integrada):**
  * `/operacoes/dev`: Gestão e Projetos DEV.
  * `/operacoes/design`: Gestão de Demandas de Design.
  * `/operacoes/administracao`: Central Administrativa.
  * `/operacoes/marketing`: Campanhas e Relatórios de MKT.
  * `/funil`: Kanban de Vendas.
  * `/clientes`: Perfil 360º com Financeiro, CS e RH anexos.
  * `/financeiro`: Controle de Lançamentos e Propostas.
  * `/rh/equipe`: Listagem de colaboradores, avaliações, metas e organograma.
  * `/cs/saude`: Radar de clientes em risco e gestão de Churn (retenção).
* `/unidades`: Gestão dos polos e acompanhamento dos Snapshots Mensais.
* `/rankings`: Rankings comerciais / operacionais customizados.

## 6. Changelog Recente
* (09/10) [v2.2] Reestruturação da Navbar e Operações: Menus unificados sob a categoria "Operações". Criação de módulos expansíveis blindados para DEV, Design, Administração e Marketing.
* (09/10) [v2.1] Gestão de Pessoas (RH): Implementado fluxo top-down restrito de Feedbacks e Pontuações Operacionais. Gestores avaliam, Vendedores apenas visualizam em nova tela segregada (`/meu-desempenho`).
* (01/10) [v2.0] Refatoração de Propostas: Substituição da geração automática de PDFKit por upload manual de contratos (Multipart/Form-Data) com vínculo à tabela Documento.
* (01/10) [v2.0] Atualização de Escopo (ERP): PRD expandido (12 pilares) para abranger módulos de CS, RH, Permissões Granulares (RBAC) e novos dashboards inteligentes.
* (01/10) [v1.0] Proteção de Dados: Refatoração global da API (Soft Delete).
* (01/10) [v1.0] Infraestrutura Base: PostgreSQL e Tenant Isolation.
