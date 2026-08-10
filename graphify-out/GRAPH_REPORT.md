# Graph Report - ihubfood  (2026-08-10)

## Corpus Check
- 116 files · ~185,882 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1205 nodes · 1915 edges · 94 communities (82 shown, 12 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e4e2705a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Dashboard.jsx
- App.jsx
- Clientes.jsx
- index.js
- COLLECTIONS
- ControleSemanal.jsx
- Ranking.jsx
- Lojas.jsx
- Onboard.jsx
- dependencies
- Sidebar.jsx
- Financeiro.jsx
- CRM.jsx
- Gestores.jsx
- AssistenteChatContext.jsx
- Base de Conhecimento iFood
- MapaLojasModal.jsx
- Atividades.jsx
- devDependencies
- useToast
- Carteira.jsx
- HTML mode
- What You Must Do When Invoked
- Sistema de Gestão de Lojas Delivery
- functions/package.json
- useAuth
- manifest.json
- EnderecoFields.jsx
- Emil Kowalski's Animation Principles
- Modal.jsx
- Badge.jsx
- Audit Checklist
- limpar-dados-por-tag.js
- seed-super-admin.js
- LojaModal
- testFirebase.js
- dev-server.sh
- ImageUpload.jsx
- Workflow: Audit Mode
- firebase.js
- Jhey Tompkins' Animation Principles
- Design Motion Principles
- firebase-messaging-sw.js
- vite.config.js
- Workflow: Create Mode
- importar-cadastro.js
- Login.jsx
- design-motion-principles/SKILL.md
- graphify reference: extra exports and benchmark
- iHubFood Design System
- AI-Slop Motion Patterns
- Arquitetura iHubfood
- atualizar-clientes.js
- Anti-Checklist
- Creation Gotchas
- Jakub Krehel's Animation Principles
- Motion Cookbook
- 2. Easing & Timing
- 9. Clip-Path Animations (Emil)
- Performance
- buscarLojaPorNome
- AuthContext.jsx
- graphify reference: query, path, explain
- 10. Button & Interactive Feedback (Emil)
- 11. CSS Transitions vs Keyframes (Emil)
- STEP 1: Context Reconnaissance (DO THIS FIRST)
- useLembreteDiarioIOS.js
- 12. Spring Physics (Emil)
- 14. Scroll-Driven Animations (Jhey)
- 1. Enter & Exit Animations
- 3. Visual Effects
- 7. CSS Custom Properties & @property (Jhey)
- 8. 3D CSS (Jhey)
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- gerarCiclosContrato
- React + Vite
- corrigir-gestorid-resultados.js
- AvisoNovaVersao.jsx
- InstalarPWAiOS.jsx
- Toast.jsx
- Onboard
- diasDesde
- 6. Shared Layout Animations (Jakub)
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- Insights.jsx
- .claude/CLAUDE.md
- extraction-spec.md
- MENU_PERMISSIONS_VALIDAS

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 62 edges
2. `useToast()` - 41 edges
3. `db` - 35 edges
4. `COLLECTIONS` - 35 edges
5. `useModoTeste()` - 32 edges
6. `Dashboard()` - 22 edges
7. `Base de Conhecimento iFood` - 18 edges
8. `Skeleton()` - 17 edges
9. `Motion Cookbook` - 15 edges
10. `Modal()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `generatePDF()` --references--> `jspdf`  [EXTRACTED]
  src/pages/ControleSemanal.jsx → package.json
- `PrivateRoute()` --calls--> `useAuth()`  [EXTRACTED]
  src/App.jsx → src/contexts/AuthContext.jsx
- `MenuRoute()` --calls--> `useAuth()`  [EXTRACTED]
  src/App.jsx → src/contexts/AuthContext.jsx
- `NaoGestorRoute()` --calls--> `useAuth()`  [EXTRACTED]
  src/App.jsx → src/contexts/AuthContext.jsx
- `SuperAdminRoute()` --calls--> `useAuth()`  [EXTRACTED]
  src/App.jsx → src/contexts/AuthContext.jsx

## Import Cycles
- None detected.

## Communities (94 total, 12 thin omitted)

### Community 0 - "Dashboard.jsx"
Cohesion: 0.06
Nodes (42): Dashboard(), formatBRL(), formatBRLDecimal(), formatVar(), itemVariants, listVariants, lojaAtiva(), modalVariants (+34 more)

### Community 1 - "App.jsx"
Cohesion: 0.07
Nodes (25): App(), AppRoutes(), AssistenteDelivery, Atividades, Carteira, Clientes, Comparativo, Contratos (+17 more)

### Community 2 - "Clientes.jsx"
Cohesion: 0.06
Nodes (43): ConfirmModal(), modalVariants, overlayVariants, EMPTY_LOJA_CONTRATO_ITEM, formatBRL(), LojasContratoBuilder(), PLATAFORMA_COLORS, PLATAFORMAS_LOJA (+35 more)

### Community 3 - "index.js"
Cohesion: 0.05
Nodes (25): Anthropic, anthropicApiKey, auth, AUTH_ERROS_CRIACAO, BASE_CONHECIMENTO_IFOOD, db, { defineSecret }, fs (+17 more)

### Community 4 - "COLLECTIONS"
Cohesion: 0.20
Nodes (7): main(), normalizarNome(), CANONICO, __dirname, auth, COLLECTIONS, db

### Community 5 - "ControleSemanal.jsx"
Cohesion: 0.07
Nodes (31): agruparPorCliente(), buildColumns(), CalendarGrid(), CAMPOS_POR_PRINT, ControleSemanal(), DIAS, extrairPrintIndividual, formatCurrencyDisplay() (+23 more)

### Community 6 - "Ranking.jsx"
Cohesion: 0.06
Nodes (38): BaselineComparisonSection(), formatBRL(), formatDate(), GestorPerformanceCard(), ICONE_POR_CATEGORIA, ManagerActionsSection(), WeekColumn(), formatBRL() (+30 more)

### Community 7 - "Lojas.jsx"
Cohesion: 0.06
Nodes (22): CELL_HOVER_STYLE, ClienteCell(), DIA_LABEL, DIAS_RELATORIO, EMPTY_CLIENTE_FORM, EMPTY_FORM, EMPTY_LOJA_SUB, EMPTY_PRINTS (+14 more)

### Community 8 - "Onboard.jsx"
Cohesion: 0.08
Nodes (18): CHECKLIST_ITENS, ChecklistButton(), checklistProgress(), CHECKPOINTS_DIAS, CUPONS_TIPOS, DIAS_RELATORIO, EMPTY_AGENDAR_FORM, EMPTY_CHECKLIST (+10 more)

### Community 9 - "dependencies"
Cohesion: 0.07
Nodes (29): d3-geo, firebase, framer-motion, geojson-rewind, @hello-pangea/dnd, html2canvas, jspdf, leaflet (+21 more)

### Community 10 - "Sidebar.jsx"
Cohesion: 0.09
Nodes (21): MainContent(), DIA_OFFSET, getISOWeekStr(), loadCollapsedSections(), lojaAtiva(), NAV_CARTEIRA_ADMIN, NAV_CARTEIRA_TODOS, NAV_CRM (+13 more)

### Community 11 - "Financeiro.jsx"
Cohesion: 0.12
Nodes (25): aplicarPreset(), CalendarioPagamentos(), CobrancaModal(), COLUNAS_ORDENAVEIS, dateKey(), DIAS_SEMANA, fimDaSemana(), Financeiro() (+17 more)

### Community 12 - "CRM.jsx"
Cohesion: 0.10
Nodes (21): CRM(), EMPTY_LEAD_FORM, ESTAGIO_MAP, ESTAGIOS, ESTAGIOS_FECHADOS, FecharGanhoModal(), formatBRL(), formatDateTime() (+13 more)

### Community 13 - "Gestores.jsx"
Cohesion: 0.09
Nodes (17): MENU_PERMISSIONS, ACESSO_ERRORS, atualizarPermissoesSupervisorFn, AUTH_ERRORS, criarGestorFn, criarSupervisorFn, excluirGestorFn, GestorModal() (+9 more)

### Community 14 - "AssistenteChatContext.jsx"
Cohesion: 0.13
Nodes (19): AssistenteFloatingButton(), BOTAO_TAMANHO_MOBILE, panelVariants, panelVariantsMobile, posicaoInicial(), AssistenteChatPanel(), formatHora(), AssistenteChatContext (+11 more)

### Community 15 - "Base de Conhecimento iFood"
Cohesion: 0.06
Nodes (34): Anúncios, AVALIAÇÕES, Açaí, Base de Conhecimento iFood, Brasileira / Marmita, Campanha Desconto em Itens, Campanha Inteligente (CI), CANCELAMENTOS E CHAMADOS (+26 more)

### Community 16 - "MapaLojasModal.jsx"
Cohesion: 0.15
Nodes (13): BRASIL_CENTER, espalharColisoes(), iconesPorPosicao, MapaLojasModal(), overlayVariants, pinIcon(), TILE_DETALHADO, TILE_MARCA (+5 more)

### Community 17 - "Atividades.jsx"
Cohesion: 0.16
Nodes (13): Atividades(), EMPTY_TAREFA_FORM, formatDate(), formatDateTime(), itemVariants, listVariants, NovaTarefaModal(), pageVariants (+5 more)

### Community 18 - "devDependencies"
Cohesion: 0.05
Nodes (36): autoprefixer, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, devDependencies, autoprefixer (+28 more)

### Community 19 - "useToast"
Cohesion: 0.29
Nodes (7): useToast(), Gestores(), AgendarModal(), ChecklistModal(), CheckpointModal(), ConfirmIniciarModal(), PreGestaoModal()

### Community 20 - "Carteira.jsx"
Cohesion: 0.06
Nodes (40): Skeleton(), VarBadge(), useModoTeste(), calcVariacaoPeriodo(), Carteira(), DIAS_ORDEM, diffMonths(), formatBRL() (+32 more)

### Community 21 - "HTML mode"
Cohesion: 0.06
Nodes (33): 01 · Lens summary, 02 · Where the timings land — duration-budget diagram, 03–05 · Per-lens sections, 06 · Combined recommendations, 07 · Lens Reference Summary, Absolute bans, Canonical references, Combined Recommendations (+25 more)

### Community 22 - "What You Must Do When Invoked"
Cohesion: 0.07
Nodes (26): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+18 more)

### Community 23 - "Sistema de Gestão de Lojas Delivery"
Cohesion: 0.08
Nodes (24): Animações Framer Motion, /clientes (Admin), Coleções no Firestore, Componentes, /dashboard, Design system — regras obrigatórias, Estrutura de arquivos obrigatória, Filosofia (+16 more)

### Community 24 - "functions/package.json"
Cohesion: 0.10
Nodes (20): @anthropic-ai/sdk, firebase-functions, dependencies, @anthropic-ai/sdk, firebase-admin, firebase-functions, @google/genai, engines (+12 more)

### Community 25 - "useAuth"
Cohesion: 0.17
Nodes (15): LembretesGlobais(), LojasSemGestorAlerta(), MenuRoute(), NaoGestorRoute(), NotificacoesPushGlobal(), PrivateRoute(), PublicRoute(), SuperAdminRoute() (+7 more)

### Community 26 - "manifest.json"
Cohesion: 0.25
Nodes (7): background_color, display, icons, name, short_name, start_url, theme_color

### Community 27 - "EnderecoFields.jsx"
Cohesion: 0.36
Nodes (5): EMPTY_ENDERECO, EnderecoFields(), formatCep(), buscarNominatim(), geocodificar()

### Community 28 - "Emil Kowalski's Animation Principles"
Cohesion: 0.15
Nodes (12): Core Philosophy: Restraint & Purpose, Emil Kowalski's Animation Principles, Emil vs. Jakub vs. Jhey, Interruptibility, Invisible Quality: Lessons from Sonner & Vaul, Signature Techniques (decision context — code in cookbook), Sonner Defaults, Speed is Non-Negotiable (+4 more)

### Community 29 - "Modal.jsx"
Cohesion: 0.33
Nodes (5): AlterarSenhaModal(), ERROS_REAUTH, Modal(), modalVariants, overlayVariants

### Community 30 - "Badge.jsx"
Cohesion: 0.47
Nodes (4): Badge(), VARIANTS, ClienteSelect(), normalizar()

### Community 31 - "Audit Checklist"
Cohesion: 0.17
Nodes (12): Accessibility, Audit Checklist, Easing & Timing, Enter/Exit States, Interaction Patterns (Emil's Rules), Motion Gap Analysis (Check BEFORE Reviewing Existing Animations), Optical Alignment, Performance (+4 more)

### Community 32 - "limpar-dados-por-tag.js"
Cohesion: 0.50
Nodes (4): apagarColecao(), COLECOES, db, main()

### Community 34 - "LojaModal"
Cohesion: 0.67
Nodes (4): EditableDataInicioCell(), formatDate(), LojaModal(), tsToDateInput()

### Community 35 - "testFirebase.js"
Cohesion: 0.50
Nodes (3): app, auth, firebaseConfig

### Community 38 - "Workflow: Audit Mode"
Cohesion: 0.17
Nodes (11): 2a. Read the Audit Checklist First, 2b. Read Designer Files for Your Weighted Perspectives, 2c. Read Topical References as Needed, Agent Gotchas (Self-Check Before Writing the Report), Default behavior — write and open the HTML report, Required Reading, STEP 2: Full Audit (After User Confirms), STEP 3: Output Format (HTML by default) (+3 more)

### Community 39 - "firebase.js"
Cohesion: 0.20
Nodes (9): app, deleteImagem(), firebaseConfig, messaging, messagingPronto, secondaryApp, secondaryAuth, storage (+1 more)

### Community 40 - "Jhey Tompkins' Animation Principles"
Cohesion: 0.18
Nodes (11): Common Mistakes (Jhey's Perspective), Core Beliefs, Core Philosophy: Learn Through Play, Easing Has Personality (Decision Framework), Jhey Tompkins' Animation Principles, Jhey vs. Emil vs. Jakub, Signature Techniques (decision context — code in cookbook), The Golden Rule (Even in Play) (+3 more)

### Community 41 - "Design Motion Principles"
Cohesion: 0.18
Nodes (11): Accessibility is NOT Optional, Context-to-Perspective Mapping, Core Principles (Both Modes), Design Motion Principles, Duration Guidelines (Context-Dependent), Reference Index, STEP 0: Detect Mode (DO THIS FIRST), The Frequency Gate (+3 more)

### Community 47 - "Workflow: Create Mode"
Cohesion: 0.18
Nodes (10): Infer First, Ask Second, Propose Context + Weighting, Required Reading, STEP 1: Light Discovery, STEP 2: Load Weighted Knowledge, STEP 3: Generate, STEP 4: Self-Check, Success Criteria (+2 more)

### Community 48 - "importar-cadastro.js"
Cohesion: 0.31
Nodes (10): DIA_MAP, __dirname, extrairNomeLoja(), limparEspacos(), limparSeparadoresBordas(), main(), normalizarDia(), removerDiaFinal() (+2 more)

### Community 49 - "Login.jsx"
Cohesion: 0.27
Nodes (5): CoinSpinIntro(), LogoMark(), ERROR_MESSAGES, Login(), pageVariants

### Community 50 - "design-motion-principles/SKILL.md"
Cohesion: 0.22
Nodes (5): Accessibility, Functional vs. Decorative Motion, Implementation Checklist, Motion Sensitivity Considerations, Respect User Preferences

### Community 51 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 52 - "iHubFood Design System"
Cohesion: 0.22
Nodes (8): Before shipping a component, Brand tokens, Dashboard component patterns to pull in from references, iHubFood Design System, Layout pattern (locked in, don't deviate without reason), Restraint, Signature motif: the Hub, Visual hierarchy & UX rules

### Community 53 - "AI-Slop Motion Patterns"
Cohesion: 0.25
Nodes (8): AI-Slop Motion Patterns, Blur-everywhere entrances, Bouncy-springs-on-utility-actions, Hover-scale-on-everything, Motion-on-mount-for-static-content, Pulsing indicators, Stagger-spam-on-every-list, Uniform-fade-in-on-every-element

### Community 54 - "Arquitetura iHubfood"
Cohesion: 0.25
Nodes (7): 1. Multi-tenant / `organizacaoId`, 2. Controle de acesso por role, 3. Design visual, 4. Cloud Functions — padrão de function nova, 5. Checklist ao criar uma tela ou módulo novo, 6. Armadilhas já corrigidas neste projeto — não repetir, Arquitetura iHubfood

### Community 55 - "atualizar-clientes.js"
Cohesion: 0.46
Nodes (7): __dirname, encontrarPorId(), encontrarPorNome(), main(), nomesCorrespondem(), normalizarNome(), resolverLoja()

### Community 56 - "Anti-Checklist"
Cohesion: 0.29
Nodes (6): Anti-Checklist, From Emil's Perspective (Purposeful Restraint), From Jakub's Perspective (Production Polish), From Jhey's Perspective (Creative Learning), General Motion Design Mistakes, Red Flags in Code Review

### Community 57 - "Creation Gotchas"
Cohesion: 0.29
Nodes (6): Accessibility omissions, Context blindness, Creation Gotchas, Motion that shouldn't exist, Performance failures, Wrong defaults

### Community 58 - "Jakub Krehel's Animation Principles"
Cohesion: 0.29
Nodes (6): Common Mistakes (Jakub's Perspective), Core Philosophy: Invisible Enhancement, Jakub Krehel's Animation Principles, Jakub vs. Emil vs. Jhey, Signature Techniques (decision context — code in cookbook), When to Apply Jakub's Mindset

### Community 59 - "Motion Cookbook"
Cohesion: 0.29
Nodes (6): 13. Origin-Aware Animations (Emil), 4. Optical Alignment, 5. Icon & State Animations (Jakub), Contextual Icon Transitions, Geometric vs. Optical (Jakub), Motion Cookbook

### Community 60 - "2. Easing & Timing"
Cohesion: 0.29
Nodes (7): 2. Easing & Timing, Custom Easing is Essential (Emil), Duration Impacts Naturalness, Easing Selection Guidelines (Jhey), Spring Animations (Jakub), Stagger Techniques (Jhey), The linear() Function (Jhey)

### Community 61 - "9. Clip-Path Animations (Emil)"
Cohesion: 0.29
Nodes (7): 9. Clip-Path Animations (Emil), Basic Syntax, Image Reveal Effect, Scroll-Driven with clip-path, Tab Transitions, Text Mask Effect, Why clip-path?

### Community 62 - "Performance"
Cohesion: 0.29
Nodes (6): Animation Performance Budget, Gradient Animation Performance (Jakub), Performance, Performance Checklist, Properties to Avoid Animating, will-change Explained (Jakub)

### Community 63 - "buscarLojaPorNome"
Cohesion: 0.33
Nodes (7): buscarLojaPorNome(), candidatosLojaMencionada(), executarCriarTarefa(), normalizarTexto(), palavrasSignificativas(), queryLojasAcessiveis(), STOPWORDS_NOME_LOJA

### Community 64 - "AuthContext.jsx"
Cohesion: 0.33
Nodes (5): AuthContext, AuthProvider(), carregarPerfil(), ModoTesteContext, ModoTesteProvider()

### Community 65 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 66 - "10. Button & Interactive Feedback (Emil)"
Cohesion: 0.40
Nodes (5): 10. Button & Interactive Feedback (Emil), Blur as a Bridge, Don't Animate from scale(0), Scale on Press, Tooltip Delay Pattern

### Community 67 - "11. CSS Transitions vs Keyframes (Emil)"
Cohesion: 0.40
Nodes (5): 11. CSS Transitions vs Keyframes (Emil), Damping for Natural Boundaries, Direct Style Updates for Performance, Interruptibility Problem, Momentum-Based Dismissal

### Community 68 - "STEP 1: Context Reconnaissance (DO THIS FIRST)"
Cohesion: 0.40
Nodes (5): Gather Context, Motion Gap Analysis (CRITICAL - Don't Skip), State Your Inference, STEP 1: Context Reconnaissance (DO THIS FIRST), Wait for User Confirmation

### Community 69 - "useLembreteDiarioIOS.js"
Cohesion: 0.70
Nodes (4): chaveDoDia(), ehIOS(), ehPWAInstalada(), useLembreteDiarioIOS()

### Community 70 - "12. Spring Physics (Emil)"
Cohesion: 0.50
Nodes (4): 12. Spring Physics (Emil), Interruptibility, Key Parameters, Spring for Mouse Position

### Community 71 - "14. Scroll-Driven Animations (Jhey)"
Cohesion: 0.50
Nodes (4): 14. Scroll-Driven Animations (Jhey), Duration Control Pattern, Progressive Enhancement, The Core Problem

### Community 72 - "1. Enter & Exit Animations"
Cohesion: 0.50
Nodes (4): 1. Enter & Exit Animations, Enter Animation Recipe (Jakub), Exit Animation Subtlety (Jakub), Fill Mode for Persistence (Jhey)

### Community 73 - "3. Visual Effects"
Cohesion: 0.50
Nodes (4): 3. Visual Effects, Blur as a Signal (Jakub), Gradients & Color Spaces (Jakub), Shadows Instead of Borders (Jakub)

### Community 74 - "7. CSS Custom Properties & @property (Jhey)"
Cohesion: 0.50
Nodes (4): 7. CSS Custom Properties & @property (Jhey), Decompose Complex Transforms, Scoped Variables for Dynamic Behavior (Jhey), Type Specification Unlocks Animation

### Community 75 - "8. 3D CSS (Jhey)"
Cohesion: 0.50
Nodes (4): 8. 3D CSS (Jhey), Essential Setup, Responsive 3D, Think in Cuboids

### Community 76 - "graphify reference: add a URL and watch a folder"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 77 - "graphify reference: commit hook and native CLAUDE.md integration"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 78 - "graphify reference: incremental update and cluster-only"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

### Community 79 - "gerarCiclosContrato"
Cohesion: 0.50
Nodes (4): diaSeguroDoMes(), gerarCiclosContrato(), gerarCobrancasParaContrato(), proximaOcorrenciaSemanal()

### Community 80 - "React + Vite"
Cohesion: 0.50
Nodes (3): Expanding the ESLint configuration, React Compiler, React + Vite

### Community 81 - "corrigir-gestorid-resultados.js"
Cohesion: 0.83
Nodes (3): main(), NOMES_ALVO, normalizar()

### Community 83 - "InstalarPWAiOS.jsx"
Cohesion: 0.83
Nodes (3): ehIOS(), ehPWAInstalada(), InstalarPWAiOS()

### Community 84 - "Toast.jsx"
Cohesion: 0.50
Nodes (3): ICONS, ToastContext, ToastProvider()

### Community 85 - "Onboard"
Cohesion: 0.50
Nodes (4): agruparPorCliente(), formatDataHorario(), formatDate(), Onboard()

### Community 86 - "diasDesde"
Cohesion: 0.50
Nodes (4): checkpointDocId(), diasDesde(), LojaNovaCard(), LojasNovasView()

### Community 87 - "6. Shared Layout Animations (Jakub)"
Cohesion: 0.67
Nodes (3): 6. Shared Layout Animations (Jakub), Best Practices, FLIP Technique via layoutId

## Knowledge Gaps
- **564 isolated node(s):** `dev-server.sh script`, `PATH`, `{ onCall, HttpsError }`, `{ onDocumentWritten }`, `{ onSchedule }` (+559 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useAuth()` connect `useAuth` to `Dashboard.jsx`, `App.jsx`, `Clientes.jsx`, `ControleSemanal.jsx`, `Ranking.jsx`, `Lojas.jsx`, `Onboard.jsx`, `Sidebar.jsx`, `Financeiro.jsx`, `CRM.jsx`, `Gestores.jsx`, `AssistenteChatContext.jsx`, `Atividades.jsx`, `useToast`, `Carteira.jsx`, `Modal.jsx`, `firebase.js`, `Login.jsx`, `AuthContext.jsx`, `useLembreteDiarioIOS.js`, `Onboard`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `devDependencies`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **Why does `generatePDF()` connect `ControleSemanal.jsx` to `dependencies`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **What connects `dev-server.sh script`, `PATH`, `{ onCall, HttpsError }` to the rest of the system?**
  _564 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Dashboard.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05952380952380952 - nodes in this community are weakly interconnected._
- **Should `App.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06951871657754011 - nodes in this community are weakly interconnected._
- **Should `Clientes.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.061224489795918366 - nodes in this community are weakly interconnected._