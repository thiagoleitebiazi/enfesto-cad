# ADR 0088 — Planejamento de corte integrado: do molde ao plano de enfesto

## Contexto

Pedido: evoluir o planejamento de corte (ADR 0087) até o fluxo completo —
molde e revisões, ordem de produção, malha e rolos, encaixes gerados para a
grade da ordem (um ou mais riscos), alternativas comparáveis, revisão,
confirmação, rascunho, planos reabertos com os valores de então —, sem
apresentar estimativa como garantia e sem mudar a ordem em silêncio.

O que a auditoria encontrou (commit `0e6f892`, `master`, sem mudança local):

- **O "molde" é o projeto.** As peças têm tamanho e/ou graduação, quantidade,
  restrição de rotação (o fio), espelhamento permitido, linha de simetria; a
  biblioteca de projetos é o cadastro de modelos, e o histórico guarda o estado
  inteiro a cada evento. Não havia a peça "em par" (direita e esquerda).
- **Importação:** DXF (parser próprio: LWPOLYLINE, POLYLINE, LINE, ARC, CIRCLE,
  SPLINE, blocos INSERT, contorno em pedaços; unidade pelo `$INSUNITS`, a
  desconhecida presumida em mm com aviso) e PDF vetorial (com o registro do
  próprio programa). Nenhum arquivo real de outro CAD foi testado (risco R-1).
- **O encaixe automático** ("maior primeiro, primeiro lugar livre" numa grade
  de 10 mm) para em 20 000 posições por peça — perto de 1,25 m de mesa numa
  largura de 1,60 m: um risco com várias roupas não cabe nessa busca.
- **Projetos** sem versão de formato nem migração; malhas no armazenamento do
  navegador; nada de rolos nem de ordens.

## Decisão

### Formato do projeto, cópia de segurança e revisões do molde

- `versaoDoFormato` (2) no projeto. `lerProjeto`/`lerBiblioteca` trazem o
  antigo para a versão atual **sem tirar nenhum campo** (até os que esta
  versão não conhece); o arquivo no disco só muda quando o projeto é gravado.
- Antes de gravar por cima de um arquivo de versão mais antiga (ou ilegível),
  o processo principal copia o arquivo como estava para
  `projetos/copias-de-seguranca/<id>.v1.<hora>.json` (`gravarProjetoComCopia`).
  A cópia da versão antiga é feita uma vez; a do ilegível, toda vez.
- O arquivo quebrado na pasta de projetos não some mais em silêncio: a
  biblioteca diz que ele ficou de fora (e não o apaga); o projeto de versão
  mais nova abre com aviso.
- **Revisão do molde** (`registrarRevisaoDoMolde`): número, data, quem
  registrou, o que mudou, a impressão digital das peças e o evento do
  histórico com as peças daquele momento. Sem mudança nas peças, não há
  revisão nova. O plano diz a revisão das peças de agora, ou "sem revisão".
- **A importação** (DXF ou PDF) registra uma versão no histórico (a forma como
  chegou) e grava em cada peça a origem (arquivo, data, unidade, se a unidade
  foi presumida) e as medidas que não mudam ao mover/girar/espelhar — o
  programa diz quando a peça foi mudada depois de importada.
- **Peça "cortar em pares (direita e esquerda)"** (Propriedades da peça): das
  cópias, metade sai espelhada — no encaixe automático e nos riscos do
  planejamento. A quantidade por roupa precisa ser par.

### O modelo para o plano

`modeloDoPlano` tira das peças do projeto as peças de cada tamanho: graduada
(cada tamanho com a forma dele), com tamanho (só no dela), sem tamanho (comum a
todos, dito), cópias de um encaixe na mesa (`id#n`, contam como uma peça, com
as cópias por roupa), peça girada (volta à orientação de origem), simetria
(aberta inteira). Erros que bloqueiam: contorno inválido, contorno que se
cruza, peça dobrada com a metade guardada, tamanho sem peça. Avisos: medida
fora do comum, unidade presumida, peças repetidas. Cada problema tem o botão
"Abrir a peça" (fecha a janela e abre as propriedades dela). A quantidade por
roupa é escolhida no plano (o projeto não muda) e fica registrada como ajuste.

