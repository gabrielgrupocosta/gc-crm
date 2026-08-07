# Sistema de Gestão de Lojas Delivery

## O que é esse projeto
Sistema web interno para uma empresa de consultoria em delivery (iFood, 99Food, Keeta).
Gestores cadastram resultados semanais das lojas que gerenciam. Admin visualiza tudo num dashboard com ranking.

---

## Stack — use exatamente essa, sem substituições

- **React + Vite** (JavaScript puro — zero TypeScript)
- **Tailwind CSS v3**
- **Firebase** — Firestore (banco) + Authentication (login)
- **React Router v6** — roteamento
- **Recharts** — gráficos
- **Framer Motion** — animações
- **Lucide React** — ícones
- **Fonte:** Manrope (única família, corpo e números) via Google Fonts

---

## Estrutura de arquivos obrigatória

```
src/
├── components/
│   ├── Layout/
│   │   ├── Sidebar.jsx
│   │   └── TopBar.jsx
│   └── UI/
│       ├── Modal.jsx
│       ├── Table.jsx
│       ├── Badge.jsx
│       ├── Toast.jsx
│       └── Skeleton.jsx
├── pages/
│   ├── Login.jsx
│   ├── Dashboard.jsx
│   ├── Clientes.jsx
│   ├── Lojas.jsx
│   ├── Resultados.jsx
│   └── Gestores.jsx
├── contexts/
│   └── AuthContext.jsx
├── hooks/
│   └── useFirestore.js
├── services/
│   └── firebase.js
└── App.jsx
```

---

## Perfis de usuário

**Admin**
- Acesso total ao sistema
- Cadastra clientes, lojas, gestores
- Vê dados de todas as lojas
- Pode editar qualquer resultado

**Gestor**
- Acesso restrito — só vê lojas atribuídas a ele
- Lança resultados semanais das suas lojas
- Não acessa módulos de cadastro

Regra crítica: o campo `gestorId` no documento da loja no Firestore determina o acesso. Gestor logado só lê/escreve documentos onde `gestorId === auth.currentUser.uid`.

---

## Módulos do sistema

### /login
- E-mail e senha via Firebase Auth
- Após login: redireciona para /dashboard
- Rota pública — única acessível sem autenticação

### /dashboard
**Admin vê:**
- 4 cards KPI: lojas ativas, clientes, média de variação da semana, % relatórios enviados
- Ranking de todas as lojas ordenado por variação % da semana atual
- Gráfico de barras: faturamento bruto por loja na semana atual
- Gráfico de linha: evolução das últimas 8 semanas
- Filtro por gestor
- Alerta em vermelho se há lojas sem relatório na semana corrente

**Gestor vê:**
- Mesmos cards KPI, mas só das suas lojas
- Ranking só das suas lojas
- Checklist: quais lojas já tiveram resultado lançado na semana atual

### /resultados
- Dropdown de loja (gestor vê só as suas)
- Seletor de semana ISO (segunda a domingo), ex: "Semana 22 — 27/05 a 02/06"
- Campo faturamento bruto (R$, decimal)
- Campo variação % vs semana anterior (aceita negativo)
- Toggle "relatório enviado ao cliente?" (sim/não)
- Textarea observações
- Regra: bloquear duplicata (mesma loja + mesma semana)
- Abaixo do formulário: tabela com os últimos lançamentos da loja selecionada

### /lojas (Admin)
- Campos: nome, cliente vinculado, gestor responsável, plataforma (iFood/Rappi/Uber Eats/Outro), segmento, status (Ativa/Pausada/Cancelada), data início, observações
- Listagem com busca por nome + filtro por gestor + filtro por status
- CRUD completo em modal

### /clientes (Admin)
- Campos: nome, telefone, e-mail, status (Ativo/Inativo/Inadimplente), data início contrato, valor mensalidade, observações
- Listagem com busca por nome + filtro por status
- CRUD completo em modal
- Cada cliente pode ter múltiplas lojas

### /gestores (Admin)
- Campos: nome completo, e-mail, lojas atribuídas (multiselect), status (Ativo/Inativo)
- Criação de conta via Firebase Auth
- Listagem com quantidade de lojas por gestor

---

## Regras de negócio críticas

