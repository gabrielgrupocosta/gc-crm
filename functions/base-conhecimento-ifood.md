# Base de Conhecimento iFood

## REPASSE

- O iFood realiza o repasse toda quarta-feira
- Taxas cobradas pelo iFood:
  - Entrega própria: 12%
  - Entrega parceira (iFood): 23%
  - Pagamento online: 3,2%
  - Recebimento em 30 dias: sem taxa adicional
  - Recebimento antecipado em 7 dias: 1,99%
- Cupons e fretes podem ser subsidiados pelo iFood ou pela própria loja, dependendo da campanha ativada
- Informações de repasse ficam na aba Financeiro do portal do parceiro

---

## TAXAS E DESCONTOS

As taxas base do iFood são fixas e imutáveis — não há negociação possível:
- Entrega própria: 12%
- Entrega parceira (iFood): 23%
- Pagamento online: 3,2%

O impacto do frete grátis no repasse depende do tipo de entrega:
- Entrega própria: o frete grátis é um custo externo (motoboy), normalmente configurado como R$0 de taxa na plataforma — não gera desconto dentro do iFood e não aparece no cálculo do repasse
- Entrega parceira (iFood): quando o cliente ganha frete grátis, isso gera um desconto dentro da plataforma que é descontado do repasse da loja

A taxa de pagamento online (3,2%) se aplica à grande maioria dos pedidos — tanto pagamentos online quanto maquininha na entrega.

---

## PROMOÇÕES E ALAVANCAS

### Ordem de prioridade das alavancas

1. Frete grátis — mais de 80% dos pedidos no iFood saem com frete grátis. É quase obrigatório para vender bem.
2. HITS — quando disponível na região
3. Cupom do Clube iFood — clientes mais qualificados, pedem 2-3x mais
4. Campanha Inteligente
5. Desconto em Itens — não recomendado
6. Promoções Subsidiadas — mais fraca, mas sem custo para a loja

### HITS
- A loja oferece cupons por faixa de valor do pedido:
  - R$5 de desconto em pedidos de R$15 a R$24,99
  - R$8 de desconto em pedidos de R$25 a R$39,99
  - R$10 de desconto em pedidos de R$40 a R$60
  - R$13 de desconto em pedidos de R$60 a R$80 (somente Pizza)
- Em troca, o iFood cobre a taxa de entrega em até R$9,99 num raio máximo de 3km
- Se a loja tem entrega própria: iFood reembolsa a taxa de entrega
- Se a loja usa entrega parceira: o cliente recebe desconto na taxa
- Não está disponível para todo o Brasil ainda

### Campanha Inteligente (CI)
- Desconto fixo de R$5 por pedido, independente do valor
- A loja investe no máximo R$5 e o iFood investe o restante
- Não tem relação com frete grátis ou cupom de entrega
- Pode ser utilizada independente da conversão do cardápio ou do ticket médio
- Tem uma flag de "desconto em itens fixos":
  - Ativada: aplica desconto diretamente nos itens (ex: hambúrguer de R$29,99 aparece por R$10)
  - Desativada: os descontos são apenas cupons, sem alterar preço dos itens no cardápio
- Indicada para lojas com vendas ruins ou para atrair novos clientes, desde que a loja esteja bem precificada

### Campanha Desconto em Itens
- Campanha mais antiga, menos recomendada
- Desconto de R$10 por item
- Custo alto, retorno baixo — na maioria dos casos não vale a pena

### Promoções Subsidiadas pelo iFood
- O iFood investe 100% nos cupons desta campanha
- Menor potencial de vendas porque o iFood prefere direcionar investimento para campanhas em que o restaurante também investe
- Resultado depende do quanto o iFood decide alocar na região
- Não está disponível para todos, mas é possível ativar acessando: https://portal.ifood.com.br/promotions/sponsored_by_ifood

### Cupom do Clube iFood
- Clientes do Clube pedem 2x a 3x mais que clientes comuns e são mais qualificados
- Modalidades disponíveis:
  - Apenas novos clientes: 25% de desconto, máximo R$20
  - Novos + clientes perdidos (sem pedir há +30 dias):
    - 25% de desconto, máximo R$10
    - 25% de desconto, máximo R$15
- Também há opções de frete grátis, mais indicadas para lojas com entrega parceira

### Anúncios
- Vale a pena quando: conversão do cardápio acima de 20% OU ticket médio acima de R$70
- ROI acima de R$5 por real investido: anúncio está performando bem
- ROI abaixo de R$5: melhor investir em outras campanhas
- O anúncio funciona melhor em lojas que já têm cardápio bem estruturado

