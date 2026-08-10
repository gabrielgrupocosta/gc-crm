---
name: ihubfood-arquitetura
description: Padrões de arquitetura, multi-tenant e controle de acesso do sistema iHubfood (Firebase/React). Use SEMPRE que for criar algo NOVO no sistema — nova tela/página, novo módulo, nova Cloud Function, novo campo ou nova coleção no Firestore — ou seja, pedidos do tipo "cria uma tela de...", "adiciona um módulo de...", "cria uma function que...", "adiciona um campo em...". Cobre isolamento por organização (organizacaoId), roles (master/admin_org/gestor), regras do Firestore, padrão de Cloud Functions e o checklist de arquivos a tocar. NÃO use para ajustes em algo que já existe — corrigir bug, mudar índice do Firestore, alterar regra já criada, estilizar componente existente, otimizar query já escrita: esses casos não precisam dessa skill, só criação do zero. É a skill irmã de ihubfood-design (que cobre só o visual) — ao criar algo novo, use as DUAS juntas: esta cuida de dados/acesso/estrutura, a outra cuida da UI.
---

# Arquitetura iHubfood

Este sistema é multi-tenant: várias organizações de consultoria usam a mesma base, e cada uma só pode ver seus próprios dados. Toda funcionalidade nova precisa respeitar esse isolamento desde o primeiro commit — corrigir depois é sempre mais caro (já aconteceu várias vezes neste projeto, ver seção de armadilhas).

Para estilo visual, cores, tipografia e componentes, use a skill `ihubfood-design` em paralelo com esta — uma não substitui a outra.

## 1. Multi-tenant / `organizacaoId`

A fonte de verdade de quem é o usuário e a que organização ele pertence **não é** o documento `users/{uid}` no Firestore (isso é só dado de exibição) — é o **custom claim do token de autenticação**, lido em `src/contexts/AuthContext.jsx` via `getIdTokenResult()`.

Toda query nova em uma coleção multi-tenant precisa desse padrão de escopo:

```js
const escopo = isSuperAdmin
  ? []
  : [where('organizacaoId', '==', user.organizacaoId ?? null)]
```

(Existe também uma variante de "modo teste", onde o `master` simula ver como uma org específica via `where('organizacaoId', 'in', ids.slice(0,10))` — não é o padrão principal, só precisa saber que existe caso apareça em telas de admin.)

Em formulários, o campo `organizacaoId` só aparece como seletor quando `isSuperAdmin` é verdadeiro. Para os demais roles, é preenchido automaticamente a partir do usuário logado — nunca exposto como select. Exemplo real (`Lojas.jsx`):

```js
organizacaoId: !isSuperAdmin ? (organizacoes[0]?.id ?? '') : '',
...
{isSuperAdmin && (
  <select value={form.organizacaoId} onChange={...}>...</select>
)}
```

No `firestore.rules`, `organizacaoId` deve ser tratado como **imutável em update** — toda coleção nova precisa da checagem dupla create/update comparando `resource.data.organizacaoId` com `request.resource.data.organizacaoId`, senão um `admin_org` consegue mover o próprio documento para outra organização editando o campo.

## 2. Controle de acesso por role

Roles existentes: `master` (super admin, acesso a todas as orgs), `admin_org` (admin de uma organização só), `gestor` (só acessa lojas onde `gestorId === auth.currentUser.uid`).

`AuthContext` expõe `user.role`, `user.organizacaoId` e os booleanos derivados:

```js
const isSuperAdmin = user?.role === 'master'
const isAdminOrg   = user?.role === 'admin_org'
const isGestor     = user?.role === 'gestor'
const isAdmin      = isSuperAdmin || isAdminOrg
```

No JSX, condicional simples é o padrão (não existe componente de guard genérico para trechos de UI):

```jsx
{isAdmin && (...)}
{isSuperAdmin && (...)}
```

