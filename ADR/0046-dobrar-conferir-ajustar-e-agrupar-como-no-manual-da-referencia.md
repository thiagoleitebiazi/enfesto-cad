# ADR 0046 — Dobrar, Conferir, Ajustar e Agrupar como no manual da referência

## Contexto

Sete ferramentas tinham sido feitas pela "leitura natural do nome", porque eu
não tinha a descrição delas: Dobrar, Desdobrar, Múltiplas pences, Fechar pence
com pivô, Deduzir, Graduar curva e Ajustar. O Conferir (ADR 0044) também.

Uma nova pesquisa achou, publicado na internet, o **manual digital da
referência (versão 10)**, com o passo a passo da maioria das ferramentas. Ele
foi lido inteiro nas partes de moldes e de graduação. O que ele mostrou:

- **Dobrar ou desdobrar molde:** três modos (Horizontal, Vertical, Elemento) e
  duas opções, "Manter dobra do molde" e "Fio no centro do molde". O nosso só
  dobrava por dois pontos do contorno e sempre espelhava ao desdobrar.
- **Conferir medidas entre moldes:** o segundo molde se move sobre o contorno
  do primeiro, "como se estivesse sendo costurado", e um clique marca os pontos
  de encontro. O nosso só comparava dois comprimentos.
- **Ajustar graduação:** ponto inicial, pontos a ajustar e ponto final. O nosso
  somava um acréscimo aos pontos clicados — outra coisa.
- **Agrupar ou desagrupar graduação:** organiza os tamanhos a partir de um
  ponto de referência, com a distância de um ao outro. O nosso juntava pontos
  num grupo com a mesma regra — outra coisa.
- **Fechar pence** e **Graduar curva** estão no manual (a segunda com o nome
  "Adicionar ou remover ponto de curva graduado") e já batiam.
- **Múltiplas pences** e **Deduzir** não aparecem: são de versões mais novas.

## Decisão

### Dobrar e Desdobrar

- O Dobrar abre uma janela com **onde passa a linha de dobra**:
  - **Horizontal** e **Vertical**: a linha deitada ou em pé, pelo meio da peça.
  - **Elemento**: uma linha interna reta da peça, que o usuário indica. Vale a
    reta inteira dela, de borda a borda, e a linha some (virou a aresta).
  - **Dois pontos do contorno**: o modo que já existia, a mais.
- Depois, um clique dentro da peça escolhe o lado que fica.
- **Manter dobra do molde:** a metade que sai fica guardada na peça, fora do
  desenho, com os furos, linhas, marcas e piques dela. O Desdobrar, nessa
  aresta, traz a metade de volta como era, em vez de espelhar a que ficou. É
  para a peça que não é simétrica.
  - A metade guardada anda, gira, espelha e é dimensionada com a peça.
  - Se a dobra for mexida (um ponto dela movido), a metade já não encaixa: o
    Desdobrar espelha, e a mensagem diz por quê.
  - Sem a opção, vale o de antes: o que mudar na metade que ficou vale para as
    duas.
- **Fio no centro do molde:** a linha de fio vai para o meio da peça, ao dobrar
  e ao desdobrar.
- A linha do meio que cruza o contorno em mais de dois pontos é recusada, com a
  saída (indicar a dobra por dois pontos).

### Conferir

- A janela pede o **desconto** da 1ª costura (o que ela encolhe ao costurar) e
  o que o clique marca: um pique em cada peça, um ponto, ou nada.
- Cada costura é indicada com dois cliques no contorno: o começo, que é o ponto
  de referência, e o fim. Vale o caminho mais curto entre os dois, saindo do
  primeiro clique.
- Com as duas indicadas, **a segunda peça anda sobre a costura da primeira**:
  passando o mouse pela 1ª costura, o desenho mostra a outra peça encostada
  nela, com o ponto que casa em cima do ponto sob o mouse e as peças de lados
  opostos da costura.
- A faixa dá o veredito (conferem, ou qual sobra, de quanto e em %), com o
  desconto aplicado, e a distância do ponto atual ao começo.
- **Um clique marca o ponto de encontro** nas duas peças, à mesma distância do
  começo de cada costura. Depois do fim da 2ª costura não há o que marcar.
- A comparação de dois comprimentos, que era o Conferir do ADR 0044, saiu.

### Ajustar graduação

- Cliques: o ponto inicial, os pontos a ajustar e o ponto final; um segundo
  clique no ponto final confirma. O desenho mostra a projeção (o tamanho da
  ponta) antes de confirmar.
