# ADR 0092 — Estimativa de custo do tecido, e o tipo de tecido (ramado ou tubular)

## Contexto

Pedido do usuário: uma estimativa **opcional** do custo do tecido por peça, sem mudar o que já funciona — o custo do
tecido (com a moeda e a unidade explícitas, sem misturar metro linear com m²), o rendimento (m/kg) quando o programa já
usa o conceito, e o tipo de tecido "Ramado" ou "Tubular". Com os campos vazios, nada pode travar nem aparecer como
zero. A área tem de ser a real das peças (não a caixa em volta), por tamanho, com pares e peças repetidas; a sobra tem
de ser "área não aproveitada estimada", sem dupla contagem e com o critério do rateio à vista; tubular não pode virar
largura aberta por conta própria; projetos e planos antigos abrem como estavam e não são recalculados.

Como estava: o tecido do projeto (aba Encaixe > Tecido) tinha largura, gramatura e estoque, sem tipo, custo nem
rendimento. A malha do planejamento (cadastro de produção, ADR 0088/0089) já tinha o rendimento (m/kg) e uma caixa
"Malha tubular" (o booleano `tubular`, que muda a largura na mesa no enfesto par e os avisos). O enfesto tem os tipos
"Tubular" e "Ramado" (ADR 0003) — de enfesto, não de tecido. O plano de corte confirmado guarda uma cópia da malha
e o resultado, e nunca é recalculado.

## Decisão

### Onde a estimativa sai

No **plano de corte** (as alternativas, a revisão e os planos guardados): é o único lugar que tem o comprimento de
malha gasto (o consumo das camadas), a largura na mesa, as folhas por camada e as unidades produzidas por tamanho. O
custo e o tipo entram no **tecido do projeto** e na **malha** (os dois opcionais); o tecido do projeto já entrava na
malha do plano (`malhaDoTecido`), e agora leva os três.

### Os campos (todos opcionais)

- `CustoDoTecido` (`domain/tecido.ts`): `{ valor, unidade: 'metro-linear' | 'kg', moeda: 'BRL' }`. Número finito, de 0
  para cima, até 2 casas (os centavos). O texto digitado (`lerCustoDoTecido`) aceita vírgula ou ponto decimal e recusa
  "R$", ponto de milhar, sinal, mais de 2 casas e o valor sem a unidade escolhida — nada é convertido por conta
  própria ("1.234" é recusado: mil e tanto ou 1,234?). Custo zero informado é zero; custo ausente é "Não informado".
- `TipoDeTecido`: `'ramado' | 'tubular'`; ausente, "Não informado". Rótulo "Ramado (aberto)", para não confundir com
  o enfesto ramado.
- Tecido do projeto: `tipoDeTecido?`, `custo?` e `rendimentoMmPorG?` (m/kg). `criarTecido` valida os três.
- Malha (`cadastroDeProducao.ts`): `tipoDeTecido?` e `custo?`. O booleano `tubular` continua (o plano usa); com o tipo
  informado, os dois conferem (`tubular === (tipo === 'tubular')`), e a leitura do arquivo e a validação recusam o que
  não confere. Na tela, a caixa "Malha tubular" virou o seletor "Tipo de tecido" (Não informado / Ramado (aberto) /
  Tubular), que grava os dois. A malha de antes **não é reinterpretada**: a marcada como tubular aparece como
  "Tubular" (era explícito); a não marcada, como "Não informado" — não como ramada (`tipoDeTecidoDaMalha`). Para o
  plano ela continua aberta, como antes, e a estimativa diz que presumiu.

Sem migração: os campos são opcionais, a versão do formato do projeto (2) e a do cadastro (2) ficam.

### A conta (`domain/custoDoTecido.ts`)

- **Área:** `roupasPorTamanho(modelo, quantidades)` — para cada tamanho do modelo do plano (`modeloDoPlano`), as peças
  com a forma daquele tamanho (as graduadas, na forma do tamanho; a sem tamanho, em todos), a área real da linha de
  corte (com a costura) e a quantidade por roupa (o par conta as duas; a peça repetida, cada vez). Com o encolhimento
  compensado no risco, a área é a do molde × o fator de comprimento × o de largura.
- **Malha por metro** (a área que 1 m de comprimento dá) = largura na mesa × folhas por camada — a mesma conta que o
  plano usa para a produção. Aberta: a largura útil; no par, 2 folhas de meia largura (a largura útil inteira); na
  tubular, 2 folhas do tubo achatado (a largura útil cadastrada), **só no enfesto tubular**. A largura aberta de uma
  malha tubular nunca é presumida. Tubular num enfesto aberto, ramado num enfesto tubular, ou tipo não informado no
  enfesto tubular: o custo não sai, e a estimativa diz por quê.
- **Custo por metro:** o informado; por quilo, `R$/kg ÷ rendimento (m/kg)` do plano (o informado ou o calculado pela
  gramatura, como o plano escolheu, dito qual). Numa malha tubular, só com o rendimento informado (o calculado pela
  gramatura usa uma folha da largura).