Em rotas, use os wrappers já existentes em `App.jsx`: `<AdminRoute>` e `<SuperAdminRoute>` redirecionam automaticamente se o usuário não tiver o role exigido.

Em Cloud Functions, **sempre** valide o role no início da function, antes de qualquer lógica de negócio, usando os helpers já existentes em `functions/index.js`:

```js
exigirSuperAdmin(request)
exigirAdminDaOrg(request, organizacaoId)
```

Nunca confie em `organizacaoId`/role vindo do payload do client sem validar contra `request.auth.token`.

## 3. Design visual

Não duplicado aqui — para cores, tipografia, espaçamento e componentes, use a skill `ihubfood-design` junto com esta.

## 4. Cloud Functions — padrão de function nova

- Toda function protegida começa validando auth/role (`exigirSuperAdmin` ou `exigirAdminDaOrg`) antes de qualquer outra coisa.
- Se a function usa uma API externa com chave secreta, declare com `onCall({ secrets: [minhaSecret], timeoutSeconds, memory })` e leia a chave via `defineSecret(...)` — nunca hard-code de chave no código.
- Erros sempre via `throw new HttpsError(code, mensagem)` — nunca `res.status`, pois são `onCall`, não HTTP triggers. Códigos comuns: `unauthenticated`, `permission-denied`, `invalid-argument`, `not-found`, `resource-exhausted`, `internal`.
- Erros vindos de serviço externo (Gemini, Firebase Auth) devem passar por uma função helper de tradução antes de chegar ao client — nunca vazar o erro cru.
- Para coleções sensíveis a abuso, aplique rate limiting via transação Firestore no padrão `verificarRateLimit` / `rate_limits/{uid}_{chave}` (hoje usado com limite de 40 criações/hora).

## 5. Checklist ao criar uma tela ou módulo novo

Percorra nessa ordem — pular um item é a causa mais comum de bug de acesso neste projeto:

1. `src/pages/NovaPagina.jsx` — componente da página
2. `src/App.jsx` — `lazy(() => import(...))` + `<Route>` dentro do wrapper de role certo (`PrivateRoute`/`AdminRoute`/`SuperAdminRoute`)
3. `src/components/Layout/Sidebar.jsx` — item de nav no array da seção certa, com condicional de role se a tela for restrita
4. `src/services/firebase.js` — nova constante em `COLLECTIONS`, se a tela usa uma coleção Firestore nova
5. `firestore.rules` — regras da nova coleção: escopo por `organizacaoId`, imutabilidade de `organizacaoId` em update e, se for dado ligado a gestor, checagem de `gestorId == request.auth.uid` (espelhar o padrão já usado em `resultados`/`checkpoints_lojas_novas`)
6. Se envolve criação/ação server-side — `functions/index.js`, seguindo o padrão da seção 4
7. Antes de estilizar, consultar a skill `ihubfood-design`

## 6. Armadilhas já corrigidas neste projeto — não repetir

- **Campo `perfil` vs `role`**: nunca use `perfil` para identificar o papel do usuário — é campo legado que nenhuma conta atual tem. O campo correto é sempre `role`. Esse bug já se repetiu em pelo menos 8 telas (Carteira, Contratos, Clientes, Onboard, ControleSemanal, Dashboard, Ranking, Atividades).
- **Filtro `organizacaoId` esquecido em query nova**: é o bug mais recorrente do projeto — cada página reimplementa manualmente `isSuperAdmin ? [] : where('organizacaoId','==',...)` porque não existe um helper compartilhado. Ao criar uma tela nova, aplique esse padrão desde o início (seção 1), não como correção depois.
- **Dado cacheado desatualizado**: ao reatribuir `gestorId` de uma loja, lembrar de atualizar qualquer dado cacheado relacionado (ex.: `gestorNome` salvo no doc da loja) — já causou inconsistência visual em produção.
- **`organizacaoId` mutável em regras**: sem a checagem dupla create/update no `firestore.rules`, um `admin_org` consegue se mover para outra organização editando o próprio documento.