- Os pontos do meio passam a andar **na proporção entre o inicial e o final**,
  pela posição de cada um ao longo do contorno. Só DX, só DY ou os dois.
- Pontos espalhados pelos dois lados da peça usam a projeção na reta do inicial
  ao final.

### Agrupar ou desagrupar

- A janela pede **DX ponto** e **DY ponto** (a distância de um tamanho ao
  outro) e o tamanho a mexer (ou todos). Um clique indica o ponto de referência.
- Com DX e DY em zero, os tamanhos ficam empilhados no ponto (agrupados); com
  um valor, cada um fica afastado do vizinho (desagrupados). A forma de cada
  tamanho não muda: a peça do tamanho anda inteira.
- O agrupamento de pontos (vários pontos com a mesma regra), que era a leitura
  antiga, saiu, com o campo `grupo` dos pontos graduados.

### O que continua como leitura natural, dito na tela

- **Múltiplas pences** e **Deduzir:** não estão no manual. O Deduzir faz o
  mesmo que o Agrupar com distância zero, e a dica diz isso.
- **Fechar pence com pivô:** o manual dá a ordem dos cliques, mas não o que o
  pivô faz. A nossa construção (a peça é cortada do vértice ao pivô e um lado
  gira) continua sendo leitura nossa.
- **Dobrar horizontal e vertical:** o manual não diz por onde passa a linha.
  Aqui, pelo meio da peça.
- **Ajustar:** o manual dá os passos, não a conta. A proporção ao longo do
  contorno é leitura nossa.

## O que NÃO foi feito

- **Conferir:** "Usar costura" (conferir pela linha de corte), digitar o valor
  de "Atual" e escolher a peça de "Referência".
- **Graduar via mouse, modo Proporcional**, e **"Ajustar curvas"** ao unir
  tamanhos: continuam como no ADR 0040.
- **Metade guardada na graduação:** os outros tamanhos de uma peça dobrada com
  "Manter dobra" não levam a metade guardada na medida deles.
- **As outras ferramentas do manual** (pences, pregas, bainha, cortar, unir,
  tabela, tangente, copiar) não foram relidas linha a linha contra o texto
  novo; tinham sido feitas a partir dos campos do mesmo manual.
- **Conferência com a referência em uso:** o manual descreve os passos, não os
  números. Não houve como rodar o programa de referência.

## Verificação (Electron real, build de produção)

- **Testes:** 1242/1242 em 67 arquivos (eram 1184 em 65).
  - Novos ou refeitos: dobra (domínio 17, interface 18), conferência 19,
    graduação (Agrupar 5, Ajustar 5, interface 7).
  - Typecheck limpo. Lint com 1 aviso antigo, não relacionado.
  - 17 mutações guardadas, uma por vez. 16 foram pegas de primeira; uma
    sobreviveu (a metade guardada com o contorno no outro sentido não tinha
    teste). O teste foi escrito, e a mutação passou a ser pega. Os seis
    arquivos foram conferidos por hash depois.
- **Roteiro automático**, conferido no arquivo salvo. Peça de 400 × 300 mm:
  - **Dobrar horizontal, mantendo:** ficaram 600 cm² (x de 0 a 200) e 600 cm²
    guardados (x de 200 a 400). **Desdobrar** trouxe a metade guardada: 1200
    cm², 6 pontos, sem metade guardada, a dobra como linha interna.
  - **Dobrar vertical com o fio no centro:** 600 cm² (y de 0 a 150), o fio em
    y = 75; desdobrando, 1200 cm² e o fio em y = 150.
  - **Dobrar por elemento:** uma linha interna em x = 120,2 deu a dobra; ficou
    a peça de x 120,2 a 400 (839,5 cm²), sem a linha.
  - **Conferir:** 300 mm com 400 mm, "Não conferem: a 2ª é 100,0 mm maior
    (33,3%)". Com o mouse a 117 mm, um clique marcou piques em (400, 117) numa
    peça e em (100, 617) na outra — 117 mm do começo de cada costura. Com
    20 mm de desconto e 300 com 300, "a 2ª é 20,0 mm maior (7,1%)".
  - **Ajustar:** do ponto 4 ao ponto 2, passando pelo 1 (400 de 700 mm do
    caminho): o ponto 1 ficou com 4/7 da regra do ponto 2 — (4, 8) de (7, 14).
  - **Agrupar** no ponto 2 zerou a regra dele e descontou-a dos outros;
    **desagrupar** com DX 50 deixou cada tamanho a 50 mm do vizinho.
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5).
