# ADR 0087 — Planejamento de corte

## Contexto

Pedido: um módulo de planejamento de corte que, a partir do molde, da malha e
da ordem de produção, calcule o comprimento do risco, o tamanho da mesa, as
camadas, os enfestos, o consumo e a sobra — com a mesa calculada (e não
digitada à toa), quem planeja revendo e ajustando antes de confirmar,
validações, unidades claras, a divergência de rendimento avisada, rolos e
lotes, margens e limites configuráveis, e o plano guardado com tudo o que o
gerou (entradas, versão do molde, configuração, resultado, data, responsável,
ajustes), sem ser recalculado em silêncio depois.

O que já existia: o projeto (com o histórico de versões), as peças, o
"Tecido" (largura útil, gramatura, rendimento, tubular), o "Enfesto" (tipo,
largura, comprimento da mesa, camadas — digitados à mão) e o encaixe na mesa
(que é o risco). Não havia ordem de produção, cadastro de malhas, nem plano.

## Decisão

### Um cálculo puro, que explica o que fez

`src/domain/planoDeCorte.ts`, sem tela e sem armazenamento:

- **Unidades internas:** mm, mm², g, g/m² e mm/g (que é o mesmo número que
  m/kg). A tela converte na entrada (m ou cm, kg) e na saída.
- **Rendimento:** o informado (m/kg) e o calculado pela largura e gramatura
  (`1 000 000 / (largura em mm × g/m²)`, em m/kg). Com os dois, vale o que
  quem planeja escolher como principal; se diferirem mais que a tolerância
  (5% por padrão), o aviso mostra os dois valores e a diferença em metros.
  O cálculo nunca escolhe sozinho.
- **Consumo por camada** = comprimento do risco + sobra de pontas (2 cm por
  padrão). **Camada** = um risco estendido; no enfesto "par" e no tubular,
  cada camada tem duas folhas (`espessurasFisicasPorCamada`, a mesma regra
  do enfesto).
- **Camadas necessárias** = o maior `ceil(pedido do tamanho ÷ (grade do
  tamanho × folhas por camada))`. **Camadas possíveis** = o material: pelo
  peso (kg × rendimento ÷ consumo por camada) ou pelos rolos — cada rolo dá
  só camadas inteiras, a ponta não se junta ao próximo; rolo mais estreito
  que o risco não entra. O plano usa o menor dos dois.
- **Enfestos:** até `folhas por enfesto` (100 por padrão) folhas cada um,
  repartindo as camadas o mais igual possível (130 camadas → 44, 43, 43).
- **Mesa sugerida** = risco + margem do começo + margem do fim (10 cm cada,
  por padrão), na largura útil da malha.
- **Produção por tamanho**, o que falta e o que sai a mais (a grade do risco
  pode produzir a mais de um tamanho); quando o material não basta: quanto
  falta (m e kg) e quanto dá de cada tamanho com o que há — **a ordem não é
  mudada**.
- **Avisos:** lotes diferentes, rolo estreito, tamanho da ordem que o risco
  não tem, malha tubular com enfesto aberto (e o contrário), sentido único
  com zigue-zague, encolhimento informado (registrado, não aplicado: a
  compensação tem de estar no molde), mesa ajustada menor que a sugerida,
  camadas ajustadas a mais que as necessárias.
- **Erros** (o cálculo não sai, e a tela diz o que falta): largura útil,
  comprimento ou grade do risco, código da ordem, quantidades, material
  (peso ou rolos), rendimento para converter peso em metros, risco mais
  largo que a malha, material que não dá uma camada, ajustes impossíveis
  (mais camadas que o material dá, mais camadas por enfesto que o limite,
  mesa mais curta que o risco).
- **Premissas:** cada cálculo devolve, em frases, as regras e configurações
  que usou; elas aparecem na tela e ficam no plano.

### O risco vem da mesa do projeto

`riscoDaMesa(pecas)`: o comprimento e a largura pelas linhas de corte das
peças que estão na mesa (o encaixe), a área delas (para a eficiência) e a
grade deduzida — em cada tamanho, a peça que menos se repete. A grade
aparece na janela para conferir e corrigir. Sem peças na mesa, quem planeja
informa o comprimento, a largura e a grade à mão (o resultado avisa que
depende do que foi informado).

### A janela: Encaixe → Planejamento → "Planejamento de corte"

`src/ui/PainelDePlanoDeCorte.tsx`: "Molde e risco", "Ordem de produção",
"Malha" (o tecido do projeto, uma do cadastro ou outra; largura em m ou cm;
rolos com lote, comprimento ou peso, e largura), "Enfesto e configurações",
"Ajustes (em branco, vale a sugestão)" — comprimento da mesa, camadas e
camadas por enfesto. A proposta é refeita a cada mudança e mostra, no alto,
"Malha … Mesa sugerida … Enfesto sugerido … Consumo estimado … Sobra
estimada", e embaixo os valores, a tabela por tamanho, os rolos, os avisos e
as premissas. "Confirmar o plano" só liga quando o cálculo sai; sem
responsável, recusa e diz o motivo.

- **Cadastro de malhas** (`malhasCadastradas.ts`) e **configuração**
  (`configuracaoDoPlano.ts`): guardados neste computador (localStorage),
  como as outras preferências do programa.