---

## PRECIFICAÇÃO

### Fórmula para embutir taxas do iFood no preço de venda
- Total de taxas = Plano% + 3,2% (pagamento online) + antecipação%
- Preço de venda = Valor líquido desejado ÷ (1 - total de taxas)

Exemplo:
- Quer receber R$10 líquido
- Entrega própria: 12%
- Sem antecipação: 0%
- Total de taxas: 12% + 3,2% = 15,2%
- Preço de venda = R$10 ÷ (1 - 0,152) = R$11,79

### Fórmula para embutir frete grátis no preço do cardápio
- Custo médio por entrega = total gasto com entregadores ÷ número de entregas no período
- Percentual de aumento = custo médio por entrega ÷ ticket médio × 100
- Novo ticket = ticket médio + custo médio por entrega

Exemplo:
- Custo médio por entrega: R$6,50
- Ticket médio: R$23,00
- Percentual de aumento: 6,50 ÷ 23,00 × 100 = 28,3%
- Novo ticket estimado: R$23,00 + R$6,50 = R$29,50

---

## FUNIL DE VENDAS

Localização no portal: Desempenho > Cardápio (selecionar últimos 30 dias)

Métricas de referência para um funil saudável:
- Visitas: base 100% (saudável acima de 2.500 visitas)
- Visualizações: acima de 50% das visitas
- Sacola: acima de 25% das visualizações
- Revisão: acima de 24% das sacolas
- Concluídos: acima de 12% das revisões

Interpretação por etapa:

**Visitas baixas** — problema de visibilidade
- Verificar: promoções ativas, frete grátis, anúncio, palavras-chave no cardápio, categoria correta, horário de funcionamento

**Visualizações baixas** — pessoas chegam mas não se interessam
- Produtos sem demanda na região
- Ordem do cardápio ruim (itens caros no topo)
- Fotos ruins ou ausentes
- Nomes dos itens difíceis de entender
- Preços acima da média do mercado

**Sacola ou Revisão baixas** — cliente se interessou mas não finalizou
- Taxa de entrega alta ou sem frete grátis
- Tempo de entrega estimado muito longo
- Forma de pagamento desejada não disponível

---

## COMO AUMENTAR AS VENDAS

Existem 3 pilares:

**1. Mais visitas**
- Palavras-chave no nome dos itens e descrições
- Categoria da loja correta no cadastro
- Nome da loja com nicho direto (ex: Pizzaria do Jonas, Hamburgueria Buena)
- Promoções ativas (frete grátis e cupons)
- Anúncio pago dentro do iFood

**2. Mais conversão do cardápio**
- Fotos que geram desejo
- Nome dos itens claro e fácil de entender
- Poucos ou nenhum complemento obrigatório (ideal: 0 ou 1)
- Preço competitivo
- Categorias bem ordenadas (mais vendidos no topo)

**3. Aumento do ticket médio**
- Upsell nos complementos
- Combos com os itens mais vendidos

---

## CARDÁPIO

- Fotos de qualidade são o principal fator de conversão no iFood
- Itens sem foto vendem até 3x menos
- O nome do item deve deixar claro o que é o produto:
  - Ruim: "Batman Burger"
  - Certo: "Burger Cheddar Bacon | Batman"
- Complementos obrigatórios aumentam a jornada de compra e reduzem a conversão (ideal: 0 ou 1)
- Organizar categorias com os mais vendidos primeiro
- Mínimo 6 itens diferentes no cardápio

---

## MÉTRICAS DE OPERAÇÃO

- Avaliação mínima: 4,7
- Tempo de entrega: 20 a 30 minutos num raio de 3km a 5km
- Taxa de cancelamento: máximo 1%
- Taxa de chamados: máximo 2,5%

---

## DIAGNÓSTICO DE QUEDA DE VENDAS

Verificar nos últimos 7 e 30 dias:
1. Nome da loja — deixa claro o nicho?
2. Categoria da loja — está correta? (Configurações > Perfil da loja > Categoria)
3. Pedido mínimo — deve estar abaixo de R$30 (pizzarias: R$40-50)
4. Funil de vendas — conversão abaixo de 12%? Investigar cada etapa
5. Palavras-chave no cardápio — os itens aparecem nas buscas?
6. Todos os itens têm foto?
7. Frete grátis ativo?
8. Tempo de loja aberta — mínimo 95% do horário cadastrado
9. Itens do top 15 mais vendidos estão pausados?
10. Houve mudança de preço recente?
11. Pausas programadas frequentes? (prejudicam o posicionamento)

