# ADR 0050 — Os limites dos registros de curva e de pence

## Contexto

Os ADRs 0047 e 0048 deram dados próprios às pences e às curvas, com limites
que ficaram escritos:

- pences e curvas de projetos antigos, de peças importadas ou desenhadas à mão
  não tinham registro, e a curva com um ponto mexido à mão perdia o dela;
- arco tangente e curva pré-definida não eram registrados;
- na curva, não dava para mover as pontas sem perder o registro, nem pôr ou
  tirar pontos de passagem;
- na pence aberta por pivô, mudar a abertura refazia só o recorte;
- a metade guardada pelo "Manter dobra" não ia para os outros tamanhos.

O pedido foi fazer o que tinha ficado por fazer.

## Decisão

### Curvas

- **A curva acompanha as pontas.** Movida uma ponta (Mover ponto, Modificar,
  Redefinir perímetro, Cerca), a curva é refeita entre as pontas de agora,
  pelos mesmos pontos de passagem. A que anda inteira anda junto. Mexido um
  ponto do meio, o registro continua deixando de valer.
- **Pôr um ponto de passagem:** em "Editar pontos de curva", dois cliques no
  mesmo lugar de uma curva registrada. O ponto entra sobre a curva, e a forma
  quase não muda: ele serve para ser movido depois. O arco e a pré-definida
  não aceitam (a mensagem diz o que fazer).
- **Tirar um ponto de passagem:** com o anel escolhido, Delete. Tirado o
  último, o trecho fica reto e o registro sai.
- **Tornar um trecho uma curva editável:** o diálogo de "Editar pontos de
  curva" ganhou um segundo campo, opcional, com o número de pontos de
  passagem. O trecho vira uma curva registrada por pontos igualmente
  espaçados, e a mensagem diz quanto a forma mudou. É o caminho para a curva
  que veio de fora, foi desenhada ponto a ponto ou foi mexida à mão.
- **Arcos tangentes registrados:** o arco tangente à reta ou arco e os três
  arcos de canto (o canto arredondado por raio, inclusive pelo atalho) ficam
  registrados como arco, com o ponto do meio de passagem. Movido esse ponto, o
  arco deixa de ser tangente — é um arco pelos três pontos.
- **Curva pré-definida registrada:** pela forma do cadastro e pelas duas
  pontas. Não tem anéis; acompanha as pontas, esticando e girando como quando
  foi posta.

### Pences

- **Pence sem registro:** com "Pence no contorno", o clique no vértice de um
  canto que entra na peça (pernas a até 100° uma da outra) ou numa linha
  interna de três pontos com as pontas no contorno abre as medidas, lidas do
  desenho. Com "Pence interna", o mesmo para a linha fechada de quatro lados.
  O diálogo avisa que a pence foi reconhecida; é aplicando que ela passa a ter
  registro, e fechando sem aplicar nada muda.
  - A ponta que está na reta entre os vizinhos conta como posta pelo recorte e
    sai junto quando a pence é apagada; a que é um canto da peça fica.
- **Pence aberta por pivô:** o registro guarda o pivô. Mudando as medidas, a
  peça fecha em torno dele e abre de novo — o tecido que a abertura acrescenta
  muda junto. O diálogo não pede desvio (o vértice fica na linha até o pivô) e
  "Apagar" vira "Fechar": a peça volta a ser a de antes de abrir. Se o pivô já
  não está no contorno, vale o de antes: só o recorte.

### Metade guardada nos tamanhos

- Em cada tamanho, a metade guardada é trazida para cima da metade desenhada
  (espelhada na dobra), anda como um ponto dela e volta para o outro lado da
  dobra do tamanho. A dobra dela cai sobre a dobra do tamanho, e o "Desdobrar"
  de um tamanho separado traz a metade guardada, em vez de espelhar.

## O que NÃO foi feito

- **Alças de tangente** (as de curva de Bézier): a curva continua passando
  pelos pontos, sem alça de direção.
- **Mover as pontas pelos anéis:** as pontas movem-se com Mover ponto, e a
  curva acompanha. Um anel na ponta disputaria o clique que começa um trecho.
- **"Por raio" e "Espiral":** criam uma peça inteira, não um trecho; não têm
  registro. Para outro raio, refaz-se a peça ou usa-se Dimensionar.
- **Pregas:** continuam sem registro (ADR seguinte).
- **A pence marcada e a interna levadas pela Cerca** perdem o registro, como
  antes; agora podem ser reconhecidas de novo com um clique.
- Fechada a pence aberta por pivô, ficam no contorno dois pontos em linha reta
  (onde a pence abria e o pivô). Não mudam a forma.
- Durante o arrasto de uma ponta, o desenho mostra a curva antiga; a refeita
  aparece ao soltar.

## Verificação (Electron real, build de produção)

- **Testes:** 1356/1356 em 70 arquivos (eram 1306).
  - Typecheck limpo. Lint com 1 aviso antigo, não relacionado.
  - 29 mutações guardadas, uma por vez: todas pegas, e os oito arquivos
    conferidos por hash depois.
- **Roteiro automático**, conferido no arquivo salvo:
  - **Pence por pivô** de 40 × 100 numa peça de 1200 cm²: 1259,9 cm². Mudada a
    abertura para 60: 1289,7 cm², o mesmo que abrir direto com 60. Fechada:
    1200,0 cm².
  - **Pence desenhada à mão** (peça contornada com um "V"): o clique no
    vértice abriu as medidas (62,16 × 102,56, lidas do desenho) com o aviso.
    Fechado sem aplicar, nenhum registro. Aplicado com profundidade 80, a
    pence ficou registrada e a peça passou de 867,5 para 874,5 cm².
  - **Curva e Mover ponto:** arrastada a ponta, a curva foi refeita de
    (428; 331,1), pelo mesmo ponto de passagem, e o registro continuou valendo.
  - **Dois cliques** na curva puseram um ponto de passagem; **Delete** tirou-o
    (a peça não foi apagada).
  - **Trecho reto tornado curva** com 2 pontos de passagem: "A forma não
    mudou". Movido um anel 40 mm, a peça foi de 1200,0 para 1256,1 cm².
  - **Arco tangente** e **canto arredondado** ficaram registrados como arco.
  - Validação sem problemas no fim.
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5).
