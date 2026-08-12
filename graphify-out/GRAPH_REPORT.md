# Graph Report - .  (2026-08-11)

## Corpus Check
- 69 files · ~213,074 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1278 nodes · 1998 edges · 105 communities (87 shown, 18 thin omitted)
- Extraction: 98% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 26 edges (avg confidence: 0.72)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Componentes UI compartilhados
- Cards de resumo de gestor
- Base de conhecimento iFood
- Página Onboard
- Página Controle Semanal
- Cloud Functions principais
- App.jsx e roteamento raiz
- Skill de motion — sumário de lentes
- Página Lojas
- Skill graphify — visão geral
- Dependências do package.json
- Permissões de menu do supervisor
- Página Financeiro
- Página CRM
- Sidebar de navegação
- Página Métricas e modo teste
- Página Carteira
- Página Dashboard
- Skill graphify — exports e query
- Assistente de delivery (chat)
- Skill graphify — clone/merge GitHub
- Modal de mapa de lojas
- Dashboard — utilitários de semana
- ESLint/PostCSS devDependencies
- Skill motion — anti-checklist e criadores
- Skill motion — workflow de auditoria
- Identidade visual (logo, splash, hero)
- Scripts de importação de lojas
- Página Atividades
- Skill motion — anti-checklist detalhado
- Toast e chat do assistente
- Skill ihubfood-design — visão geral
- Skill motion — checklist de auditoria
- Skill motion — cookbook (técnicas)
- Guards de rota (AuthContext)
- Card de performance do gestor
- Skill motion — princípios de Emil Kowalski
- Skill motion — princípios de Jhey Tompkins
- Skill motion — SKILL.md raiz
- Skill graphify — add/watch/transcribe
- Script de importação de cadastro
- Página Feedback e Skeleton
- Página Organizações
- Dependências de backend (Anthropic/Firebase/Gemini)
- Skill ihubfood-arquitetura — regras críticas
- Skill motion — acessibilidade
- Skill motion — workflow de criação
- package.json — metadados e scripts
- CLAUDE.md — visão geral do projeto
- firebase.js — inicialização
- CLAUDE.md — design system
- Skill ihubfood-design — tokens de marca
- manifest.json (PWA)
- Script de atualização de clientes
- Campos de endereço e geocodificação
- AuthContext e lembretes
- CLAUDE.md — módulos do sistema
- Skill motion — easing e timing
- Skill motion — clip-path
- Skill ihubfood-arquitetura — índice
- Cloud Functions — busca de loja por texto
- functions/package.json
- Modal base e troca de senha
- Skill motion — erros de criação
- Skill motion — princípios de Jakub Krehel
- Skill motion — performance
- Skill graphify — spec de extração
- Skill motion — feedback de botão
- Skill motion — transições CSS vs keyframes
- functions/package.json — scripts
- README.md
- Script de limpeza de dados por tag
- Hook de lembrete diário iOS
- Skill motion — física de spring
- Skill motion — animação por scroll
- Skill motion — animações de entrada/saída
- Skill motion — CSS custom properties
- Skill motion — CSS 3D
- index.html — entrada Vite
- Cloud Functions — ciclos de contrato
- Workflows de deploy (GitHub Actions)
- Script de correção de gestorId
- Script seed-super-admin
- Aviso de nova versão do app
- Instalação de PWA no iOS
- Modal de loja (edição)
- testFirebase.js
- dev-server.sh
- Upload de imagem
- Instalação de PWA no Android
- Hook de título de página
- Página Insights
- vite.config.js — versionamento de build
- Dependência ESLint
- Dependência @eslint/js
- Validação de permissões de menu (backend)
- Dependência @types/react
- Dependência @types/react-dom
- Service worker de mensagens Firebase
- Sprite de ícones SVG
- Ilustração do bot assistente
- Logo React (asset padrão)
- Logo Vite (asset padrão)

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 62 edges
2. `db` - 35 edges
3. `COLLECTIONS` - 35 edges
4. `useModoTeste()` - 32 edges
5. `useToast()` - 27 edges
6. `Dashboard()` - 23 edges
7. `Base de Conhecimento iFood` - 18 edges
8. `Motion Cookbook` - 15 edges
9. `Financeiro()` - 12 edges
10. `Audit Checklist` - 12 edges

## Surprising Connections (you probably didn't know these)
- `Sidebar()` --references--> `iHubFood Logo Mark (Icon-Only)`  [EXTRACTED]
  src/components/Layout/Sidebar.jsx → public/logo-mark.png
