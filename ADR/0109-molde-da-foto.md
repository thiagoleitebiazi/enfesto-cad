# ADR 0109 — O molde da foto (a digitalização pelo reconhecimento)

## Contexto

Fase 5 do estudo de funcionalidades (ADR 0099). A referência digitaliza o molde de papel pela foto:
- corrige a perspectiva e a lente;
- reconhece o contorno e o transforma em vetor editável;
- acha os piques, os furos e o fio.

Aqui havia o "Digitalizar": a foto por baixo do desenho, a escala calibrada por dois pontos, e o contorno feito à
mão por cima.

## Decisão

- **Produção › Definir moldes › Molde da foto** abre o assistente (`ui/PainelDaFotoParaMolde.tsx`). A conta é toda
  sobre os pixels (`domain/digitalizacao.ts`), e a tela só lê a foto e mostra o resultado.
- **1. A foto:** uma das imagens do projeto (Modelo › Imagens), ou "Trazer uma foto…" (o mesmo campo de arquivo das
  imagens). O molde é fotografado de cima, sobre uma referência de medida conhecida (uma folha A4, uma placa de
  corte), com os quatro cantos dela aparecendo.
- **2. A referência e a perspectiva:**
  - os quatro cantos da referência são clicados na foto, na ordem pedida (em cima à esquerda, em cima à direita,
    embaixo à direita, embaixo à esquerda);
  - a largura e a altura dela são digitadas, ou escolhidas (A4, A3, placas A2 e A1);
  - a **homografia** dos quatro cantos leva a foto à vista de cima, em escala (0,5 ou 1 mm por ponto; mais grossa
    se o lado passasse de 3000 pontos), com cada ponto lido da foto por interpolação;
  - a foto já tirada de cima e calibrada (Imagens › Calibrar escala) pode ser usada sem corrigir.
- **3. O molde:**
  - **um clique dentro do molde** separa o papel do fundo: o limiar sai sozinho (Otsu) e pode ser ajustado, e há a
    opção "o molde é mais escuro que o fundo". A região é a dos pontos ligados ao do clique, pelos lados.
  - O **contorno** é seguido pelas bordas dos pontos (a medida exata, sem o meio ponto do centro) e simplificado
    (Douglas-Peucker; 0,5, 1 ou 2 mm).
  - Os **furos** são os buracos redondos da região (de 3 mm² para cima).
  - O **fio** é o traço de caneta comprido e fino de dentro (um buraco alongado): o eixo principal dele.
  - Os **piques** são os entalhes em V do contorno: até 12 mm de abertura, de 1,5 a 15 mm de fundo, para dentro.
    Cada um vira um pique no meio da abertura, e a ponta sai do contorno.
  - Tudo aparece por cima da foto corrigida: o contorno em azul, os furos em laranja, os piques em vermelho e o fio
    em verde. Ao lado vão a largura e a altura, o perímetro, a área e o que foi achado. O que não deu certo é dito
    (o clique fora do molde; a região que encosta na borda, quase sempre o fundo; o fio não achado).
  - O fio pode ser **marcado à mão** (dois cliques).
- **4. Conferir:** "Uma medida" (dois cliques nas pontas de uma medida conhecida) mostra a medida na foto e a
  diferença para a de verdade. "Corrigir a escala por esta medida" ajusta o molde todo.
- **5. A peça:**
  - o nome, o tamanho e a quantidade;
  - a peça entra no projeto depois das outras, deitada como na foto (o x da foto vira o y do desenho), com o
    contorno, os furos, os piques e o fio (sem fio achado ou marcado, ele fica deitado no meio);
  - Ctrl+Z desfaz; fica no histórico.
  - A janela continua aberta: **a mesma foto pode ter vários moldes**, e cada clique em outro deles cria a peça
    seguinte.

## O que não foi feito

- **A correção da lente** (a distorção de barril das câmeras de celular): a perspectiva é corrigida pelos quatro
  cantos, mas a curvatura da lente não. Na prática, fotografe com o molde no meio da imagem e sem zoom digital.
- **O pique que é só um corte reto** (sem abrir o papel) não aparece na foto: só os entalhes em V são achados. Os
  outros se põem depois (aba Marcações).
- As linhas internas desenhadas a caneta (além do fio) não viram linhas do molde.
- O quadro de captura (a mesa digitalizadora com o equipamento) não existe: é equipamento.

## Conferência

- `domain/digitalizacao.test.ts` (11):
  - a homografia (e o quadrilátero que não é);
  - a retificação de uma placa fotografada torta (o quadrado volta ao lugar);
  - o limiar de Otsu, a máscara e a região;
  - o contorno pelas bordas (a área exata, o buraco, a diagonal que não liga);
  - a redondeza e o eixo;
  - o pique em V (e a saliência que não é pique);
  - o reconhecimento inteiro de cima a 0,5 mm (100 × 150 mm, o furo, o fio de 90 mm, o pique no lugar);
  - pela foto em perspectiva (até 1%);
  - o clique fora e o fundo;
  - a escala conferida e a passagem para o desenho;
  - dois moldes na mesma foto.
- `ui/PainelDaFotoParaMolde.test.tsx` (5):
  - sem foto;
  - os cantos e a correção, com as medidas e os achados;
  - o clique fora;
  - conferir, corrigir a escala e criar a peça (a janela fica pronta para o próximo molde);
  - o fio marcado à mão.
- `npx vitest run`: 155 arquivos, 2839 testes passando; `npx eslint .` e `npx tsc -b --noEmit` sem erro;
  `npm run build` gera o programa.
- O teste de uso do repositório, no programa gerado (Windows):
  - uma foto desenhada na hora (a placa de 140 × 190 mm torta, o papel de 100 × 150 mm com furo, traço do fio e
    pique) entra pelo campo de arquivo;
  - os quatro cantos e o clique no molde, com o mouse;
  - as medidas de 100 × 150 mm (até 1,5 mm), o furo e o fio;
  - a peça na lista, e a janela pronta para outro molde;
  - no projeto, a peça de 150 × 100 mm (deitada como na foto), com 1 furo e 1 pique;
  - 51 conferências, nenhuma falha.
