# ADR 0116 — O zoom e a grade no desenho técnico

## Contexto

O desenho técnico (ADR 0107) deixou em "O que não foi feito": "Não há zoom nem grade na folha: ela cabe inteira na
tela." Na tela do usuário (1280 × 720), a folha de 400 × 500 fica com uns 390 × 490 px. O detalhe pequeno de um
bolso, de uma vista ou de um pesponto não dava para desenhar com precisão. E não havia como alinhar dois pontos (a
altura dos bolsos, os dois lados de um recorte) a não ser no olho.

O mesmo ADR também listou "as estampas em formato que o PDF não lê (fora PNG e JPEG) ficam de fora do PDF".

## Decisão

**1. O zoom.**
- **A roda do mouse** aproxima e afasta em volta do ponto debaixo dele: esse ponto fica parado na tela.
  - O ouvinte é do próprio SVG e não é passivo, então a roda não rola a janela junto.
- **Os controles** ficam por cima da folha, no canto de baixo à direita, e não tiram altura da tela de 720:
  - **−** e **+** dividem e multiplicam o zoom por 2;
  - o **número do zoom** ("207%") volta à folha inteira.
- **As teclas** `+`, `−` e `0` fazem o mesmo.
- **Os limites:** o zoom vai da folha inteira (100%) até 800%, e a janela nunca sai da folha.
- **Para andar pela folha** de perto: arrastar o vazio com Selecionar, ou o botão do meio do mouse com qualquer
  ferramenta. Com a ficha aprovada (só para ver), arrastar em qualquer lugar anda pela folha.
- **O que fica do mesmo tamanho na tela em qualquer zoom:**
  - a distância que pega um ponto ou um traço (6 px);
  - os quadradinhos dos pontos;
  - o realce;
  - o traço que está sendo desenhado.

  O desenho em si cresce com o zoom, como numa lupa.
- **A conta** (`ui/vistaDaFolha.ts`): a janela da folha pelo zoom e pelo meio, o zoom num ponto, o arrasto, o passo
  da grade e o ponto preso na grade. Ela é testada à parte, e o clique da tela vira o ponto da folha pela janela.

**2. A grade.** O botão **Grade** mostra um papel quadriculado azul:
- uma linha a cada 10 unidades da folha, ou a cada 5 com zoom de 2 ou mais;
- mais forte a cada 50;
- fina em qualquer zoom.

**3. O ímã.** Com a grade ligada, o botão **Ímã** prende na grade:
- os pontos novos dos traços e o lugar do texto param no cruzamento mais perto;
- o ponto arrastado de um traço também para num cruzamento;
- o elemento inteiro arrastado anda de passo em passo.

Para escolher um ponto ou um elemento, vale o ponto clicado de verdade, não o preso. Como o eixo do espelho está
no meio da folha (200), o espelho de um ponto da grade também cai na grade.

**4. As estampas no PDF:** conferido, e não precisa de mudança. Toda imagem que o programa recebe passa pelo canvas e
é guardada em JPEG:
- a imagem do modelo, em `ui/carregarImagem.ts`;
- as do painel de inspiração e o rascunho da IA, em `ui/imagensDaInspiracao.ts`.

O PDF lê todas elas. Uma imagem em outro formato só aparece num projeto editado à mão fora do programa. Nesse caso,
ela fica fora do PDF e continua no SVG e na tela, como antes.

## O que não foi feito

- O zoom não é guardado: o desenho abre sempre na folha inteira.
- A grade não tem medida de verdade (cm). O croqui não está em escala: a grade serve para alinhar, não para medir.
- As medidas no desenho e a ligação dos pontos do croqui com as peças do molde continuam como no ADR 0107.

## Conferência

- `ui/vistaDaFolha.test.ts` (4):
  - a janela da folha inteira e a de perto;
  - o zoom no ponto do mouse com o ponto parado;
  - os limites do zoom e da janela;
  - o passo da grade e o ponto preso.
- `ui/PainelDoDesenhoTecnico.test.tsx` (+5):
  - aproximar mostra a metade do meio, e o clique cai no ponto certo da folha;
  - a roda no canto, e as teclas;
  - arrastar o vazio de perto;
  - a grade com as linhas fortes, e o ímã nos pontos novos e no ponto arrastado;
  - só para ver: o zoom e a grade funcionam, o ímã não.
- `npx vitest run`: 166 arquivos, 2941 testes passando. `npx eslint .` e `npx tsc -b --noEmit` sem erro;
  `npm run build` gera o programa.
- O teste de uso, no programa gerado: 80 conferências, nenhuma falha, nenhum aviso no console. Duas delas são novas:
  - **a roda do mouse, mandada pelo sistema como a mão faz,** aproxima no bolso: o bolso fica na janela, a 207%, e
    a grade aparece;
  - **o botão do zoom** volta à folha inteira.

  Na foto, o bolso de perto, a grade azul e os controles no canto da folha.