- `Firestore collections schema (users/clientes/lojas/resultados)` --conceptually_related_to--> `organizacaoId multi-tenant scoping pattern (custom auth claim via getIdTokenResult)`  [AMBIGUOUS]
  CLAUDE.md → .claude/skills/ihubfood-arquitetura/SKILL.md
- `LogoMark()` --references--> `iHubFood Logo Mark (Icon-Only)`  [EXTRACTED]
  src/components/UI/LogoMark.jsx → public/logo-mark.png
- `Vaul — Emil Kowalski's open-source drawer library` --conceptually_related_to--> `references/report-template.html — worked "Tally" audit report example`  [AMBIGUOUS]
  .claude/skills/design-motion-principles/references/emil-kowalski.md → .claude/skills/design-motion-principles/references/report-template.html
- `graphify claude install/uninstall (writes ## graphify section to CLAUDE.md)` --references--> `## graphify integration section (graphify query/update instructions)`  [INFERRED]
  .claude/skills/graphify/references/hooks.md → CLAUDE.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **The three weighted designer lenses (Emil Kowalski, Jakub Krehel, Jhey Tompkins) defined in SKILL.md and applied identically across Create and Audit workflows** — claude_skills_design_motion_principles_skill, claude_skills_design_motion_principles_references_emil_kowalski, claude_skills_design_motion_principles_references_jakub_krehel, claude_skills_design_motion_principles_references_jhey_tompkins [EXTRACTED 1.00]
- **The HTML motion-audit report pipeline: output-format.md's spec, demo-shell.html's per-finding template, report-template.html's worked example, and workflows/audit.md's STEP 3 that ties them together** — claude_skills_design_motion_principles_references_output_format, claude_skills_design_motion_principles_references_demo_shell, claude_skills_design_motion_principles_references_report_template, claude_skills_design_motion_principles_workflows_audit [EXTRACTED 1.00]
- **The audit's anti-pattern quality-gate system: anti-checklist.md's AI-slop categories, the frequency-gate concept, and workflows/audit.md applying both as flagging heuristics** — claude_skills_design_motion_principles_references_anti_checklist, claude_skills_design_motion_principles_references_anti_checklist_ai_slop_patterns, claude_skills_design_motion_principles_skill_frequency_gate, claude_skills_design_motion_principles_workflows_audit [INFERRED 0.75]
- **The mechanisms that keep the graph current over time: incremental --update flow, merge-graphs, the post-commit git hook, and the --watch folder watcher** — claude_skills_graphify_references_update_incremental_flow, claude_skills_graphify_references_github_and_merge_clone_merge, claude_skills_graphify_references_hooks_git_hook, claude_skills_graphify_references_add_watch_watch_mode [INFERRED 0.75]
- **The multi-tenant access-control pattern spanning ihubfood-arquitetura SKILL.md and root CLAUDE.md: organizacaoId scoping, its immutability guard, role booleans, and the gestorId ownership rule** — claude_skills_ihubfood_arquitetura_skill_organizacaoid_scoping, claude_skills_ihubfood_arquitetura_skill_organizacaoid_immutable_rule, claude_skills_ihubfood_arquitetura_skill_role_booleans, claude_gestorid_rule [INFERRED 0.85]
- **The iFood revenue-optimization knowledge cluster used together to diagnose and improve store performance: fee schedule, promotional levers, pricing formulas, and the sales-drop diagnostic checklist** — functions_base_conhecimento_ifood_repasse_taxas, functions_base_conhecimento_ifood_promotional_levers, functions_base_conhecimento_ifood_pricing_formulas, functions_base_conhecimento_ifood_sales_drop_checklist [INFERRED 0.85]

## Communities (105 total, 18 thin omitted)

### Community 0 - "Componentes UI compartilhados"
Cohesion: 0.05
Nodes (47): Badge(), VARIANTS, ClienteSelect(), normalizar(), ConfirmModal(), modalVariants, overlayVariants, EMPTY_LOJA_CONTRATO_ITEM (+39 more)

### Community 1 - "Cards de resumo de gestor"
Cohesion: 0.06
Nodes (36): formatBRL(), formatDate(), formatPct(), ICONE_POR_CATEGORIA, KpiSection(), ManagerActionsSection(), PERIODO_LABELS, PLATAFORMA_COLOR (+28 more)

### Community 2 - "Base de conhecimento iFood"
Cohesion: 0.05
Nodes (41): Anúncios, AVALIAÇÕES, Açaí, Base de Conhecimento iFood, Brasileira / Marmita, Campanha Desconto em Itens, Campanha Inteligente (CI), CANCELAMENTOS E CHAMADOS (+33 more)

