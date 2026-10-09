# ADR 0034 — Modificar e Redefinir perímetro

## Contexto

O ADR 0032 deixou duas ferramentas da aba Manipulação desabilitadas, com a dica
"o comportamento exato desta ferramenta ainda não foi confirmado": **Modificar**
e **Redefinir perímetro**. O ADR 0033 as manteve assim, à espera de um DXF de
antes e depois feito na referência. O ADR 0016 tinha decidido que Redefinir
perímetro não ganharia ferramenta própria.

O usuário pediu para fazer as duas funcionarem. Nenhum DXF de antes e depois
chegou. Assim, este ADR implementa só o que o manual da referência descreve e
deixa desligado, com o motivo na dica, o que ele não define:

- **Modificar:** uma janela com Modo (Discreto/Proporcional) e Nr. Pontos
  (1/N). Indica-se o ponto, e a nova posição vem do mouse ou da janela de
  coordenadas.
- **Redefinir perímetro:** três modos (Manter extremos, Uni-direcional e
  Bi-direcional). Indica-se o elemento e digita-se o novo perímetro.

O manual não diz o que Discreto e Proporcional fazem com os outros pontos, nem
como a medida se distribui num contorno inteiro.

## Decisão

### Modificar (`domain/molde.ts`, `ui/PainelDeModificar.tsx`)

- **Clique num vértice** da peça selecionada, sem arrastar, abre o diálogo
  "Modificar" com o deslocamento exato, em mm:
  - "Horizontal (mm, + para a direita)" e "Vertical (mm, + para baixo)",
    como os outros diálogos de medida (ADR 0018);
  - vírgula ou ponto decimal; campo vazio vale 0;
  - como os eixos da tela são trocados (ADR 0012), a horizontal é o y do
    mundo e a vertical, o x.
- **Vários pontos:** Shift+clique ou um retângulo selecionam vértices, como
  no Mover ponto. Um clique num vértice da seleção abre o diálogo para todos
  eles. Um clique fora dela abre só para o vértice clicado.
- **Arrastar** um vértice move direto, como no Mover ponto, com o ímã do
  ADR 0033. Soltar o botão fora do desenho não abre o diálogo.
- **Modo:** o diálogo mostra "1 ponto: só ele anda" ou "N pontos: só os N
  indicados andam" (o Nr. Pontos da referência). Os vizinhos ficam no lugar e
  os piques acompanham a aresta em que estão.
- **Discreto e Proporcional** aparecem desligados. A dica diz que o
  comportamento deles não foi confirmado.
- **Validação:** `modificarPontosDoMolde` recusa, com mensagem, índice fora do
  contorno, deslocamento inválido e contorno que ficaria sem área. Digitando
  não há a prévia do arrasto para mostrar o problema antes. O erro aparece no
  diálogo, que continua aberto.

### Redefinir perímetro (`domain/molde.ts`, `ui/PainelDeRedefinirPerimetro.tsx`)

- **O "elemento" é uma aresta do contorno.** O programa não tem elementos de
  modelagem soltos (ADR 0032), e a aresta é o que mais se aproxima deles.
- **Clique perto de uma aresta** (a até 10 px dela) abre o diálogo:
  - mostra "do ponto i ao ponto j" e o comprimento atual;
  - a ponta mais perto do clique vem marcada como a que anda.
- **Destaque no desenho:** antes do clique, a aresta sob o mouse fica grossa,
  em laranja, com o comprimento escrito. Com o diálogo aberto, o destaque
  fica na aresta escolhida, com um anel na ponta que anda. No bi-direcional,
  as duas pontas ganham anel e o meio, que fica parado, um traço.
- **Modos:**
  - **Uni-direcional:** só a ponta escolhida anda; a outra fica no lugar.
  - **Bi-direcional:** cada ponta anda metade da diferença.
  - Nos dois, a aresta não muda de direção. As arestas vizinhas acompanham a
    ponta que anda, com os piques delas na mesma proporção (`reancorarPiques`).
  - **Manter extremos** aparece desligado: a referência o define só para
    curvas, e aqui as arestas do contorno são retas.
- **Prévia** ao digitar: "Cresce 50,00 mm: só o ponto 1 anda.", ou "cada ponta
  anda 20,00 mm" no bi-direcional.
- **O modo usado por último** vem marcado na próxima aresta. A ferramenta
  continua ligada depois de aplicar.
- **Validação:** `redefinirComprimentoDaAresta` recusa:
  - comprimento zero ou negativo;
  - aresta sem comprimento (não há direção para crescer);
  - contorno que ficaria sem área;
  - encolher a ponto de deixar de fora um pique da própria aresta, com a
    mensagem "Exclua o pique antes, ou use um comprimento maior". Os piques da
    aresta não andam: um pique a 30 mm da ponta parada continua a 30 mm dela.

Isto substitui a seção "'Redefinir perímetro' não ganhou uma ferramenta
própria" do ADR 0016. O argumento dela continua certo para Manter extremos,
mas digitar o comprimento exato de uma aresta reta não era possível com o
Mover ponto.

### Comum às duas