---

## CANCELAMENTOS E CHAMADOS

**Quando prejudica a loja** (responsabilidade da loja):
- Atraso no pedido
- Item errado enviado
- Item faltando no pedido
- Loja não aceitou o pedido

**Quando NÃO prejudica a loja** (responsabilidade do cliente):
- Endereço errado
- Cliente não vai poder receber
- Cliente não colocou cupom
- Cliente quer mudar endereço
- Cliente quer adicionar ou remover item

A loja NÃO deve cancelar quando o problema é do cliente — o cliente deve solicitar o cancelamento ao iFood e a loja apenas aceita.

---

## PAUSA DE LOJA

Pausar a loja prejudica o posicionamento no algoritmo do iFood, especialmente pausas por alta demanda ou falta de insumos.

Alternativas à pausa:
1. Aumentar o tempo de preparo temporariamente
2. Pausar apenas os itens em falta

Se precisar pausar: Portal do parceiro > Configurações > Horários > Pausas e feriados > clicar na agenda e inserir o horário e o motivo

---

## LOJAS NOVAS

Os primeiros 1 a 2 meses geralmente são fracos:
- Baixa relevância no algoritmo do iFood
- Poucas avaliações, reduzindo a confiança do cliente
- Sem base de clientes recorrentes

Foco inicial: acumular avaliações positivas e manter métricas de operação em dia.

---

## AVALIAÇÕES

- Responder todas as avaliações negativas é obrigatório
- Nunca discutir com o cliente na resposta pública
- Avaliação abaixo de 3 com comentário deve ser respondida com solução concreta
- Para melhorar nota: qualidade do produto + embalagem + tempo de entrega

---

## POSICIONAMENTO E VISIBILIDADE

- Cobrir os picos: almoço (11h-14h) e jantar (18h-22h)
- Fotos do perfil e banner atualizados passam mais confiança
- Categoria correta no cadastro impacta para quem o restaurante aparece

---

## NAVEGAÇÃO NO PORTAL DO PARCEIRO

Portal: parceiros.ifood.com.br

- Promoções: aba Promoções (HITS, Campanha Inteligente, Cupom de Frete Grátis, Desconto em Itens, Promoções Subsidiadas)
- Repasse e financeiro: aba Financeiro
- Funil de vendas: aba Desempenho > Cardápio
- Anúncios: aba Anúncios
- Adicionar usuário: Configurações > Usuários > Novo usuário
- Pausar loja: Configurações > Horários > Pausas e feriados

---

## PERSONALIZAÇÃO POR NICHO

### Pizzaria
- Pedido mínimo: até R$40-50
- Ticket médio: R$60-110 (popular R$60 / premium R$110)
- Cardápio deve ter combos individuais, casal e família
- Combos já montados melhoram a conversão

### Hamburgueria
- Pedido mínimo: abaixo de R$30
- Ticket médio: R$40-70
- Combos com batata e bebida aumentam o ticket médio

### Açaí
- Pedido mínimo: R$20-25
- Ticket médio: R$20-40
- Complementos são a principal alavanca de ticket
- Fotos atrativas que geram desejo são essenciais

### Japonesa
- Pedido mínimo: R$40-60
- Ticket médio: R$60-120
- Combinados e combos são os mais vendidos

### Árabe
- Pedido mínimo: abaixo de R$30
- Ticket médio: R$30-60
- Esfihas e combos são os carros-chefe

### Brasileira / Marmita
- Pedido mínimo: até R$25
- Ticket médio: R$29-55
- Horário do almoço é o principal pico de vendas

### Lanchonete
- Pedido mínimo: R$25-30
- Ticket médio: R$35-60
- Combos simples com bebida aumentam o ticket

---

## GLOSSÁRIO

- Portal do parceiro: parceiros.ifood.com.br — site onde o dono gerencia a loja
- Repasse: valor que o iFood transfere para a loja
- Funil: jornada do cliente desde a visita até o pedido concluído
- Sacola: cliente adicionou itens mas não finalizou o pedido
- Chamado: reclamação feita pelo cliente sobre a loja
- HITS: programa de promoções do iFood com frete subsidiado
- CI: Campanha Inteligente — desconto de R$5 por pedido
- Taxa de cancelamento: % de pedidos cancelados pela loja
- Taxa de chamados: % de pedidos com reclamação do cliente
- ROI: retorno sobre investimento (ex: R$5 de retorno para cada R$1 investido)