### O risco do planejamento (`risco.ts`)

Um motor próprio, mais curto e mais rápido que a busca em grade para riscos
longos: cada peça vai para o primeiro lugar livre entre os "pontos de canto"
das já postas, na orientação (só as permitidas pela peça; sem 180°/270° em
malha de sentido único; espelho só se a peça deixa e não é de par) em que ela
termina mais perto do começo da mesa; no lugar, é encostada nas vizinhas até
a distância pedida (o mesmo encosto do encaixe automático). Três ordens de
entrada (maior área, mais compridas, mais largas); fica o risco mais curto. O
risco não passa da mesa configurada menos as margens. **É uma heurística**: a
tela e o plano dizem que não é garantido o menor risco possível.

Para as contas de colisão, a linha de corte é simplificada (Douglas-Peucker,
até 0,2 mm da verdadeira; os pontos que ficam são do original) e essa diferença
é somada à distância exigida: a distância verdadeira entre as peças nunca fica
abaixo da pedida (com curvas, fica até 0,4 mm acima). Os contornos guardados no
plano são os simplificados. Sem isso, as peças reais com curvas de ~800 pontos
levavam 83 s e metade dos riscos não saía no tempo; com isso, 5,6 s.

Na camiseta de teste (frente, costas, manga em par, gola; 1,60 m; 3 mm): com 6
roupas (30 peças), 4,93 m e 83,8% de aproveitamento em 0,6 s — o encaixe
automático, com a busca liberada, fez 5,90 m e 70% em 14 s.

### A grade em um ou mais riscos (`composicaoDeRiscos.ts`)

Composições candidatas: a grade proporcional à ordem (e os múltiplos dela até o
limite de roupas por risco), e a "gulosa até N roupas por risco" para cada N:
a cada passo, a grade e as camadas que produzem mais peças sem passar da
ordem; o resto que não fecha sem excedente vai num último risco, com o
excedente mínimo. Os riscos de todas as composições são feitos num Web Worker
(`planejamento.worker.ts`), com limite de tempo e cancelar; o que não deu tempo
de fazer fica dito.

### O plano de enfesto (`planoDeEnfesto.ts`, `planejamento.ts`)

- Vários riscos, cada um com as camadas dele; **camada, folha e enfesto
  definidos** na tela e no plano. Enfesto par: a malha aberta vai dobrada ao
  meio na largura (como o programa define o par, ADR 0003) — dito no plano.
- Capacidade: folhas por enfesto, altura máxima (com a espessura da folha) e
  peso máximo — vale o menor; as camadas de cada risco são repartidas por igual.
- Mesa: o risco mais comprido mais as margens (a fórmula aparece), até o
  comprimento da mesa; a área é a do tecido na mesa e, com a largura da mesa
  informada, a da mesa física.
- Rolos: o comprimento medido, ou peso × rendimento (marcado como estimativa);
  menos a perda por rolo e os defeitos; cada rolo dá camadas inteiras (sem
  emenda). Rolo mais estreito que todos os riscos **bloqueia** até sair da
  seleção; o que serve só a alguns riscos é avisado. Lotes/tonalidades
  diferentes **bloqueiam** até a decisão explícita de misturar; o enfesto que
  junta lotes é marcado.
- Rendimento: o informado e o pela gramatura; a divergência acima da
  tolerância é avisada com os dois valores; o principal é escolhido por quem
  planeja e fica no plano.
- Encolhimento **nunca é aplicado**: o cadastro da malha diz se ele já está
  compensado no molde, e o plano avisa quando não está.
- Listrado/xadrez: o programa não casa o padrão; o plano só sai com a
  decisão marcada de que o casamento será feito à parte, e avisa.
- Produção por tamanho: pedido, planejado, excedente, falta e, quando o
  material não dá, o que dá com ele. **A ordem nunca é mudada.**
