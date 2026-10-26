# ADR 0134 — Desenhar no manequim e tirar o pré-molde

## Contexto

O último item da segunda rodada do estudo: no provador da referência, desenha-se a roupa sobre o manequim 3D, e dela
saem os pré-moldes 2D. O Enfesto CAD só fazia o caminho contrário: do molde ao corpo (ADR 0111).

## Decisão

**1. O desenho é um contorno de pontos no tronco.** O tronco do manequim é feito de elipses em cada altura (a meia
largura em x, a meia profundidade em z; a frente em +z). Na aba nova "Desenhar no corpo" do provador:
- **Os pontos:** cada clique no desenho acha o ponto do corpo debaixo dele (`pontoDoCorpoNaTela`). É o triângulo do
  corpo que contém o ponto na tela, o mais perto da câmera; o ponto 3D sai pelos mesmos pesos.
- **Só o tronco conta** (`pontoNoTronco`: até 15% fora da elipse da altura). O clique na cabeça, num braço ou numa
  perna é dito e não entra.
- **Nessa aba,** o arrasto não gira a vista. Os botões Frente, Lado e Costas viram o corpo.
- **O contorno vermelho** acompanha por cima do desenho, fechado a partir de três pontos.
- **Os botões:** desfazer o último ponto, recomeçar, a folga (%) e o nome da peça.

**2. "Tirar o pré-molde" desenrola o desenho** (`preMoldeDoDesenho`, em `domain/desenhoNoCorpo.ts`).
- **A vertical** é a altura do ponto, de cima para baixo.
- **A horizontal** é o caminho em volta da elipse da altura dele, desde o meio da frente: positivo para o lado esquerdo
  do corpo, que de frente fica à direita na tela, como foi desenhado. A conta é por Simpson (`caminhoNaElipse`), vezes
  1 mais a folga.
- **A peça** sai com o fio em pé no meio e 10 mm de costura, e vai para o projeto depois das peças da mesa.
- **O desenho continua** no corpo, para tirar outra.
- **O que é recusado:** menos de três pontos, ponto fora do tronco, e o desenho sem área.

## O que não foi feito

- **A curvatura no comprimento:** o desenrolar é por altura. O busto e o quadril, que pedem pences para o tecido plano
  vestir o volume, saem como pré-molde sem pence (colado, para ajustar), e a pence é feita depois, com as ferramentas
  de pence.
- **Os braços e as pernas:** só o tronco (a manga vem do componente pronto, ADR 0133).
- **O desenho que dá a volta inteira no corpo** sai numa peça só, aberta no ponto onde o contorno começa. A divisão em
  frente e costas se faz depois, cortando a peça.

## Conferência

- `domain/desenhoNoCorpo.test.ts` (4):
  - **o caminho na elipse:** meia volta é meio perímetro, o lado direito é negativo, e o círculo dá o arco;
  - **o retângulo do busto à cintura:** a altura é a distância entre eles; a largura é duas vezes o caminho até o
    ângulo; com 10% de folga, 10% mais largo; o nome de partida;
  - **só o tronco:** o ponto da cabeça e o de fora da elipse são recusados; com menos de três pontos e sem área, não;
  - **o clique na tela** acha o ponto da frente do corpo (não o das costas), a menos de 15 mm; fora do corpo, nenhum.
- `npx vitest run`: 175 arquivos, 3059 testes passando. `npx eslint .` e `npx tsc -b --noEmit` sem erro;
  `npm run build` gera o programa.
- O teste de uso, no programa gerado: 109 conferências, nenhuma falha.
  - **O passo novo:** com o provador aberto de novo e a vista de frente, quatro cliques do mouse no peito e na
    cintura. Os 4 pontos entram, e o pré-molde vai para o projeto: a lista de peças da tela ganha "Pré-molde do corpo".
  - **Na foto,** o retângulo vermelho fica no peito do manequim.
  - **Dois ajustes no teste:**
    - com o provador aberto, o atalho de gravar não age, e a conferência passou a ser pela lista da tela;
    - a peça nova muda a lista do provador, e o passo ficou por último nele.