- **"Ajustar o enfesto do projeto ao plano"** (marcado por padrão): ao
  confirmar, o enfesto passa a ter o tipo, a largura útil da malha, a mesa
  do plano e as camadas do maior enfesto (`enfestoDoPlano`). A mesa nunca
  fica mais curta que até onde vão as peças já posicionadas.

### O plano guardado

- No próprio projeto (`Projeto.planosDeCorte`, `adicionarPlanoDeCorte`):
  entradas (com as unidades internas), o molde (projeto, código, revisão =
  número de versões do histórico, e uma impressão digital FNV-1a das
  peças), a configuração, os ajustes feitos (sugerido → escolhido), o
  resultado, os avisos, as premissas, a data, o responsável e
  `versaoDoCalculo`. O histórico ganha o evento "Plano de corte".
- **Nada é substituído:** um plano novo da mesma ordem (código sem
  diferença de maiúsculas e espaços) registra qual veio substituir
  (`substituiPlanoId`), e o anterior continua guardado.
- **"Planos salvos deste projeto"**, na janela: cada plano aparece com os
  valores de então, sem recalcular; se o molde mudou depois dele, avisa
  ("O molde mudou depois deste plano (revisão X → Y)").
- Os projetos antigos abrem como estavam (o campo é opcional). "Salvar
  como" e "Duplicar" começam um projeto novo sem planos, como começam sem o
  histórico: os planos ficam com o projeto em que foram feitos.

## O que NÃO foi feito

- **Não há usuário logado** no programa: o "Responsável" é digitado (vem
  preenchido com o autor do projeto, quando há).
- **Não há banco de dados nem migração**: o plano vai no arquivo do
  projeto, como o resto; o cadastro de malhas e a configuração ficam neste
  computador.
- **A ordem de produção é digitada no plano**: não há cadastro de ordens
  nem integração com outro sistema.
- **O encolhimento não é aplicado** ao risco (só registrado e avisado).
- **Um plano usa um risco só**: não há combinação de riscos diferentes para
  fechar uma grade, nem otimização da grade.
- O encaixe continua sendo o da mesa (risco R-3, "o primeiro que couber"):
  o comprimento do risco é o do encaixe que estiver lá.

## Verificação

- **Testes:** 2273 em 106 arquivos (eram 2213 em 102); tipos e lint
  limpos. Novos: as unidades e conversões; o caso do pedido (200 kg × 4 m/kg
  = 800 m; 40 camadas; mesa = risco + margens); a divergência 4 × 2,02 m/kg
  e o limite da tolerância; cada dado faltando ou impossível; o material
  que não dá a ordem (o déficit e o que dá, sem mudar a ordem); a sobra por
  camada; os enfestos repartidos (130 → 44, 43, 43); o par com 2 folhas; a
  grade que produz a mais; os rolos (camadas inteiras, o estreito fora,
  lotes); os avisos da malha e do enfesto; a eficiência; o risco e a grade
  tirados da mesa; a impressão digital do molde; o plano guardado sem
  substituir o anterior; o enfesto ajustado ao plano; o cadastro de malhas
  e a configuração; a janela (o que falta, a proposta, as unidades na
  confirmação, a largura em cm, o responsável, os planos salvos e o aviso
  do molde mudado).
- **Mutações** (as contas, os avisos, os ajustes, o risco da mesa, o
  enfesto do plano e a ordem que se substitui): 37, uma por vez, com o
  código conferido por hash antes e depois; 29 pegas na primeira rodada — as
  8 que sobraram apontaram os testes que faltavam (o limite da tolerância,
  o arredondamento das camadas para cima, os avisos que não devem aparecer,
  o limite exato do material, o ajuste igual à sugestão, o limite de folhas
  não inteiro) e, com eles, 37 de 37.
- **Na tela, com o programa gerado** (pasta de dados separada): as duas
  peças de teste encaixadas, uma no M e outra no G; a janela abre dizendo o
  que falta; com a ordem OP-0172 (60 M, 45 G) e a malha (310 g/m², 4 m/kg,
  1,6 m, 200 kg), a proposta mostra a mesa sugerida (o risco + 20 cm, na
  largura de 1,60 m), 60 camadas, 15 G a mais, a divergência de rendimento
  e a eficiência; a malha vai para o cadastro; confirmado, o plano fica no
  arquivo do projeto (em mm e g, com o responsável, a configuração e a
  hora), o histórico ganha "Plano de corte" e o enfesto passa a 1,60 m ×
  0,60 m com 60 camadas; um segundo plano da mesma ordem, com 30 camadas
  por enfesto, substitui o primeiro sem apagá-lo e registra o ajuste
  (sugerido 60 → 30); depois de mudar o molde, o plano salvo avisa
  "O molde mudou depois deste plano (revisão 3 → 4)" e mostra os valores de
  então; nenhum erro na página. O roteiro dos fluxos (ADR 0084) de novo: 72
  conferências, 0 falhas; o dos 3 mm (ADR 0085): 0 falhas; a varredura de
  todos os botões: igual à anterior, mais o "Planejamento de corte", que
  abre a janela.
