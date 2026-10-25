# ADR 0128 — Extrair todas as regiões de uma vez

## Contexto

O quinto item da segunda rodada do estudo: a referência tira "vários moldes com um clique". O modelista desenha a base
e as linhas de recorte (a pala, o recorte princesa, o bolso, o pé da gola), e todas as regiões viram peças de uma vez.

O Enfesto CAD tinha o "Extrair molde" (ADR 0043), uma região por clique. Uma camisa com pala, frente e vista são três
cliques. Uma jaqueta de recortes são dez, e é fácil esquecer uma faixa estreita entre duas linhas.

## Decisão

**1. Todas as regiões da peça** (`regioesDaPeca`, em `domain/elementos.ts`): cada uma é achada como no "Extrair molde",
por um ponto de dentro dela (`regiaoDaPeca`).
- **Os pontos de partida:**
  - uma grade de 48 × 48 sobre a peça;
  - os pontos de cada lado das linhas internas, a 0,5 mm, ao longo de cada trecho (em 10, 30, 50, 70 e 90% dele).
- **Por que os dois:** toda região encosta numa linha, então a faixa estreita entre duas linhas também tem os pontos
  dela, mesmo que a grade passe por cima.
- **Os pontos que não contam:** os que caem numa região já achada, ou perto demais de uma linha ou da borda.
- **A mesma região** achada de novo fica uma só.
- **O laço fechado** (o bolso desenhado) é uma região. O resto da peça, com o furo do bolso, não é: não é uma forma
  sem furo.
- **A ordem** é a de leitura na tela: de cima para baixo, por faixas de 1 cm, e da esquerda para a direita. É ela que
  dá os nomes, "Frente (2)", "Frente (3)"…

**2. O comando "Extrair todas"** (aba Produção, Definir moldes, sob "Sentido do fio"), na peça selecionada, sem
cliques no desenho (`extrairTodasAsRegioes`, em `ui/ferramentasDeElemento.ts`):
- **As peças novas:** uma por região, feita pelo mesmo `extrairMolde`. Ela leva os furos, as linhas internas e as
  marcas que estão dentro, os piques da borda que herdou e o fio da parte.
- **O lugar delas:** em fila, depois das peças que já estão na mesa, a 20 mm uma da outra, como a extraída de uma em
  uma.
- **A tela:** ficam marcadas, a vista se ajusta a elas, e a faixa de mensagens diz quantas são e os nomes.
- **A conta das áreas:** o recado diz se juntas elas cobrem a peça inteira. Se uma região estreita demais ficou de
  fora, diz quanto da área foi, e que dá para extraí-la com "Extrair molde".
- **A peça de origem não muda.** Um Ctrl+Z tira todas.
- **Sem linha que divida a peça,** o recado diz o que falta, e nada muda.

## O que não foi feito

- **As regiões entre peças diferentes:** cada peça é dividida pelas linhas dela. A linha de uma peça não corta outra.
- **A região com furo** (a peça em volta de um bolso fechado): ela ficaria com um furo, e a extração dá peças sem furo.
- **Escolher quais regiões tirar:** saem todas, e as que sobram são apagadas na lista.

## Conferência

- `domain/elementos.test.ts` (5 novos):
  - uma linha de borda a borda dá duas regiões;
  - duas que se cruzam dão quatro, na ordem de leitura, juntas a peça inteira;
  - a faixa de 2 mm entre duas linhas é achada;
  - o laço fechado dá a região dele;
  - a linha que não chega à borda não dá nenhuma.
- `ui/ferramentasDeElemento.test.ts` (2 novos):
  - as quatro regiões viram "Frente (2)" a "(5)", com 10 000 e 20 000 mm², em fila a partir de 20 mm depois da última
    peça e 20 mm uma da outra; o recado;
  - sem linhas, nada muda e o recado diz o que falta.
- `ui/BarraDeFerramentas.test.tsx`: o botão em Definir moldes, chamando o comando.
- `npx vitest run`: 170 arquivos, 3031 testes passando. `npx eslint .` e `npx tsc -b --noEmit` sem erro;
  `npm run build` gera o programa.
- O teste de uso, no programa gerado: 104 conferências, nenhuma falha, nenhum aviso no console. As três novas usam a
  pala de teste (`scripts/teste-de-uso/pala-de-teste.dxf`): 30 × 20 cm, com duas linhas internas que se cruzam, na
  camada de linhas internas.
  - a pala entra com as duas linhas;
  - "Extrair todas" faz as quatro peças de 150 cm², depois de todas as que estavam na mesa, juntas a pala inteira, com
    o recado;
  - um Desfazer tira as quatro.