- Três alternativas comparáveis, com o critério escrito: menor consumo
  estimado, menos enfestos, equilibrada (consumo ÷ menor consumo + enfestos ÷
  menos enfestos). Ou o risco da mesa, ou um risco informado à mão (sem
  desenho; o plano diz que depende do informado).

### Cadastro de produção

`cadastro-de-producao.json` ao lado dos projetos (pelo processo principal,
gravado sem deixar pela metade, conferido antes, com a mesma cópia de
segurança): malhas (descrição, composição, título do fio, gramatura, larguras
nominal e útil, rendimento, aberta/tubular, sentido, padrão, encolhimentos e se
estão no molde, espessura, tolerância de largura, observações), rolos
(identificação, peso, comprimento medido, largura medida, lote, tonalidade,
defeitos, localização, origem e data da medição, unidades digitadas) e ordens
(código, produto, molde e revisão, cor, quantidades, prazo, observações). As
malhas do cadastro antigo (do navegador) entram na primeira vez. Tirar uma
malha com rolos é recusado; trocar uma ordem e tirar um rolo pedem
confirmação. A grade da ordem pode ser colada de uma planilha.

### A janela (Encaixe → Planejamento de corte)

Etapas: 1. Molde (peças, quantidade por roupa, revisão, problemas), 2. Ordem,
3. Malha e rolos, 4. Risco e enfesto (tipo, de onde vem o risco, largura do
risco, configuração), 5. Alternativas (tabela comparativa e o desenho do risco
em escala, com as peças, o fio, as medidas e uma régua), 6. Revisar e
confirmar (ajustes — camadas por risco, camadas por enfesto, mesa —, sugerido ×
final, responsável "informado", "Salvar rascunho", e a confirmação em dois
cliques), e Planos deste projeto (rascunho: continuar, apagar com
confirmação; confirmado: ver os valores de então, "Duplicar como novo"; os da
primeira versão do cálculo aparecem como foram guardados).

### O plano guardado

`PlanoDeCorteV2` no projeto: a entrada inteira (molde com revisão, impressão
digital e as peças com a quantidade por roupa; a ordem; a malha; os rolos como
estavam), a configuração, a estratégia e o critério, os riscos com as peças no
lugar, a composição sugerida, os ajustes e os ajustes feitos (sugerido →
escolhido), o resultado, os avisos, as premissas, a busca (método, quantos
riscos e composições, o que não saiu), datas, situação e responsável. O
confirmado não muda nem sai; o novo da mesma ordem diz qual substitui;
"Duplicar como novo" é outro plano, que lembra de onde veio. O histórico ganha
o evento "Plano de corte" na confirmação.

## O que NÃO foi feito

- **Não há usuário logado**: o responsável é digitado e aparece como
  "informado". **Não há banco de dados**: projetos e cadastro são arquivos
  JSON deste computador (não compartilhados entre computadores).
- **A ordem não é importada de arquivo** (planilha, ERP): ela é digitada, ou a
  grade é colada de uma planilha.
