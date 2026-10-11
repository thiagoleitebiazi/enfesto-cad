# ADR 0061 — A prega em cunha tem registro: fechar e mudar a abertura

## Contexto

A pence aberta por pivô com "Cortar intersecções" (ADR 0055) corta a peça em
todos os trechos da linha que estão dentro dela e gira um lado: o resultado é
uma prega em cunha. Ela ficava só desenhada. Sem registro, não havia como
fechá-la nem mudar a abertura depois — só com Ctrl+Z, enquanto desse.

## Decisão

### O registro

- A peça passa a guardar a prega (`cunhas`): os pontos em que a reta
  atravessava o contorno, na ordem dele, cada um com a ponta do lado que ficou
  e a do lado que girou; qual deles é a posição e qual é o pivô; as bordas
  desenhadas; os piques; e onde a numeração do contorno começava.
- O registro só vale enquanto a peça continua como foi aberta: cada ponta
  parada vizinha da movida no contorno, os trechos alternando entre o lado que
  ficou e o que girou, cada ponta movida sendo a parada girada em torno do
  pivô, e as bordas desenhadas no lugar. Mexida à mão, a prega deixa de ter
  registro (e nada quebra).
- Acompanha a peça movida, girada, espelhada, nos tamanhos da graduação e
  quando outra ferramenta move o lado em que ela está.

### Fechar e mudar a abertura

- **Fechar:** o lado que girou volta em torno do pivô, levando o que está
  nele; as bordas desenhadas e os piques da prega saem; as pontas que a
  abertura tinha posto no contorno saem; a numeração volta a começar onde
  começava.
- **Mudar a abertura:** fecha e abre de novo pela mesma reta, em torno do
  mesmo pivô.
- **Na tela:** com "Pence no contorno" (a ferramenta que a abriu) ou com
  "Pregas" (o que ela é), o clique dentro de um trecho aberto abre a janela
  "Prega em cunha: abertura", com a abertura e a caixa "Fechar esta prega". O
  mouse em cima põe o trecho em destaque. A mensagem de quando a prega é
  aberta diz que é assim que se mexe nela.
- O manual da referência diz que o resultado é uma prega e não diz como
  mudá-la ou fechá-la: **é leitura nossa**, e a janela diz.

### Um defeito no código comum: a linha que começa em cima do contorno

Uma mutação que sobreviveu mostrou o defeito. Quando uma pence ou uma prega
move um lado da peça, as linhas internas desse lado vão junto. A conta
decidia pela **primeira ponta** da linha — e a linha que vai de borda a borda
tem as pontas em cima do contorno, que é a divisa da região: ali "está
dentro?" tanto pode dar sim como não. Resultado: aberta uma prega ao comprido
de uma peça que já tinha a prega em cunha, o lado andava 20 mm e **as bordas
desenhadas da cunha ficavam para trás**. O mesmo valia para as dobras de uma
prega anterior e para as pernas de uma pence marcada.

Agora a linha vai com a região **em que está a maior parte dela** (conta o
meio de cada trecho; no empate, fica). A pence marcada é decidida pela linha
das pernas.

### A recusa que estava sem teste

A recusa "a peça dá a volta por fora da linha" (ADR 0055) não tinha um caso
que chegasse nela. Tem agora: uma peça **em caracol**, com um braço que sai
do alto, passa por cima da posição da pence, desce pelo outro lado e volta a
atravessar a linha. Nela os dois lados da linha são o mesmo pedaço de tecido,
e não há lado para girar: a recusa está certa.

## O que NÃO foi feito

- **A numeração depois de fechar uma prega comum ou uma pence por pivô**
  continua podendo começar em outro ponto (a peça é a mesma). Só a prega em
  cunha guarda o começo.
- **O ponto repetido não volta.** Os moldes reais de produção têm o último
  ponto do contorno repetindo o primeiro (vem da importação). Qualquer
  ferramenta que refaz o contorno tira o repetido; fechada a prega, a peça
  volta com um ponto a menos — o mesmo desenho, a mesma área.