### Community 3 - "Página Onboard"
Cohesion: 0.06
Nodes (26): agruparPorCliente(), CHECKLIST_ITENS, ChecklistButton(), checklistProgress(), checkpointDocId(), CHECKPOINTS_DIAS, CUPONS_TIPOS, DIAS_RELATORIO (+18 more)

### Community 4 - "Página Controle Semanal"
Cohesion: 0.08
Nodes (28): agruparPorCliente(), buildColumns(), CalendarGrid(), ControleSemanal(), DIAS, formatCurrencyDisplay(), formatDatetimeDisplay(), formatPeriodoPDF() (+20 more)

### Community 5 - "Cloud Functions principais"
Cohesion: 0.05
Nodes (25): Anthropic, anthropicApiKey, auth, AUTH_ERROS_CRIACAO, BASE_CONHECIMENTO_IFOOD, db, { defineSecret }, fs (+17 more)

### Community 6 - "App.jsx e roteamento raiz"
Cohesion: 0.07
Nodes (22): App(), AssistenteDelivery, Atividades, Carteira, Clientes, Comparativo, Contratos, ControleSemanal (+14 more)

### Community 7 - "Skill de motion — sumário de lentes"
Cohesion: 0.06
Nodes (32): 01 · Lens summary, 02 · Where the timings land — duration-budget diagram, 03–05 · Per-lens sections, 06 · Combined recommendations, 07 · Lens Reference Summary, Absolute bans, Canonical references, Combined Recommendations (+24 more)

### Community 8 - "Página Lojas"
Cohesion: 0.07
Nodes (20): CELL_HOVER_STYLE, ClienteCell(), DIA_LABEL, DIAS_RELATORIO, EMPTY_CLIENTE_FORM, EMPTY_FORM, EMPTY_LOJA_SUB, EMPTY_PRINTS (+12 more)

### Community 9 - "Skill graphify — visão geral"
Cohesion: 0.07
Nodes (27): graphify, For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands (+19 more)

### Community 10 - "Dependências do package.json"
Cohesion: 0.07
Nodes (29): d3-geo, firebase, framer-motion, geojson-rewind, @hello-pangea/dnd, html2canvas, jspdf, leaflet (+21 more)

### Community 11 - "Permissões de menu do supervisor"
Cohesion: 0.09
Nodes (18): MENU_PERMISSIONS, ACESSO_ERRORS, atualizarPermissoesSupervisorFn, AUTH_ERRORS, criarGestorFn, criarSupervisorFn, excluirGestorFn, Gestores() (+10 more)

### Community 12 - "Página Financeiro"
Cohesion: 0.12
Nodes (25): aplicarPreset(), CalendarioPagamentos(), CobrancaModal(), COLUNAS_ORDENAVEIS, dateKey(), DIAS_SEMANA, fimDaSemana(), Financeiro() (+17 more)

### Community 13 - "Página CRM"
Cohesion: 0.10
Nodes (21): CRM(), EMPTY_LEAD_FORM, ESTAGIO_MAP, ESTAGIOS, ESTAGIOS_FECHADOS, FecharGanhoModal(), formatBRL(), formatDateTime() (+13 more)

### Community 14 - "Sidebar de navegação"
Cohesion: 0.11
Nodes (17): DIA_OFFSET, getISOWeekStr(), loadCollapsedSections(), lojaAtiva(), NAV_CARTEIRA_ADMIN, NAV_CARTEIRA_TODOS, NAV_CRM, NAV_GESTAO (+9 more)

### Community 15 - "Página Métricas e modo teste"
Cohesion: 0.11
Nodes (15): ModoTesteContext, useModoTeste(), crescimentoAgregado(), FILTRO_LABELS, formatPct(), itemVariants, listVariants, media() (+7 more)

### Community 16 - "Página Carteira"
Cohesion: 0.13
Nodes (19): calcVariacaoPeriodo(), Carteira(), DIAS_ORDEM, diffMonths(), formatBRL(), itemVariants, listVariants, MESES_PT (+11 more)

### Community 17 - "Página Dashboard"
Cohesion: 0.10
Nodes (10): formatBRL(), formatVar(), itemVariants, listVariants, ModalRelatorio(), modalVariants, pageVariants, RANKING_SORT_LABELS (+2 more)

### Community 18 - "Skill graphify — exports e query"
Cohesion: 0.10
Nodes (19): graphify benchmark (gated on >5000 words), graphify export wiki|neo4j|falkordb|svg|graphml, graphify reference: extra exports and benchmark, graphify.serve MCP server (query_graph, get_node, get_neighbors, get_community, god_nodes, graph_stats, shortest_path), Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag) (+11 more)

