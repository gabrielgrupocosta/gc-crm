# Graph Report - .  (2026-08-08)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 801 nodes · 1540 edges · 47 communities (39 shown, 8 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `bd443038`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 62 edges
2. `useToast()` - 40 edges
3. `db` - 34 edges
4. `COLLECTIONS` - 34 edges
5. `useModoTeste()` - 26 edges
6. `Dashboard()` - 22 edges
7. `Skeleton()` - 17 edges
8. `Carteira()` - 13 edges
9. `Financeiro()` - 13 edges
10. `Modal()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `generatePDF()` --references--> `jspdf`  [EXTRACTED]
  src/pages/ControleSemanal.jsx → package.json
- `PrivateRoute()` --calls--> `useAuth()`  [EXTRACTED]
  src/App.jsx → src/contexts/AuthContext.jsx
- `AdminRoute()` --calls--> `useAuth()`  [EXTRACTED]
  src/App.jsx → src/contexts/AuthContext.jsx
- `SuperAdminRoute()` --calls--> `useAuth()`  [EXTRACTED]
  src/App.jsx → src/contexts/AuthContext.jsx
- `PublicRoute()` --calls--> `useAuth()`  [EXTRACTED]
  src/App.jsx → src/contexts/AuthContext.jsx

## Import Cycles
- None detected.

## Communities (47 total, 8 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (45): calcVariacaoPeriodo(), Carteira(), DIAS_ORDEM, diffMonths(), formatBRL(), itemVariants, listVariants, MESES_PT (+37 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (41): AdminRoute(), App(), AppRoutes(), isMobileViewport(), LembretesGlobais(), LojasSemGestorAlerta(), NotificacoesPushGlobal(), PrivateRoute() (+33 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (43): ConfirmModal(), modalVariants, overlayVariants, EMPTY_LOJA_CONTRATO_ITEM, formatBRL(), LojasContratoBuilder(), PLATAFORMA_COLORS, PLATAFORMAS_LOJA (+35 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (36): Anthropic, anthropicApiKey, auth, AUTH_ERROS_CRIACAO, BASE_CONHECIMENTO_IFOOD, buscarLojaPorNome(), candidatosLojaMencionada(), db (+28 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (32): main(), normalizarNome(), __dirname, encontrarPorId(), encontrarPorNome(), main(), nomesCorrespondem(), normalizarNome() (+24 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (32): buildColumns(), CalendarGrid(), CAMPOS_POR_PRINT, ControleSemanal(), COR_BORDA_PLATAFORMA, corBordaCliente(), DIAS, extrairPrintIndividual (+24 more)

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (26): formatBRL(), formatDate(), formatPct(), GestorSummaryCard(), ICONE_POR_CATEGORIA, KpiSection(), ManagerActionsSection(), PERIODO_LABELS (+18 more)

### Community 7 - "Community 7"
Cohesion: 0.06
Nodes (22): CELL_HOVER_STYLE, ClienteCell(), DIA_LABEL, DIAS_RELATORIO, EMPTY_CLIENTE_FORM, EMPTY_FORM, EMPTY_LOJA_SUB, EMPTY_PRINTS (+14 more)

### Community 8 - "Community 8"
Cohesion: 0.08
Nodes (21): agruparPorCliente(), CHECKLIST_ITENS, ChecklistButton(), checklistProgress(), CUPONS_TIPOS, DIAS_RELATORIO, EMPTY_AGENDAR_FORM, EMPTY_CHECKLIST (+13 more)

### Community 9 - "Community 9"
Cohesion: 0.07
Nodes (29): d3-geo, firebase, framer-motion, geojson-rewind, @hello-pangea/dnd, html2canvas, jspdf, leaflet (+21 more)

### Community 10 - "Community 10"
Cohesion: 0.09
Nodes (21): MainContent(), DIA_OFFSET, getISOWeekStr(), loadCollapsedSections(), lojaAtiva(), NAV_CARTEIRA_ADMIN, NAV_CARTEIRA_TODOS, NAV_CRM (+13 more)

### Community 11 - "Community 11"
Cohesion: 0.12
Nodes (25): aplicarPreset(), CalendarioPagamentos(), CobrancaModal(), COLUNAS_ORDENAVEIS, dateKey(), DIAS_SEMANA, fimDaSemana(), Financeiro() (+17 more)

### Community 12 - "Community 12"
Cohesion: 0.10
Nodes (21): CRM(), EMPTY_LEAD_FORM, ESTAGIO_MAP, ESTAGIOS, ESTAGIOS_FECHADOS, FecharGanhoModal(), formatBRL(), formatDateTime() (+13 more)

### Community 13 - "Community 13"
Cohesion: 0.12
Nodes (14): ACESSO_ERRORS, AUTH_ERRORS, criarGestorFn, excluirGestorFn, GestorModal(), isProvavelUidAuth(), itemVariants, listVariants (+6 more)

### Community 14 - "Community 14"
Cohesion: 0.17
Nodes (15): AssistenteFloatingButton(), panelVariants, panelVariantsMobile, posicaoInicial(), AssistenteChatPanel(), formatHora(), useAssistenteChat(), AssistenteDelivery() (+7 more)

### Community 15 - "Community 15"
Cohesion: 0.12
Nodes (12): crescimentoAgregado(), FILTRO_LABELS, formatPct(), itemVariants, listVariants, media(), Metricas(), N_SEMANAS_POR_PERIODO (+4 more)

### Community 16 - "Community 16"
Cohesion: 0.15
Nodes (13): BRASIL_CENTER, espalharColisoes(), iconesPorPosicao, MapaLojasModal(), overlayVariants, pinIcon(), TILE_DETALHADO, TILE_MARCA (+5 more)

### Community 17 - "Community 17"
Cohesion: 0.14
Nodes (15): LojaSelect(), normalizar(), Atividades(), EMPTY_TAREFA_FORM, formatDate(), formatDateTime(), itemVariants, listVariants (+7 more)

### Community 18 - "Community 18"
Cohesion: 0.12
Nodes (17): @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, devDependencies, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh (+9 more)

### Community 19 - "Community 19"
Cohesion: 0.18
Nodes (12): ICONS, ToastContext, ToastProvider(), useToast(), AssistenteChatContext, assistenteChatFn, AssistenteChatProvider(), AgendarModal() (+4 more)

### Community 20 - "Community 20"
Cohesion: 0.26
Nodes (8): VarBadge(), ChartTooltip(), Comparativo(), computeVar(), formatBRL(), pageVariants, weekLabel(), formatVar()

### Community 21 - "Community 21"
Cohesion: 0.26
Nodes (10): BaselineComparisonSection(), formatBRL(), formatDate(), GestorPerformanceCard(), ICONE_POR_CATEGORIA, ManagerActionsSection(), WeekColumn(), calcularTempoDeGestao() (+2 more)

### Community 22 - "Community 22"
Cohesion: 0.19
Nodes (11): Skeleton(), useModoTeste(), EMPTY_FORM, Feedback(), formatDate(), itemVariants, listVariants, pageVariants (+3 more)

### Community 23 - "Community 23"
Cohesion: 0.20
Nodes (7): criarAdminOrg, formatBRL(), itemVariants, listVariants, Organizacoes(), pageVariants, STATUS_LABEL

### Community 24 - "Community 24"
Cohesion: 0.20
Nodes (10): @anthropic-ai/sdk, firebase-functions, dependencies, @anthropic-ai/sdk, firebase-admin, firebase-functions, @google/genai, @google/genai (+2 more)

### Community 25 - "Community 25"
Cohesion: 0.20
Nodes (9): name, private, scripts, build, dev, lint, preview, type (+1 more)

### Community 26 - "Community 26"
Cohesion: 0.25
Nodes (7): background_color, display, icons, name, short_name, start_url, theme_color

### Community 27 - "Community 27"
Cohesion: 0.36
Nodes (5): EMPTY_ENDERECO, EnderecoFields(), formatCep(), buscarNominatim(), geocodificar()

### Community 28 - "Community 28"
Cohesion: 0.29
Nodes (6): engines, node, main, name, private, type

### Community 29 - "Community 29"
Cohesion: 0.33
Nodes (5): AlterarSenhaModal(), ERROS_REAUTH, Modal(), modalVariants, overlayVariants

### Community 30 - "Community 30"
Cohesion: 0.47
Nodes (4): Badge(), VARIANTS, ClienteSelect(), normalizar()

### Community 31 - "Community 31"
Cohesion: 0.40
Nodes (5): scripts, deploy, logs, serve, shell

### Community 32 - "Community 32"
Cohesion: 0.50
Nodes (4): apagarColecao(), COLECOES, db, main()

### Community 34 - "Community 34"
Cohesion: 0.67
Nodes (4): EditableDataInicioCell(), formatDate(), LojaModal(), tsToDateInput()

### Community 35 - "Community 35"
Cohesion: 0.50
Nodes (3): app, auth, firebaseConfig

## Knowledge Gaps
- **270 isolated node(s):** `dev-server.sh script`, `PATH`, `{ onCall, HttpsError }`, `{ onDocumentWritten }`, `{ onSchedule }` (+265 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Community 9` to `Community 25`?**
  _High betweenness centrality (0.172) - this node is a cross-community bridge._
- **Why does `generatePDF()` connect `Community 5` to `Community 9`?**
  _High betweenness centrality (0.171) - this node is a cross-community bridge._
- **Why does `jspdf` connect `Community 9` to `Community 5`?**
  _High betweenness centrality (0.170) - this node is a cross-community bridge._
- **What connects `dev-server.sh script`, `PATH`, `{ onCall, HttpsError }` to the rest of the system?**
  _270 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06451612903225806 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06393442622950819 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.061224489795918366 - nodes in this community are weakly interconnected._