1. Gestor só acessa lojas onde `gestorId === auth.currentUser.uid`
2. Semana segue padrão ISO: segunda a domingo
3. Variação % armazenada como número: -12.5 ou 8.3 (não como string)
4. Variação positiva → cor #00C896 com prefixo "▲". Negativa → #DC2626 com prefixo "▼"
5. "Relatório enviado" é por loja por semana — campo booleano no documento do resultado
6. Nunca deletar dados — usar campo `status: 'inativo'` para arquivar
7. Admin edita tudo; gestor só edita resultados das suas lojas

---

## Coleções no Firestore

```
users/          {uid, nome, email, perfil: 'admin'|'gestor', status, criadoEm}
clientes/       {nome, telefone, email, status, dataInicio, mensalidade, observacoes}
lojas/          {nome, clienteId, gestorId, plataforma, segmento, status, dataInicio, observacoes}
resultados/     {lojaId, gestorId, semana, dataInicio, dataFim, faturamento, variacao, relatorioEnviado, observacoes, criadoEm}
```

Índice composto necessário no Firestore: `resultados` → `lojaId ASC` + `semana DESC`

---

## Design system — regras obrigatórias

> Guia detalhado (motivo do hub, padrões de dashboard, hierarquia visual,
> checklist pré-entrega): skill `ihubfood-design` em
> `.claude/skills/ihubfood-design/SKILL.md`. Esta seção documenta só os
> tokens e valores exatos usados no código (fonte da verdade:
> `tailwind.config.js` + `src/index.css`).

### Filosofia
Dashboard B2B enterprise, de baixo ruído — layout híbrido **sidebar escura +
conteúdo claro**. Cards brancos com sombra sutil sobre fundo cinza-claro,
dados falam por si. Nada de decoração, gradiente ou animação chamativa.

### Paleta de cores
```
--bg:               #F7F7F8   fundo do conteúdo (body)
--surface:          #FFFFFF   cards, modais, tabelas (lado claro)
--border:           #E8E8E8   bordas padrão (1px)
--border-subtle:    #F3F3F3   divisores internos (linhas de tabela)
--border-hover:     #DDDDDD   bordas em hover
--text-primary:     #111111   texto principal
--text-muted:       #666666   texto secundário
--text-subtle:      #999999   texto terciário / labels
--text-faint:       #BBBBBB   labels de seção em uppercase, placeholders

--accent:           #FF4B2E   vermelho-laranja iHubFood — CTAs, nav ativo, destaques
--accent-hover:     #E63E1F   hover do botão primário
--accent-soft:      #FFF1ED   fundo de item ativo / alerta crítico (lado claro)
--positive:         #00C896   variação positiva, sucesso, "em dia"
--negative:         #DC2626   variação negativa, alerta
--warning:          #CA8A04   atenção / pendências (texto #B45309, fundo #FFFBEB, borda #FDE68A)

--brand-dark:       #0E1116   fundo da sidebar — superfície mais escura do produto
--brand-dark-hover: #1C2128   hover/divisores sobre a sidebar escura
--brand-blue:       #2563EB   accent secundário — links, estados informativos
```

Badges de plataforma (não migrar pra paleta de marca — mantêm identidade própria):
```
iFood:  bg #FFF0F0 | texto #EA1D2C | borda #FECACA
99Food: bg #FFFBEB | texto #B45309 | borda #FDE68A
Keeta:  bg #EFF6FF | texto #1D4ED8 | borda #BFDBFE (ou hue distinto — nunca reaproveitar accent/positive)
```

### Tipografia
Uma família só, para tudo — inclusive números (sem monospace dedicado):
```css
font-family: 'Manrope', system-ui, -apple-system, sans-serif;
```
- Peso 800 (ExtraBold) para título, KPI e qualquer coisa que precise ser escaneada primeiro
- Peso 400-500 pro resto (corpo, labels, tabela)
- Números usam `font-variant-numeric: tabular-nums` (não uma fonte separada)

Escala modular (base 16px × ~1.25), não usar tamanhos fora dela:
- Label de seção / eyebrow: 11-12px, uppercase, tracking 0.06-0.08em, `#999999` (ou `#BBBBBB` em fundo escuro/sidebar)
- Corpo / dado de tabela: 13-14px, weight 400-500
- Título de card/seção: 16-20px, weight 800
- Título de página: 24-27px, weight 800, tracking -0.02 a -0.035em
- Número KPI: 28-34px, weight 800 — o maior elemento do card, sempre