- `custo por m² = custo por metro ÷ malha por metro`;
  `custo direto por roupa = área da roupa × custo por m²`;
  `área de malha do enfesto = consumo das camadas (com as pontas) × malha por metro`;
  `custo do enfesto = área × custo por m² = consumo × custo por metro`;
  `área das peças cortadas = Σ unidades produzidas do tamanho × área da roupa`;
  `área não aproveitada = área de malha − área das peças` (máx. 0), discriminada em pontas das camadas, faixa da
  largura fora do risco e espaços entre as peças — "não é sobra reaproveitável".
- **Rateio, com os dois critérios à vista:** custo médio por unidade = custo do enfesto ÷ unidades produzidas (o mesmo
  para todos os tamanhos); por tamanho, custo direto + a parte da área não aproveitada na proporção da área
  (`direto × custo do enfesto ÷ custo direto total`). Somadas as unidades, os dois dão o custo do enfesto: a perda não
  é contada duas vezes.
- **Fora do enfesto** (mostrado à parte, nunca somado): perda dos rolos, trechos pulados por defeitos, sobreposição
  das emendas. A sobra dos rolos volta ao estoque e não é custo do plano.
- **O que falta não vira número:** cada valor é calculado só com os dados dele completos; o que não sai fica `null`
  ("não calculado" na tela), e `faltas` diz o dado e onde informá-lo. As peças passando a área de malha dos riscos
  (um risco informado curto demais) avisam e não rateiam a perda. O material insuficiente é avisado (a estimativa é do
  plano como planejado).
- O consumo é o planejado: o programa não registra consumo medido por peça, e a estimativa diz isso.

### Planos guardados

`PlanoDeCorteV2.custoDoTecido?`: a estimativa é calculada ao montar o plano e **guardada com ele** (com a malha e o
custo de então); o plano confirmado mostra a guardada, nunca a refaz. Os planos de antes dela dizem "Este plano é de
antes da estimativa de custo do tecido". Os planos da primeira versão do cálculo não mudam.

### Na tela

- Encaixe > Tecido: "Tipo de tecido", "Custo do tecido (R$, opcional)", "Unidade do custo", "Rendimento (m/kg,
  opcional)" e a nota de que são opcionais.
- Planejamento, etapa 3: "Tipo de tecido" no lugar da caixa "Malha tubular", "Custo da malha (R$, opcional)" e
  "Unidade do custo".
- No plano (`ui/CustoDoTecidoNoPlano.tsx`, dentro de `ResumoDoPlanejamento`): os dados usados com as unidades, a
  tabela por tamanho (área de uma roupa, custo direto, com a perda rateada, unidades), "O enfesto inteiro" (malha,
  peças, área não aproveitada e as partes, custo médio), o que ficou fora, os avisos, as peças de cada roupa e "Como o
  custo foi estimado". Nas Limitações conhecidas da janela, uma linha do custo.

## Conferência

- `domain/custoDoTecido.test.ts` (29): custo por metro e por quilo, m² pela largura útil, ramado/par/tubular e o tipo
  não informado, as combinações que não calculam, a área real (a frente graduada no P: 0,2350 m², a caixa 0,2400),
  pares, repetidas, tamanhos separados, a mesma peça em mm, cm e polegadas, área não aproveitada e as partes, os dois
  rateios somando o total, dados faltando, custo zero, compensação do encolhimento, perdas fora do enfesto.
- `tecido.test.ts`, `cadastroDeProducao.test.ts`, `formularioDoPlanejamento.test.ts`, `projeto.test.ts`: os campos
  vazios e preenchidos, negativo, texto, casas decimais, unidade ausente, o tubular de antes, o arquivo estragado, o
  projeto de antes abrindo igual e o de agora voltando igual do disco.
- `PainelDeTecido.test.tsx` (novo), `ResumoDoPlanejamento.test.tsx`, `PainelDePlanejamento.test.tsx`: os campos na
  tela, os erros, "Não informado" sem nenhum R$ 0,00, o plano de ponta a ponta com o custo do tecido do projeto — e o
  resultado do plano (consumo, camadas, produção) igual com e sem o custo —, o plano guardado com a estimativa de então
  e o de antes sem ela.
- Cópias dos 13 projetos reais da pasta de dados (numa pasta temporária, apagada depois; os originais não foram
  tocados): todos abrem iguais, sem campo novo, e a área das roupas sai (a real fica de 15% a 20% abaixo da caixa).
- O programa gerado, numa pasta de dados só do teste: o tecido com tipo, custo e rendimento gravado; o negativo
  recusado; a malha vindo do tecido; a estimativa na alternativa; o plano confirmado gravado com ela (2,469 m ×
  R$ 32,50 = R$ 80,24; direto + não aproveitado = total); o plano reaberto com os valores de então; sem erro na página.

## Achados, não mexidos

- A janela do planejamento fica uns 40 px mais larga que a área visível no Windows (`width: min(1180px, 92vw)` mais a
  barra de rolagem vertical), em todas as etapas: aparece uma rolagem horizontal. É de antes (ADR 0088).
- O rendimento calculado pela gramatura (`rendimentoPelaGramatura`) usa a largura útil como uma folha; numa malha
  tubular (a largura é a do tubo achatado, duas folhas), o peso ↔ comprimento sai com o dobro do comprimento. O custo
  por quilo não usa essa conta na malha tubular; o plano, sim, como antes.