- **O estoque não é baixado** quando um plano é confirmado: os rolos
  continuam no cadastro; tirar um rolo do estoque é feito à mão ("Tirar do
  estoque", na etapa Malha e rolos).
- **Emendas não são feitas** (cada camada sai de um rolo só); a posição dos
  defeitos não é considerada (só o comprimento que tiram).
- **Listras e xadrez não são casados**; o encolhimento não é aplicado.
- **Os riscos e as composições são heurísticos**: nem o menor risco nem a
  melhor composição são garantidos; a busca tem limite de roupas por risco e
  de tempo, e diz o que ficou de fora.
- **O "Nesting Automático" da aba Encaixe continua com o motor antigo** (e o
  limite de 20 000 posições por peça); o motor novo é usado no planejamento.
- **Formatos de molde**: só os que já existiam (DXF e PDF vetorial), sem
  arquivo real de outro CAD testado (R-1).
- "Duplicar como novo" usa os riscos do plano de origem; para refazê-los com o
  molde de agora, é preciso calcular as alternativas de novo (a tela diz).
  Os planos da primeira versão do cálculo só podem ser vistos.

## Verificação

- **Testes:** 2405 em 116 arquivos (eram 2273 em 106 no `0e6f892`); tipos e
  lint limpos; build com o worker do planejamento. Novos: cadastro (leitura
  tolerante, validações, malhas antigas, comprimento medido × estimado, grupos,
  grade colada), formato e migração do projeto (o antigo abre sem perder campo,
  o quebrado e o mais novo são ditos), cópia de segurança (no disco, de
  verdade, numa pasta temporária), revisões do molde, peça em par no encaixe,
  origem da importação, modelo do plano (tamanhos, graduação, comuns, cópias
  da mesa, giro desfeito, simetria aberta, erros e avisos, ponto de fechamento
  repetido), risco (retângulos com o comprimento calculável, formas
  irregulares sem sobreposição e à distância, rotações proibidas, sentido
  único, par espelhado, mesa máxima, ordens de entrada, curvas simplificadas
  com a distância compensada), composições (proporcional e múltiplos, gulosa
  sem excedente, ímpar no par com o excedente mínimo), plano de enfesto (o
  caso do pedido em números, par dobrado, tubular, rolos com perda, defeito e
  estimativa, lotes, rolo estreito, capacidade por folhas, altura e peso,
  mesa, ordem com tamanho que o molde não tem, falta e excedente, divergência
  de rendimento, listrado, encolhimento, vários riscos), alternativas,
  rascunho/confirmação/cópia/substituição, a busca (tempo e cancelar) e a
  janela de ponta a ponta (11 testes).
- **Mutações:** 64 nas contas, nos limites, nas decisões e na migração, uma
  por vez, com o código conferido por hash antes e depois: 51 pegas na
  primeira rodada; as 13 que sobraram apontaram os testes que faltavam e, com
  eles, 12 pegas — a que fica (as camadas do último risco da gulosa) é
  equivalente: depois do laço, o que resta é sempre menos de uma camada. Mais
  6 no código da simplificação: 4 pegas; as 2 equivalentes viraram código mais
  simples.
- **Na tela, com o programa gerado** (pasta de dados separada): a importação
  registra a versão no histórico e a origem nas peças; a peça marcada em par
  fica gravada; a revisão do molde vai para o projeto; a ordem, a malha e dois
  rolos vão para o arquivo do cadastro (em mm e g), e a malha do cadastro
  antigo entra; os riscos são gerados, as alternativas aparecem com o critério
  e o desenho; a confirmação pede o segundo clique; o plano fica no projeto
  (versão 2, confirmado, com os rolos, os riscos desenhados e a busca), com as
  cópias do par metade espelhadas e a ordem fechada; o plano salvo mostra os
  valores de então; um projeto antigo é aberto e gravado — a cópia do arquivo
  antigo fica em `copias-de-seguranca`, igual, e o projeto gravado está na
  versão 2 sem perder o campo desconhecido; o arquivo quebrado é dito e não é
  apagado; nenhum erro na página. O roteiro dos fluxos (ADR 0084): 72
  conferências, 0 falhas; o dos 3 mm: 0 falhas; a varredura de todos os
  botões: igual à anterior.
- **Com peças reais** (cópias de dois projetos do usuário, numa pasta
  temporária, apagadas depois; nada foi gravado nos projetos nem no
  repositório): o primeiro teste marcou todas as peças como "contorno que se
  cruza" — o ponto final repete o primeiro nos contornos importados, e o teste
  contava o lado de comprimento zero. Corrigido (só conta travessia de
  verdade) e coberto por teste. Depois: 4 peças com curvas de ~800 pontos e 8
  peças, 20 roupas, 6 riscos feitos em cada (5,6 s e 7,8 s), 686 e 1700 pares
  de peças conferidos sem sobreposição, a menor distância 3,405 mm para 3 mm
  pedidos.