### Layout
- Padding de página: `28px 32px`
- Gap entre cards: 16px
- Altura mínima de linha em tabelas: 44-48px
- Sidebar: 220px, fundo `#0E1116` (escura), item ativo com pílula tintada de accent
- Conteúdo: fundo `#F7F7F8`, cards brancos
- Border-radius: 10-12px nos cards, 6-8px nos elementos menores, 12px em modais

### Componentes

**Cards KPI**
```
fundo #FFFFFF | borda 1px #E8E8E8 | radius 10px | padding 20px 24px
box-shadow: 0 1px 4px rgba(0,0,0,0.06)
label: 11px uppercase #999999 tracking 0.06em
valor: 28-34px weight 800 #111111 (maior elemento do card)
variação positiva: #00C896 prefixo "▲" | negativa: #DC2626 prefixo "▼" — nunca só cor, sempre com seta
hover: box-shadow aumenta para 0 4px 12px rgba(0,0,0,0.08)
Um foco visual primário por card (número + 1 elemento de apoio: sparkline, delta ou ícone) — nunca gráfico + tabela empilhados
```

**Tabelas**
```
fundo #FFFFFF | borda 1px #E8E8E8 | radius 10px | overflow hidden
header: fundo #F9F9F9 | 11px uppercase tracking 0.06em #999999 | borda bottom 1px #E8E8E8
linha: border-bottom 1px #F3F3F3, altura 44px, hover fundo #FAFAFA
primeira coluna: weight 500, #111111
demais colunas: #666666
SEM zebra striping | SEM bordas laterais
```

**Modais**
```
overlay: rgba(0,0,0,0.4)
modal: fundo #FFFFFF | borda 1px #E8E8E8 | radius 12px | padding 28px
box-shadow: 0 8px 32px rgba(0,0,0,0.12)
título: 16px weight 600 #111111
fecha com ESC e clique fora
animação: scale(0.96)→(1) + opacity 0→1, ~150ms ease-out via Framer Motion
```

**Inputs**
```
fundo #FFFFFF | borda 1px #E8E8E8 | radius 6px | height 36px | font 13px
hover: borda #DDDDDD
focus: borda #FF4B2E (sem box-shadow colorido)
placeholder: #BBBBBB
```

**Botão primário**
```
fundo #FF4B2E | texto branco | radius 6px | padding 8px 16px | font 13px weight 500
hover: fundo #E63E1F
active: scale(0.98)
SEM gradiente | SEM sombra
```

**Botão secundário**
```
fundo #FFFFFF | borda 1px #E8E8E8 | texto #666666
hover: fundo #F9F9F9 | borda #DDDDDD | texto #333333
```

**Sidebar — itens de nav** (fundo `#0E1116`)
```
altura 32px | padding 0 12px | ícone Lucide 16px cor #999999 (ativo #FF4B2E)
texto 13px, ativo weight 500 cor #FF4B2E
ativo: fundo rgba(255,75,46,0.15), pílula/destaque — não é só troca de cor
hover: fundo #1C2128
labels de seção: 10px uppercase #BBBBBB tracking 0.08em
footer: separador 1px #1C2128 no topo
```

**Badges de status**
```
Ativo:        bg rgba(0,200,150,0.1) | texto #00C896 | borda rgba(0,200,150,0.2)
Inativo:      bg rgba(153,153,153,0.1) | texto #999999 | borda rgba(153,153,153,0.2)
Inadimplente: bg rgba(220,38,38,0.1) | texto #DC2626 | borda rgba(220,38,38,0.2)
font: 11px weight 500 uppercase letter-spacing 0.04em
radius: 4px | padding: 2px 8px
SEM fundo sólido
```

**Ranking / Top Lojas — Top Gestores**
```
NÃO usar emojis de medalha
posição 1: destaque em card (fundo #FFFBEB, borda #FDE68A, número #B45309 weight 700, troféu #D97706)
posição 2/3: "02"/"03" monospace, #666666 / #999999
variação positiva: +8.3% em #00C896 weight 600 | negativa: −5.1% em #DC2626
SEM fundos coloridos nas linhas (exceto card de destaque da posição 1)
```

