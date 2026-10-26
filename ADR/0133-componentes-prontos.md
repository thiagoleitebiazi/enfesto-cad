# ADR 0133 — Os componentes prontos, pelas medidas

## Contexto

Da segunda rodada do estudo: a referência tem uma biblioteca de componentes (golas, mangas, bolsos) para montar o
modelo sem desenhar cada peça do zero. No Enfesto CAD, cada bolso, punho ou cós era desenhado ponto a ponto, ou
copiado de outro projeto. A base aprovada (ADR 0126) traz peças inteiras de um modelo, não as pequenas que se
repetem.

## Decisão

**1. Cinco componentes, feitos pelas medidas** (`componente`, em `domain/componentes.ts`). Cada um sai com o fio, a
costura de 10 mm e os piques do lugar:
- **Bolso chapa:** a largura, a altura e o bico do fundo (0: reto).
- **Punho e cós:** a volta (o punho, a cintura) mais o transpasse, no dobro da altura acabada, com a dobra no meio
  (linha interna). Os piques vão no transpasse e no meio, em cima e embaixo.
- **Gola padre:** o decote inteiro, a altura e quanto a borda de baixo sobe na frente. As duas bordas acompanham a
  subida, e o pique vai no meio das costas.
- **Manga básica:**
  - **As medidas:** a cava do corpo (frente e costas), o comprimento, a boca, a altura da cabeça e a folga.
  - **A cabeça** é uma curva de Bézier de axila a axila. A largura da manga é procurada (por bisseção) até a cabeça
    medir a cava mais a folga (`larguraDaManga`).
  - **Os lados** descem retos até a boca. O pique vai no alto da cabeça (o ombro).
- **O que é recusado:** a medida abaixo do mínimo, o bico maior que o bolso, a boca maior que a manga, o comprimento
  que não passa a cabeça.

**2. O comando "Componente pronto"** (aba Produção, Definir moldes):
- a primeira janela escolhe o componente, cada um com a explicação;
- a segunda pede as medidas dele, com os valores de partida.

A peça entra depois das que estão na mesa, alinhada pelo alto (`componenteNoProjeto`), fica escolhida, a vista se
ajusta, e a faixa de mensagens diz o que foi criado. Ctrl+Z desfaz. Daí em diante é uma peça como as outras.

**3. A janela de campos fecha depois de aplicar.** Na passagem da escolha para as medidas, o "fechar" da primeira
janela apagava a segunda. Agora ele só fecha a janela da escolha.

## O que não foi feito

- **A manga pela cava desenhada:** a cava é digitada. Medir a cava da frente e das costas no molde e trazer o número
  ficaria para um passo seguinte.
- **A gola esporte (com pé) e o colarinho:** só a gola em pé.
- **Componentes cadastrados pela empresa:** a biblioteca é fixa. As peças da empresa vêm pela base aprovada (ADR 0126).

## Conferência

- `domain/componentes.test.ts` (7):
  - **cada um** sai uma peça válida, e cada pique fica em cima da aresta que o registro diz;
  - **o bolso** com e sem bico;
  - **o cós** de 730 × 80 mm, com a dobra e os piques do transpasse e do meio;
  - **a gola,** com a borda de baixo de 400 mm subindo 15 mm na frente;
  - **a manga,** com a cabeça de 455 mm (440 de cava + 15 de folga), 600 de comprimento e 260 de boca; com mais cava,
    mais larga; os recusados;
  - **as medidas,** com o padrão e o mínimo;
  - **o lugar,** depois das peças da mesa.
- `ui/BarraDeFerramentas.test.tsx`: o botão em Definir moldes, abrindo a escolha.
- `npx vitest run`: 174 arquivos, 3055 testes passando. `npx eslint .` e `npx tsc -b --noEmit` sem erro;
  `npm run build` gera o programa.
- O teste de uso, no programa gerado: 108 conferências, nenhuma falha. A nova: Componente pronto › Manga, com a cava de
  460 mm. A manga gravada tem a cabeça de 475,0 mm e o pique do ombro, depois das peças da mesa. Foi esse passo que
  achou o fechar da primeira janela apagando a segunda.
