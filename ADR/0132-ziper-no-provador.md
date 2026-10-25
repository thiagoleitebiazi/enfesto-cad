# ADR 0132 — O zíper como aviamento no provador 3D

## Contexto

Da segunda rodada do estudo: o provador da referência põe aviamentos na roupa, como o zíper numa costura. O Enfesto
CAD já mostrava os botões (os furos do molde, ADR 0111), mas não tinha zíper.

## Decisão

**1. O zíper é da costura** (`Costura3D.ziperMm`): o comprimento, em mm, do alto da costura para baixo. Na aba
Costuras do provador, cada costura ganha o campo "Zíper (cm)"; em branco, sem zíper. Ele fica guardado na montagem e é
lido de volta (até 2 m).

**2. A simulação guarda o caminho de cada costura** (`cadeiasDasCosturas`): os pontos do lado A, na ordem do trecho.

**3. O desenho** (`montarCena`, em `ui/cena3d.ts`):
- **O caminho:** o zíper começa na ponta mais alta da costura (a cintura da saia) e desce até o comprimento, cortando
  o último pedaço no meio, se for o caso.
- **A profundidade:** cada pedaço é um item com a sua, um pouco à frente do tecido. O que fica atrás do corpo some
  atrás dele.
- **O que se vê:**
  - a fita escura, de uns 14 mm e nunca menos de 3 pixels;
  - os dentes, um tracejado claro;
  - no alto, o cursor.

**4. Só a vista muda:** pôr, mudar ou tirar o zíper não recomeça a simulação. A chave da física deixa o zíper de fora.

## O que não foi feito

- **O zíper na física:** ele não é mais duro nem mais pesado que o tecido.
- **O zíper invisível e o destacável,** e a cor do zíper: há um zíper só, escuro.
- **A biblioteca de componentes** (golas, mangas prontas) e **o desenho no manequim**: ficam na lista.

## Conferência

- `ui/cena3d.test.ts` (2 novos):
  - **na costura em pé de 400 mm, o zíper de 250 mm** vira três pedaços (o último pela metade). O cursor vai no
    pedaço mais alto, nos dois sentidos da costura, e a largura fica entre 3 e 18 pixels;
  - **o zíper mais comprido que a costura** vai até o fim dela.
- `ui/PainelDoProvador3D.test.tsx`: o campo em cm guarda em mm; em branco, tira o zíper.
- `npx vitest run`: 173 arquivos, 3047 testes passando. `npx eslint .` e `npx tsc -b --noEmit` sem erro;
  `npm run build` gera o programa.
- **O teste de uso,** no programa gerado: 107 conferências, nenhuma falha.
  - **O passo novo:** com a saia assentada, 18 cm de zíper numa lateral. A cor da fita é contada no desenho em cada
    vista: 80 pixels de frente, 76 de costas, 5 de lado (o braço cobre a lateral). A saia continua assentada.
  - **A primeira largura,** 9 mm, deixava o zíper quase invisível com o corpo inteiro na tela, e passou a 14 mm, com
    o mínimo de 3 pixels.