**Alertas**
```
Atrasado (crítico): fundo #FFF1ED | borda 1px #FECACA | borda-esquerda 3px #FF4B2E | texto #DC2626
Pendente (atenção):  fundo #FFFBEB | borda 1px #FDE68A | borda-esquerda 3px #CA8A04 | texto #92400E
radius 6px | padding 10px 14px
Padrão fixo pra status persistente (não trocar por toast/modal)
```

**Gráficos Recharts**
```
fundo transparente
grid: apenas linhas horizontais, cor #F3F3F3, strokeDasharray
linha/barra principal: #FF4B2E | comparação: #93C5FD ou #2563EB
tooltip: fundo #FFFFFF | borda 1px #E8E8E8 | radius 6px | sombra leve
eixos: cor #999999 (ou #BBBBBB) | font 12px
SEM legenda decorativa
Escolher o gráfico pela pergunta que ele responde (ver skill ihubfood-design) — nunca decorar
```

### Animações Framer Motion

```javascript
// Entrada de página — usar em todas as pages
const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } }
}

// Lista com stagger — usar em tabelas e listas
const listVariants = {
  animate: { transition: { staggerChildren: 0.04 } }
}
const itemVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.15 } }
}

// Modal — sempre com AnimatePresence
const modalVariants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.15, ease: 'easeOut' } },
  exit: { opacity: 0, scale: 0.96, transition: { duration: 0.1 } }
}
```

Regras:
- Toda page usa `motion.div` com `pageVariants`
- Toda lista usa stagger
- Modais usam `AnimatePresence` + `modalVariants`
- Máximo 200ms em qualquer animação
- Hover states são CSS transition, não Framer (mais performático) — exceto box-shadow de cards, que pode animar via style/transition
- Zero bounce, zero spring, zero efeitos chamativos

### PROIBIDO — nunca fazer isso
- ❌ Inverter o split sidebar-escura/conteúdo-claro (nunca deixar a sidebar clara nem o conteúdo escuro — dark mode geral não existe, só a sidebar)
- ❌ Gradientes em qualquer elemento (fora do escopo hero/marketing, que não existe hoje no produto)
- ❌ Glassmorphism (backdrop-blur em cards ou modais — permitido só no overlay do modal)
- ❌ box-shadow colorido (sempre `rgba(0,0,0,x)`)
- ❌ border-radius > 12px
- ❌ Mais de 2-3 cores fazendo trabalho semântico por tela (status verde/vermelho/âmbar + no máx. 1-2 categóricas)
- ❌ Ícones decorativos dentro de cards KPI
- ❌ Animações com duration > 300ms
- ❌ Zebra striping em tabelas
- ❌ text-shadow em qualquer elemento
- ❌ Spinners grandes — usar Skeleton com pulse sutil
- ❌ Sinalizar estado só por cor (delta negativo sempre com seta, não só texto vermelho)
- ❌ Motivo hub (rede de nós conectados) usado como decoração genérica — só em telas sobre conexão/agregação (CRM, mapa, carteira, onboarding)
- ❌ Borda colorida só no lado esquerdo (`border-left: 3px solid ...`) como recurso genérico de destaque/hierarquia/"item recente" — é um tique visual raso, tem cara de IA. A única exceção é o padrão já estabelecido de banner de alerta/aviso persistente (ver seção **Alertas** acima) — não estender esse recurso pra cards, linhas de lista, itens de timeline ou qualquer outro contexto novo. Pra destacar um item, usar fundo tintado (accent-soft), peso de fonte, ou borda completa (todos os 4 lados)

---

## Ordem de geração dos arquivos

Sempre gere nessa sequência, um por vez:

1. `tailwind.config.js` + `src/index.css`
2. `src/services/firebase.js`
3. `src/contexts/AuthContext.jsx`
4. `src/App.jsx`
5. `src/components/Layout/Sidebar.jsx`
6. `src/components/UI/Modal.jsx` + `Badge.jsx` + `Toast.jsx` + `Skeleton.jsx`
7. `src/pages/Login.jsx`
8. `src/pages/Dashboard.jsx`
9. `src/pages/Resultados.jsx`
10. `src/pages/Lojas.jsx`
11. `src/pages/Clientes.jsx`
12. `src/pages/Gestores.jsx`

Cada arquivo deve ser completo e funcional. Zero placeholders. Zero TODOs. Zero `// implementar depois`.