### Community 19 - "Assistente de delivery (chat)"
Cohesion: 0.15
Nodes (15): AssistenteFloatingButton(), BOTAO_TAMANHO_MOBILE, panelVariants, panelVariantsMobile, posicaoInicial(), AssistenteChatPanel(), formatHora(), useAssistenteChat() (+7 more)

### Community 20 - "Skill graphify — clone/merge GitHub"
Cohesion: 0.11
Nodes (16): ## graphify integration section (graphify query/update instructions), --backend gemini|kimi|openai|deepseek|claude-cli options, graphify clone / graphify merge-graphs, graphify reference: GitHub clone and cross-repo merge, per-subfolder graphify extract ./core/ pattern for monorepos, Step 0 - Clone GitHub repo(s) (only if a GitHub URL was given), graphify claude install/uninstall (writes ## graphify section to CLAUDE.md), For git commit hook (+8 more)

### Community 21 - "Modal de mapa de lojas"
Cohesion: 0.14
Nodes (13): BRASIL_CENTER, espalharColisoes(), iconesPorPosicao, MapaLojasModal(), overlayVariants, pinIcon(), TILE_DETALHADO, TILE_MARCA (+5 more)

### Community 22 - "Dashboard — utilitários de semana"
Cohesion: 0.22
Nodes (18): crescimentoAgregado(), Dashboard(), formatBRLDecimal(), lojaAtiva(), formatWeekPeriod(), formatWeekPeriodFull(), getDashboardWeekOptions(), getISOWeekStr() (+10 more)

### Community 23 - "ESLint/PostCSS devDependencies"
Cohesion: 0.12
Nodes (17): autoprefixer, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, devDependencies, autoprefixer, eslint-plugin-react-hooks, eslint-plugin-react-refresh (+9 more)

### Community 24 - "Skill motion — anti-checklist e criadores"
Cohesion: 0.35
Nodes (7): AI-Slop Motion Patterns — 7 recognizable AI-generated-UI motion fingerprints, Sonner — Emil Kowalski's open-source toast library, Vaul — Emil Kowalski's open-source drawer library, Context-to-Perspective Mapping table (project type → designer weighting), Frequency Gate — interaction-frequency-driven animation decision rule, The Golden Rule — "The best animation is that which goes unnoticed", Motion Gap Analysis — detecting missing animations on conditional renders

