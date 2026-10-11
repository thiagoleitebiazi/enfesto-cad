# ADR 0074 — Aba Marcações: o que faltava nos piques (espelho, redesenhar, Substituir nos internos)

## Contexto

Os ADR 0071 a 0073 deixaram itens em "O que NÃO foi feito". Este ADR fecha
três deles:

- "A forma de um formato cadastrado não se edita" (0072).
- "Formato cadastrado que não é simétrico: na peça espelhada o ângulo troca de
  sinal, mas o desenho não é espelhado" (0072).
- "O Substituir não mexe nos piques internos, só nos do contorno" (0071).

Ao refazer o espelho apareceram dois defeitos que não estavam na lista:

- O **pique interno** da peça espelhada só trocava o sinal do ângulo. Um bico
  que apontava para cima continuava apontando para cima, com a peça virada.
- O desenho cadastrado, no **contorno**, saía com a direita e a esquerda
  trocadas conforme o sentido em que o contorno foi desenhado.

## Decisão

### O pique na peça espelhada

- **Do contorno:** o ângulo, contado do esquadro com a borda, troca de sinal
  (como já era). O desenho cadastrado é espelhado.
- **Interno:** o ângulo dele é contado da tela, então passa a ser o dobro da
  direção do espelho menos o que era. No "Espelhar" da peça, o que estava a
  0° vai a 180°; a 30°, a 150°. O desenho cadastrado é espelhado.
- O formato cadastrado ganhou a marca **espelhado**. Os tipos do programa são
  simétricos e não precisam dela.
- Espelhada duas vezes, a peça volta a ter os formatos que tinha.
- O **"Desdobrar"** faz o mesmo nas cópias: antes, a cópia do pique com ângulo
  ficava com o ângulo do original.

### O desenho cadastrado tem sempre a mesma mão

- No contorno, o desenho cadastrado sai como foi desenhado (de pé na tela, a
  borda embaixo), seja qual for o sentido do contorno.
- Os tipos do programa são simétricos: nada muda neles.

### Cadastrar pique: alterar também a forma

- O "Alterar" ganhou duas caixas:
  - **Redesenhar a forma:** depois de confirmar, as linhas do desenho novo são
    indicadas como no "Criar" (cliques, Enter, ponto de referência). O
    cadastrado continua o mesmo, com a forma nova.
  - **Levar a mudança aos piques deste projeto já postos com o formato:** os
    do contorno e os internos ganham a forma e o nome novos. As medidas, o
    ângulo e o espelhamento de cada um ficam como estão.
- Sem a segunda caixa, o pique já posto guarda a forma que tinha (como antes).
- A mensagem diz quantos piques do projeto foram atualizados.
- Só os piques **deste projeto** são alcançados: os de outros projetos guardam
  a forma que tinham quando foram postos.

### Substituir: também os piques internos

- Caixa nova: **"Também os piques internos do tipo escolhido"**. Vale na
  troca de formato e na remoção.
- Pique interno é a marca com formato. O ponto sem formato não entra.
- "Substituir por marca" continua sendo só para os do contorno.
- A lista de tipos da janela conta os que só os internos usam.
- A mensagem diz quantos são do contorno e quantos são internos.
- *O manual da referência só fala dos piques do contorno; os internos são
  leitura nossa*, dita na nota da janela.

## O que NÃO foi feito

- **O Ctrl+Z não desfaz o cadastro:** ele devolve as peças (os piques que
  tinham sido atualizados voltam à forma de antes), mas o formato redesenhado
  continua redesenhado no cadastro deste computador. Já era assim no "Criar".
- **Nada foi comparado com o programa de referência em uso.**

## Verificação

- **Testes:** 1939/1939 em 88 arquivos (eram 1927); tipos e lint limpos (o
  aviso antigo do `useMemo` continua). Novos: cada pique da peça espelhada
  conferido ponto a ponto contra a imagem no espelho do que era — do
  contorno, interno e cadastrado; a peça desdobrada; o mesmo desenho nos dois
  sentidos do contorno; o Substituir com e sem os internos; o Cadastrar que
  troca o nome e o que redesenha, levando ou não aos piques postos.
- **Mutações:** 41, uma por vez, com o código conferido por hash antes e
  depois. Todas pegas.
- **Electron real, peças de teste:**
  - um L desenhado e cadastrado; posto no contorno e dentro da peça;
  - a peça espelhada: os dois desenhos ficam espelhados na tela, e o interno
    passa a 180°; Ctrl+Z devolve;
  - "Alterar" com "redesenhar" e "levar a mudança": o cadastrado é o mesmo,
    com a forma nova, e os dois piques postos a ganham;
  - "Alterar" só do nome, levando aos piques postos;
  - "Substituir" com os internos (os dois viram U) e sem (só o do contorno);
  - o cadastro e a peça voltam ao que eram.
  - **17 conferências, 0 falhas.** Na primeira rodada o roteiro deu um Ctrl+Z
    a mais e desfez a peça de teste; corrigida a conta, a rodada foi repetida.
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5).