- Botões habilitados com uma peça selecionada, com `aria-pressed` e a faixa
  de instruções de cada ferramenta.
- Cada aplicação é um passo de desfazer.
- Esc fecha primeiro o diálogo; um segundo Esc desliga a ferramenta.
- Os diálogos só existem enquanto a ferramenta está ligada. O estado deles é
  limpo ao entrar na ferramenta, ao sair dela e ao fechar.
- `ui/medidas.ts` reúne a leitura de medidas digitadas e a formatação em mm.
  O diálogo Mover cerca passou a usá-lo também.
- A tabela de atalhos (F1) diz que o Shift+clique num vértice vale para o
  Mover ponto e o Modificar.

## O que NÃO foi feito

- **Discreto e Proporcional** (Modificar): o manual não diz o que fazem com os
  pontos que não foram indicados.
- **Manter extremos** (Redefinir perímetro): só faz sentido com curvas, que o
  programa não tem.
- **Redefinir o perímetro do contorno inteiro:** não se sabe como a referência
  distribui a diferença entre as arestas.
- **Posição absoluta** no Modificar: só o deslocamento, como nos outros
  diálogos de medida.
- **Contorno que se cruza:** nenhuma das duas ferramentas impede, como o Mover
  ponto também não impede.
- **Conferência com a referência:** o comportamento implementado não foi
  comparado com um DXF de antes e depois feito nela. Se um chegar e mostrar
  outra coisa, este ADR deve ser revisto.

## Verificação (Electron real, build de produção)

- **Testes:** 381/381 em 30 arquivos (eram 342 em 28).
  - Novos: domínio 13, desenho 12 (Modificar 6, Redefinir perímetro 5 e o
    clique sem arrasto no Mover ponto, que não abre diálogo), diálogo Modificar
    6, diálogo Redefinir perímetro 8.
  - Três mutações à mão no desenho foram pegas pelos testes:
    - sair do desenho contando como soltar o botão;
    - abrir o diálogo também no Mover ponto;
    - ignorar o clique na aresta.
  - Typecheck limpo. Lint com 1 aviso antigo, não relacionado.
- **Roteiro automático, janela de 1440 × 900 visível:**
  - DXF sintético com um retângulo de 300 × 400 mm (1200,0 cm²). Os quatro
    vértices foram achados na tela pelas alças laranja. As medidas foram lidas
    no diálogo Propriedades da peça.
  - Botões: habilitados com a peça selecionada, com `aria-pressed` e a faixa
    de instruções de cada um.
  - Modificar, um ponto:
    - um clique no canto abriu o diálogo com "Ponto 4" e o foco na
      Horizontal;
    - Discreto e Proporcional, desligados;
    - −20 e −10, Tab entre os campos e Enter: 410 × 320 mm, 1255,0 cm², a
      conta esperada;
    - Ctrl+Z voltou a 400 × 300, 1200,0 cm².
  - Modificar, dois pontos:
    - um clique no meio da peça limpou a seleção de vértices;
    - Shift+clique nos dois cantos de cima e um clique num deles abriram
      "Pontos 3 e 4" e "N pontos: só os 2 indicados andam";
    - 0 e −15, confirmados com um clique no botão Modificar: 415 × 300,
      1245,0 cm²;
    - Ctrl+Z desfez.
  - Modificar, arrasto: um canto arrastado mudou a peça (462,2 × 399,4) sem
    abrir o diálogo. Ctrl+Z desfez.
  - Esc no Modificar: o primeiro fechou o diálogo e a ferramenta continuou
    ligada; o segundo a desligou e a faixa sumiu.
  - Redefinir perímetro, uni-direcional:
    - com o mouse sobre a aresta da esquerda, os pixels laranja passaram de
      178 (só as alças) para 611;
    - um clique perto de baixo abriu "do ponto 4 ao ponto 1", 400,00 mm,
      Uni-direcional e "Ponto 1" marcados, Manter extremos desligado;
    - 450 mostrou "Cresce 50,00 mm: só o ponto 1 anda.";
    - Enter: 450 × 300, 1275,0 cm². Ctrl+Z desfez.
  - Redefinir perímetro, bi-direcional:
    - na aresta de cima, "do ponto 3 ao ponto 4", 300,00 mm;
    - com Bi-direcional, as duas pontas ficaram desligadas;
    - 340 mostrou "cada ponta anda 20,00 mm";
    - Enter: 400 × 340, 1280,0 cm². Ctrl+Z desfez.
  - Na aresta da direita, o diálogo já veio com Bi-direcional. Esc fechou o
    diálogo e um segundo Esc desligou a ferramenta.
  - F1: a linha do Shift+clique cita o Modificar.
  - No fim: 400 × 300, 1200,0 cm², as medidas do começo.
- **Teclado no roteiro:**
  - O primeiro roteiro mandava o Enter só como keyDown, e o formulário não era
    enviado. O Chromium envia o formulário no keypress; o Enter do usuário gera
    os dois.
  - Com o keyDown, o caractere "\r" e o keyUp, o Enter passou a confirmar os
    diálogos. O programa não mudou.
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5). O
  roteiro usa uma pasta própria.