- **Na peça graduada com regras que deformam**, o registro da prega em cunha
  não vale nos outros tamanhos (lá ela não é mais um giro). No tamanho base,
  vale.
- **Duas proteções sem teste** em `cunhaNoContorno` (os trechos têm de
  alternar; as duas pontas de um trecho têm de concordar): só valeriam para
  um registro que a conferência do giro, logo antes, já recusa.
- **Ninguém da modelagem olhou. Nada foi comparado com a referência em uso.**

## Verificação

- **Testes:** 1694/1694 em 81 arquivos (eram 1666 em 79); tipos e lint
  limpos (o aviso antigo do `useMemo` continua). Novos: o registro
  deixado ao abrir; as faixas e o que está perto; fechar devolve o contorno
  ponto a ponto, com o que tinha girado; a haste girando; o "E" de três
  trechos; a ponta que já era ponto do contorno; o contorno numerado a partir
  de uma ponta; a numeração de volta; mexida à mão; mudar a abertura e as
  recusas; movida, girada, espelhada, graduada; uma prega aberta depois, do
  lado dela e do outro; a janela, o clique e a prévia; a regra das linhas
  (borda a borda, atravessando a divisa, empate, pence marcada, prega
  registrada); e a peça em caracol.
- **Mutações:** 41, uma por vez, com o código conferido por hash antes e
  depois. 40 pegas (3 delas falhavam mais de 12 testes, e a primeira leitura
  da saída, cortada, não mostrava: foram repetidas contando as falhas).
  **1 sobreviveu de verdade** — e era o defeito das linhas, acima. Depois da
  correção, também é pega.
- **Electron real, peça de teste em "C":** abrir (15 pontos, 4 linhas, 2
  piques, registro com 4 travessias e 30,00 mm); clique dentro dela com
  "Pence no contorno" abre a janela com 30; mudada para 50 (751,1 cm²);
  clique no outro trecho com "Pregas" e "Fechar": a peça volta ponto a ponto;
  três Ctrl+Z e um Ctrl+Y certos; fora da prega o clique não abre a janela.
  **9 conferências, 0 falhas.**
- **Electron real, moldes reais pela tela** (cópias, fora do repositório):
  - **Projeto de produção**, nas duas peças que têm reentrância ("frente",
    805 pontos; "costa", 829): abrir com 20 mm (registro com 4 travessias);
    clique dentro da prega e abertura para 35 mm; clique dentro e "Fechar": a
    peça volta com cada ponto a menos de 1e-12 mm do original (sem o ponto
    repetido do fim), as mesmas linhas, sem piques e sem registro; três
    Ctrl+Z. **16 conferências, 0 falhas.**
  - **Projeto menor**, a peça "2" (69 pontos): **8 conferências, 0 falhas.**
    Foi ela que mostrou que, fechada a prega, a numeração começava em outro
    ponto: o registro passou a guardar o começo.
  - **A regra das linhas**, nas 4 peças de produção: uma pence aberta por pivô
    e uma prega em cada. 73 linhas internas andaram com o lado delas, nenhuma
    ficou para trás, fora da peça. **12 conferências, 0 falhas.** Nessas
    peças só 1 das 102 linhas internas começa em cima do contorno, e ela não
    estava no lado que andou: o defeito não aparecia nestes moldes — aparece
    nas linhas que as próprias ferramentas desenham.
  - **Os roteiros anteriores, repetidos:** o das seis ferramentas (ADR 0059),
    22 e 17 operações, 0 falhas; o do acabamento (ADR 0060), 100 e 76
    conferências, 0 falhas.
  - **Dois tropeços do ambiente de teste, não do programa.** (1) Com os
    testes de unidade rodando ao mesmo tempo, a leitura da posição do mouse
    atrasou e o roteiro recalibrou a vista 6 e 12 vezes; as operações saíram
    certas. (2) Numa rodada a janela abriu com 1280 × 701 em vez de
    1440 × 900 (a tela mudou de tamanho), e o clique numa opção de uma janela
    alta caiu fora dela: 12 conferências falharam. O roteiro passou a rolar
    até o campo antes de clicar; repetido, 100 certas.
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5).
