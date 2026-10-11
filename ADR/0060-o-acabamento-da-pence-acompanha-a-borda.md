# ADR 0060 — O acabamento da pence acompanha a borda

## Contexto

O acabamento da pence dobrada para um lado (ADR 0058) era um ponto só, o bico:
a borda vizinha, tomada como uma reta, espelhada na perna até a linha do meio.
Numa borda curva — uma cava, um decote, uma cintura — isso é uma aproximação:
dobrada a pence, a borda que passa por cima dela é a curva, e não a reta do
primeiro trecho. E o lado da dobra só podia ser escolhido ao abrir a pence;
para trocar, era preciso fechar e abrir de novo.

## Decisão

### O traçado, seguindo a borda

- Dobrada para um lado, a borda desse lado é **seguida ponto a ponto**, cada
  ponto espelhado na perna, até cruzar a linha do meio da pence: aí está o
  bico. A outra metade é o espelho dessa na linha do meio. É o mesmo traçado
  de ofício de antes; o que muda é que a borda deixa de ser tomada por reta.
- Numa borda reta dá o mesmo ponto de antes, e só ele: os pontos em linha não
  ficam no contorno.
- O registro da pence guarda os pontos (`capa`), da primeira ponta para a
  segunda, quando são mais de um. Sem o campo, o contorno passa só pelo bico:
  os projetos já salvos continuam valendo.
- O registro acompanha a peça movida, girada, espelhada, graduada e a região
  movida, como o resto da pence (um ajudante só, `penceLevada`, nos três
  lugares). Mexido à mão um ponto do acabamento, o registro deixa de valer.

### Quando a dobra não alcança a borda

O contorno passa reto pelo meio das pontas quando:

- a borda espelhada **não vem por dentro da pence** — continua a perna, ou
  passa para o outro lado dela. Sem esse limite, o acabamento voltaria por
  cima do próprio contorno;
- a borda espelhada **só encontraria a linha do meio longe demais**: a mais de
  4 aberturas da ponta, medido ao longo da borda. O número é escolha nossa:
  corresponde a uma borda que sai a menos de uns 7° da direção em que nunca
  encontraria.

### O bico "sem lado" também segue a borda

- Sem lado de dobra, o bico continua sendo um ponto, a meio caminho entre os
  bicos das duas dobras, contando só a que sai para fora. Mas cada um deles é
  agora achado **seguindo a borda de verdade**, com os mesmos limites.
- Antes era pela semirreta do primeiro trecho, sem limite: **defeito achado
  no teste com os moldes reais** (ver a verificação).

### O lado da dobra na janela das medidas

- A janela das medidas da pence com acabamento ganhou o campo do lado da
  dobra (sem lado, esquerda, direita), com o lado atual marcado. Aplicando, o
  acabamento é refeito para as medidas e para o lado. A mensagem diz como
  ficou.
- A pence sem acabamento não tem o campo.

## O que NÃO foi feito

- **Pernas de comprimentos diferentes** (a pence com desvio do vértice): a
  linha do meio continua sendo a do vértice ao meio das pontas, e não a
  bissetriz. A segunda metade do acabamento termina na ponta da pence, com um
  pequeno canto. No ofício as pernas são igualadas antes do acabamento.
- **A pence de pernas curvas** não tem acabamento: o registro dela é o das
  três pontas.
- **O acabamento sem lado continua sendo um ponto**, e não a média das duas
  curvas.
- **O alcance de 4 aberturas é escolha nossa**, sem fonte.
- **Uma guarda sem teste:** o bico "atrás do vértice". Para acontecer, a borda
  teria de dar a volta por baixo do vértice da pence — o vértice estaria fora
  da peça. Fica como proteção.
- **Ninguém da modelagem olhou.** As fotos da boca da pence nos moldes reais
  estão em `revisao-local/` (fora do git).
- **Nada foi comparado com o programa de referência em uso.** O manual dele
  tem a opção do acabamento e não diz a conta.

## Verificação

- **Testes:** 1666/1666 em 79 arquivos (eram 1650 em 78); tipos e lint limpos (o aviso antigo do `useMemo` continua). Novos: a metade do lado da dobra é a borda espelhada
  na perna, e a outra o espelho na linha do meio, para os dois lados; os
  pontos estão no contorno em ordem; borda reta com pontos no caminho dá um
  ponto só; o registro com as pontas na outra ordem; tirar o acabamento
  devolve o contorno; o registro acompanha a peça movida, espelhada e
  graduada, e deixa de valer se um ponto é mexido; mudar as medidas e trocar
  o lado; os três casos em que a dobra não alcança a borda; o bico sem lado
  numa borda que vira; a janela das medidas com o campo, com e sem pivô.
- **Mutações:** 25 de 25 pegas, uma por vez, com o código conferido por hash antes e depois (os limites da dobra, os pontos em linha, a ordem dos pontos e a do registro, achar e tirar o acabamento, o lado novo ao mudar as medidas, o bico sem lado, o registro levado com a peça, a janela das medidas).
- **Electron real, moldes reais pela tela** (cópias, fora do repositório): em
  cada peça, a pence aberta com acabamento para a esquerda, o lado trocado
  pela janela das medidas, depois "sem lado", e três Ctrl+Z.
  - **Projeto de produção** (4 peças, 445 a 829 pontos), em dois lugares de
    cada peça — o meio do lado de cima e um trecho curvo e liso achado pelo
    roteiro: **100 conferências certas, 0 falhas.** Nos trechos curvos, os 8
    acabamentos com lado têm 3 pontos; a metade do lado da dobra, espelhada de
    volta, cai nos pontos da borda (erro abaixo de 1e-12 mm). O acabamento
    afasta-se de 0,17 a 0,37 mm do bico de um ponto só: numa pence de 30 mm,
    numa curva de molde, é pouco — e é o que a conta dá.
  - **Projeto menor** (4 peças, 37 a 69 pontos): **48 conferências certas, 0
    falhas.** Em duas peças a pence caiu numa ponta da peça, e a borda do lado
    da dobra faz um canto logo depois: o acabamento repete o canto (13 mm de
    diferença para o bico de um ponto só).
  - **O defeito do bico sem lado:** nessas duas peças, "sem lado" punha o bico
    a **192,9 mm e 131,8 mm** para fora da reta das pontas — um espigão, e um
    erro de validação a mais. Com a borda seguida de verdade, ficou a 21,4 e
    20,5 mm, e o erro de validação sumiu.
  - Depois dos Ctrl+Z, todas as peças voltaram ao que eram.
- **Biblioteca de projetos do usuário:** intacta (5 arquivos, mesmo MD5).