### Community 25 - "Skill motion — workflow de auditoria"
Cohesion: 0.12
Nodes (16): 2a. Read the Audit Checklist First, 2b. Read Designer Files for Your Weighted Perspectives, 2c. Read Topical References as Needed, Agent Gotchas (Self-Check Before Writing the Report), Default behavior — write and open the HTML report, Gather Context, Motion Gap Analysis (CRITICAL - Don't Skip), Required Reading (+8 more)

### Community 26 - "Identidade visual (logo, splash, hero)"
Cohesion: 0.17
Nodes (9): iHubFood Favicon Logo, iHubFood Logo (Hexagon Pin + Bar Chart Icon), iHubFood Logo Mark (Icon-Only), Hero Illustration (Floating Isometric Card), CoinSpinIntro(), LogoMark(), ERROR_MESSAGES, Login() (+1 more)

### Community 27 - "Scripts de importação de lojas"
Cohesion: 0.20
Nodes (7): main(), normalizarNome(), CANONICO, __dirname, auth, COLLECTIONS, db

### Community 28 - "Página Atividades"
Cohesion: 0.16
Nodes (13): Atividades(), EMPTY_TAREFA_FORM, formatDate(), formatDateTime(), itemVariants, listVariants, NovaTarefaModal(), pageVariants (+5 more)

### Community 29 - "Skill motion — anti-checklist detalhado"
Cohesion: 0.14
Nodes (14): AI-Slop Motion Patterns, Anti-Checklist, Blur-everywhere entrances, Bouncy-springs-on-utility-actions, From Emil's Perspective (Purposeful Restraint), From Jakub's Perspective (Production Polish), From Jhey's Perspective (Creative Learning), General Motion Design Mistakes (+6 more)

### Community 30 - "Toast e chat do assistente"
Cohesion: 0.20
Nodes (11): ICONS, ToastContext, ToastProvider(), useToast(), AssistenteChatContext, assistenteChatFn, AssistenteChatProvider(), useNotificacoesPush() (+3 more)

### Community 31 - "Skill ihubfood-design — visão geral"
Cohesion: 0.19
Nodes (12): design system tokens (colors/typography/layout/components), Firestore collections schema (users/clientes/lojas/resultados), Framer Motion variant code blocks (pageVariants/listVariants/modalVariants), ISO week rule (segunda a domingo), PROIBIDO list of banned visual/UX patterns, ihubfood-design SKILL.md, dashboard component patterns (radial progress ring, semicircle gauge, sparkline, category donut), Hub motif (hexagonal pin + bar chart + connected nodes) usage rules (+4 more)

### Community 32 - "Skill motion — checklist de auditoria"
Cohesion: 0.15
Nodes (12): Accessibility, Audit Checklist, Easing & Timing, Enter/Exit States, Interaction Patterns (Emil's Rules), Motion Gap Analysis (Check BEFORE Reviewing Existing Animations), Optical Alignment, Performance (+4 more)

### Community 33 - "Skill motion — cookbook (técnicas)"
Cohesion: 0.15
Nodes (13): 13. Origin-Aware Animations (Emil), 3. Visual Effects, 4. Optical Alignment, 5. Icon & State Animations (Jakub), 6. Shared Layout Animations (Jakub), Best Practices, Blur as a Signal (Jakub), Contextual Icon Transitions (+5 more)

### Community 34 - "Guards de rota (AuthContext)"
Cohesion: 0.17
Nodes (12): LembretesGlobais(), LojasSemGestorAlerta(), MenuRoute(), NaoGestorRoute(), NotificacoesPushGlobal(), PrivateRoute(), PublicRoute(), SuperAdminRoute() (+4 more)

### Community 35 - "Card de performance do gestor"
Cohesion: 0.26
Nodes (10): BaselineComparisonSection(), formatBRL(), formatDate(), GestorPerformanceCard(), ICONE_POR_CATEGORIA, ManagerActionsSection(), WeekColumn(), calcularTempoDeGestao() (+2 more)

### Community 36 - "Skill motion — princípios de Emil Kowalski"
Cohesion: 0.17
Nodes (12): Core Philosophy: Restraint & Purpose, Emil Kowalski's Animation Principles, Emil vs. Jakub vs. Jhey, Interruptibility, Invisible Quality: Lessons from Sonner & Vaul, Signature Techniques (decision context — code in cookbook), Sonner Defaults, Speed is Non-Negotiable (+4 more)

### Community 37 - "Skill motion — princípios de Jhey Tompkins"
Cohesion: 0.18
Nodes (11): Common Mistakes (Jhey's Perspective), Core Beliefs, Core Philosophy: Learn Through Play, Easing Has Personality (Decision Framework), Jhey Tompkins' Animation Principles, Jhey vs. Emil vs. Jakub, Signature Techniques (decision context — code in cookbook), The Golden Rule (Even in Play) (+3 more)

### Community 38 - "Skill motion — SKILL.md raiz"
Cohesion: 0.18
Nodes (11): Accessibility is NOT Optional, Context-to-Perspective Mapping, Core Principles (Both Modes), Design Motion Principles, Duration Guidelines (Context-Dependent), Reference Index, STEP 0: Detect Mode (DO THIS FIRST), The Frequency Gate (+3 more)

### Community 39 - "Skill graphify — add/watch/transcribe"
Cohesion: 0.18
Nodes (9): For /graphify add, For --watch, graphify reference: add a URL and watch a folder, ingest() URL/author/contributor ingestion, --watch folder watcher (graphify.watch module, 3s debounce), GRAPHIFY_WHISPER_MODEL / GRAPHIFY_WHISPER_PROMPT env vars, graphify reference: transcribe video and audio, Step 2.5 - Transcribe video / audio files (only if video files detected) (+1 more)

### Community 40 - "Script de importação de cadastro"
Cohesion: 0.31
Nodes (10): DIA_MAP, __dirname, extrairNomeLoja(), limparEspacos(), limparSeparadoresBordas(), main(), normalizarDia(), removerDiaFinal() (+2 more)

### Community 41 - "Página Feedback e Skeleton"
Cohesion: 0.22
Nodes (9): Skeleton(), EMPTY_FORM, Feedback(), formatDate(), itemVariants, listVariants, pageVariants, TIPO_LABEL (+1 more)

### Community 42 - "Página Organizações"
Cohesion: 0.20
Nodes (7): criarAdminOrg, formatBRL(), itemVariants, listVariants, Organizacoes(), pageVariants, STATUS_LABEL

### Community 43 - "Dependências de backend (Anthropic/Firebase/Gemini)"
Cohesion: 0.20
Nodes (10): @anthropic-ai/sdk, firebase-functions, dependencies, @anthropic-ai/sdk, firebase-admin, firebase-functions, @google/genai, @google/genai (+2 more)

### Community 44 - "Skill ihubfood-arquitetura — regras críticas"
Cohesion: 0.27
Nodes (10): gestorId === auth.currentUser.uid access rule (critical business rule #1), ihubfood-arquitetura SKILL.md, exigirSuperAdmin/exigirAdminDaOrg Cloud Function auth helpers, 7-step checklist for creating a new screen/module, missing organizacaoId filter in new query (most recurring project bug), organizacaoId immutable-on-update double-check in firestore.rules, organizacaoId multi-tenant scoping pattern (custom auth claim via getIdTokenResult), legacy perfil vs role field bug (repeated across >=8 screens) (+2 more)

### Community 45 - "Skill motion — acessibilidade"
Cohesion: 0.22
Nodes (8): Accessibility, Functional vs. Decorative Motion, Implementation Checklist, Motion Sensitivity Considerations, prefers-reduced-motion CSS media query implementation, Respect User Preferences, references/demo-shell.html — single per-finding demo card template, references/report-template.html — worked "Tally" audit report example

### Community 46 - "Skill motion — workflow de criação"
Cohesion: 0.20
Nodes (10): Infer First, Ask Second, Propose Context + Weighting, Required Reading, STEP 1: Light Discovery, STEP 2: Load Weighted Knowledge, STEP 3: Generate, STEP 4: Self-Check, Success Criteria (+2 more)

### Community 47 - "package.json — metadados e scripts"
Cohesion: 0.20
Nodes (9): name, private, scripts, build, dev, lint, preview, type (+1 more)

### Community 48 - "CLAUDE.md — visão geral do projeto"
Cohesion: 0.22
Nodes (9): Coleções no Firestore, Estrutura de arquivos obrigatória, graphify, O que é esse projeto, Ordem de geração dos arquivos, Perfis de usuário, Regras de negócio críticas, Sistema de Gestão de Lojas Delivery (+1 more)

### Community 49 - "firebase.js — inicialização"
Cohesion: 0.22
Nodes (7): app, deleteImagem(), firebaseConfig, secondaryApp, secondaryAuth, storage, uploadImagem()

### Community 50 - "CLAUDE.md — design system"
Cohesion: 0.25
Nodes (8): Animações Framer Motion, Componentes, Design system — regras obrigatórias, Filosofia, Layout, Paleta de cores, PROIBIDO — nunca fazer isso, Tipografia

### Community 51 - "Skill ihubfood-design — tokens de marca"
Cohesion: 0.25
Nodes (8): Before shipping a component, Brand tokens, Dashboard component patterns to pull in from references, iHubFood Design System, Layout pattern (locked in, don't deviate without reason), Restraint, Signature motif: the Hub, Visual hierarchy & UX rules

### Community 52 - "manifest.json (PWA)"
Cohesion: 0.25
Nodes (7): background_color, display, icons, name, short_name, start_url, theme_color

### Community 53 - "Script de atualização de clientes"
Cohesion: 0.46
Nodes (7): __dirname, encontrarPorId(), encontrarPorNome(), main(), nomesCorrespondem(), normalizarNome(), resolverLoja()

### Community 54 - "Campos de endereço e geocodificação"
Cohesion: 0.36
Nodes (5): EMPTY_ENDERECO, EnderecoFields(), formatCep(), buscarNominatim(), geocodificar()

### Community 55 - "AuthContext e lembretes"
Cohesion: 0.36
Nodes (6): AuthContext, AuthProvider(), carregarPerfil(), dateOnlyLte(), tsToDate(), useLembretes()

### Community 56 - "CLAUDE.md — módulos do sistema"
Cohesion: 0.29
Nodes (7): /clientes (Admin), /dashboard, /gestores (Admin), /login, /lojas (Admin), Módulos do sistema, /resultados

### Community 57 - "Skill motion — easing e timing"
Cohesion: 0.29
Nodes (7): 2. Easing & Timing, Custom Easing is Essential (Emil), Duration Impacts Naturalness, Easing Selection Guidelines (Jhey), Spring Animations (Jakub), Stagger Techniques (Jhey), The linear() Function (Jhey)

### Community 58 - "Skill motion — clip-path"
Cohesion: 0.29
Nodes (7): 9. Clip-Path Animations (Emil), Basic Syntax, Image Reveal Effect, Scroll-Driven with clip-path, Tab Transitions, Text Mask Effect, Why clip-path?

### Community 59 - "Skill ihubfood-arquitetura — índice"
Cohesion: 0.29
Nodes (7): 1. Multi-tenant / `organizacaoId`, 2. Controle de acesso por role, 3. Design visual, 4. Cloud Functions — padrão de function nova, 5. Checklist ao criar uma tela ou módulo novo, 6. Armadilhas já corrigidas neste projeto — não repetir, Arquitetura iHubfood

### Community 60 - "Cloud Functions — busca de loja por texto"
Cohesion: 0.33
Nodes (7): buscarLojaPorNome(), candidatosLojaMencionada(), executarCriarTarefa(), normalizarTexto(), palavrasSignificativas(), queryLojasAcessiveis(), STOPWORDS_NOME_LOJA

### Community 61 - "functions/package.json"
Cohesion: 0.29
Nodes (6): engines, node, main, name, private, type

### Community 62 - "Modal base e troca de senha"
Cohesion: 0.33
Nodes (5): AlterarSenhaModal(), ERROS_REAUTH, Modal(), modalVariants, overlayVariants

### Community 63 - "Skill motion — erros de criação"
Cohesion: 0.33
Nodes (6): Accessibility omissions, Context blindness, Creation Gotchas, Motion that shouldn't exist, Performance failures, Wrong defaults

### Community 64 - "Skill motion — princípios de Jakub Krehel"
Cohesion: 0.33
Nodes (6): Common Mistakes (Jakub's Perspective), Core Philosophy: Invisible Enhancement, Jakub Krehel's Animation Principles, Jakub vs. Emil vs. Jhey, Signature Techniques (decision context — code in cookbook), When to Apply Jakub's Mindset

### Community 65 - "Skill motion — performance"
Cohesion: 0.33
Nodes (6): Animation Performance Budget, Gradient Animation Performance (Jakub), Performance, Performance Checklist, Properties to Avoid Animating, will-change Explained (Jakub)

### Community 66 - "Skill graphify — spec de extração"
Cohesion: 0.33
Nodes (5): EXTRACTED/INFERRED/AMBIGUOUS confidence rubric (discrete INFERRED buckets), graphify reference: extraction subagent prompt, hyperedge extraction rule (3+ nodes, max 3 per chunk), node ID format spec ({full_path_stem}_{entity}, lowercase [a-z0-9_]), semantically_similar_to edge rule (non-obvious cross-cutting overlap, 0.6-0.95)

### Community 67 - "Skill motion — feedback de botão"
Cohesion: 0.40
Nodes (5): 10. Button & Interactive Feedback (Emil), Blur as a Bridge, Don't Animate from scale(0), Scale on Press, Tooltip Delay Pattern

### Community 68 - "Skill motion — transições CSS vs keyframes"
Cohesion: 0.40
Nodes (5): 11. CSS Transitions vs Keyframes (Emil), Damping for Natural Boundaries, Direct Style Updates for Performance, Interruptibility Problem, Momentum-Based Dismissal

### Community 69 - "functions/package.json — scripts"
Cohesion: 0.40
Nodes (5): scripts, deploy, logs, serve, shell

### Community 70 - "README.md"
Cohesion: 0.40
Nodes (4): Expanding the ESLint configuration, React Compiler, React + Vite, generic Vite+React template content, not customized for iHubFood

### Community 71 - "Script de limpeza de dados por tag"
Cohesion: 0.50
Nodes (4): apagarColecao(), COLECOES, db, main()

### Community 72 - "Hook de lembrete diário iOS"
Cohesion: 0.70
Nodes (4): chaveDoDia(), ehIOS(), ehPWAInstalada(), useLembreteDiarioIOS()

### Community 73 - "Skill motion — física de spring"
Cohesion: 0.50
Nodes (4): 12. Spring Physics (Emil), Interruptibility, Key Parameters, Spring for Mouse Position

### Community 74 - "Skill motion — animação por scroll"
Cohesion: 0.50
Nodes (4): 14. Scroll-Driven Animations (Jhey), Duration Control Pattern, Progressive Enhancement, The Core Problem

### Community 75 - "Skill motion — animações de entrada/saída"
Cohesion: 0.50
Nodes (4): 1. Enter & Exit Animations, Enter Animation Recipe (Jakub), Exit Animation Subtlety (Jakub), Fill Mode for Persistence (Jhey)

### Community 76 - "Skill motion — CSS custom properties"
Cohesion: 0.50
Nodes (4): 7. CSS Custom Properties & @property (Jhey), Decompose Complex Transforms, Scoped Variables for Dynamic Behavior (Jhey), Type Specification Unlocks Animation

### Community 77 - "Skill motion — CSS 3D"
Cohesion: 0.50
Nodes (4): 8. 3D CSS (Jhey), Essential Setup, Responsive 3D, Think in Cuboids

### Community 78 - "index.html — entrada Vite"
Cohesion: 0.50
Nodes (4): React+Vite/Tailwind v3/Firebase/React Router v6/Recharts/Framer Motion/Lucide/Manrope stack, index.html Vite entry point, Manrope Google Font preconnect + stylesheet load, PWA-style meta tags + no-pinch-zoom viewport

### Community 79 - "Cloud Functions — ciclos de contrato"
Cohesion: 0.50
Nodes (4): diaSeguroDoMes(), gerarCiclosContrato(), gerarCobrancasParaContrato(), proximaOcorrenciaSemanal()

### Community 80 - "Workflows de deploy (GitHub Actions)"
Cohesion: 0.50
Nodes (4): Firebase Hosting merge-to-master deploy workflow, build_and_deploy job (npm ci && npm run build, deploy channelId live to project ihubfood), Firebase Hosting PR preview deploy workflow, build_and_preview job (gated on same-repo PR head)

### Community 81 - "Script de correção de gestorId"
Cohesion: 0.83
Nodes (3): main(), NOMES_ALVO, normalizar()

### Community 84 - "Instalação de PWA no iOS"
Cohesion: 0.83
Nodes (3): ehIOS(), ehPWAInstalada(), InstalarPWAiOS()

### Community 85 - "Modal de loja (edição)"
Cohesion: 0.67
Nodes (4): EditableDataInicioCell(), formatDate(), LojaModal(), tsToDateInput()

### Community 86 - "testFirebase.js"
Cohesion: 0.50
Nodes (3): app, auth, firebaseConfig

## Ambiguous Edges - Review These
- `.claude/CLAUDE.md` → `design-motion-principles/SKILL.md`  [AMBIGUOUS]
  .claude/CLAUDE.md · relation: conceptually_related_to
- `CLAUDE.md` → `generic Vite+React template content, not customized for iHubFood`  [AMBIGUOUS]
  README.md · relation: conceptually_related_to
- `references/report-template.html — worked "Tally" audit report example` → `Vaul — Emil Kowalski's open-source drawer library`  [AMBIGUOUS]
  .claude/skills/design-motion-principles/references/report-template.html · relation: conceptually_related_to
- `organizacaoId multi-tenant scoping pattern (custom auth claim via getIdTokenResult)` → `Firestore collections schema (users/clientes/lojas/resultados)`  [AMBIGUOUS]
  CLAUDE.md · relation: conceptually_related_to

## Knowledge Gaps
- **592 isolated node(s):** `dev-server.sh script`, `PATH`, `name`, `private`, `type` (+587 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `.claude/CLAUDE.md` and `design-motion-principles/SKILL.md`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `CLAUDE.md` and `generic Vite+React template content, not customized for iHubFood`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `references/report-template.html — worked "Tally" audit report example` and `Vaul — Emil Kowalski's open-source drawer library`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `organizacaoId multi-tenant scoping pattern (custom auth claim via getIdTokenResult)` and `Firestore collections schema (users/clientes/lojas/resultados)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `useAuth()` connect `Guards de rota (AuthContext)` to `Componentes UI compartilhados`, `Cards de resumo de gestor`, `Página Onboard`, `Página Controle Semanal`, `App.jsx e roteamento raiz`, `Página Lojas`, `Permissões de menu do supervisor`, `Página Financeiro`, `Página CRM`, `Sidebar de navegação`, `Página Métricas e modo teste`, `Página Carteira`, `Página Dashboard`, `Dashboard — utilitários de semana`, `Identidade visual (logo, splash, hero)`, `Página Atividades`, `Toast e chat do assistente`, `Página Feedback e Skeleton`, `Página Organizações`, `AuthContext e lembretes`, `Modal base e troca de senha`, `Hook de lembrete diário iOS`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `Motion Cookbook` connect `Skill motion — cookbook (técnicas)` to `Skill motion — feedback de botão`, `Skill motion — transições CSS vs keyframes`, `Skill motion — física de spring`, `Skill motion — animação por scroll`, `Skill motion — animações de entrada/saída`, `Skill motion — CSS custom properties`, `Skill motion — CSS 3D`, `Skill motion — anti-checklist e criadores`, `Skill motion — easing e timing`, `Skill motion — clip-path`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `db` connect `Scripts de importação de lojas` to `Componentes UI compartilhados`, `Cards de resumo de gestor`, `Página Onboard`, `Página Controle Semanal`, `Página Lojas`, `Permissões de menu do supervisor`, `Página Financeiro`, `Página CRM`, `Sidebar de navegação`, `Página Métricas e modo teste`, `Página Carteira`, `Página Dashboard`, `Modal de mapa de lojas`, `Dashboard — utilitários de semana`, `Página Atividades`, `Toast e chat do assistente`, `Guards de rota (AuthContext)`, `Card de performance do gestor`, `Script de importação de cadastro`, `Página Feedback e Skeleton`, `Página Organizações`, `firebase.js — inicialização`, `Script de atualização de clientes`, `AuthContext e lembretes`, `Hook de lembrete diário iOS`, `Script de correção de gestorId`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._