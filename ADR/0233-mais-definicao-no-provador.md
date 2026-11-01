# ADR 0233 — Mais definição no provador

## Contexto

O modelo 3D parecia ter poucos pixels. Medindo, eram várias causas somadas:

- **A área do desenho era pequena.** A altura ia até 58% da janela. Numa tela de 1280 × 720 efetivos, o manequim tinha uns 520 pontos de altura e 140 de largura.
- **A imagem rápida era esticada.** Ela ia até 260 mil pontos, menos da metade do que a área tinha, com um pontilhado de ruído, e a final levava segundos para chegar. A cada mudança, era esse mosaico que se via.
- **O canvas não acompanhava a janela.** Mudar o tamanho esticava a imagem.
- **A trama fazia moiré.** Um desenho de quase o tamanho do pixel vira ondas, e é justamente o que parece falta de resolução.

## Decisão

**1. O desenho ocupa a janela.** O provador vai a 98% da tela, a coluna do desenho é a mais larga, e a altura dela acompanha a janela, sem limite de 560 px. O botão **Ampliar a vista** esconde as abas e a linha de estado. O corpo enche mais de 90% da altura da imagem, de frente.

**2. A área mudou, a imagem é refeita** (`ResizeObserver`), nos pontos que ela tem agora.

**3. A imagem final faz a média de nove pontos por pixel,** contra quatro antes, com mapa de sombra de 2048.

**4. Todos os núcleos trabalham** (`faixasDaImagem`, `ui/imagemDoEstudio.ts`). A imagem é dividida em faixas, uma por Worker, até seis. Cada faixa sai igual, ponto a ponto, ao mesmo trecho da imagem inteira: o ruído vem da posição na imagem, e uma margem deixa a oclusão enxergar as linhas vizinhas. Por isso não há emendas.

**5. A imagem rápida acompanha o computador,** sem virar mosaico. Ela começa com 500 mil pontos, ganha mais se levou menos de 75 ms e perde se levou mais de 150 ms, entre 300 mil e 2,4 milhões. A primeira versão desta regra mirava 70 ms e descia até 120 mil: a foto do programa real mostrou blocos de vários pixels, pior que antes. Sem ruído na sombra, ela fica limpa ao ser ampliada. O fundo, que é liso, sai de uma grade de 4 em 4 pixels.

**A etapa do meio** (`QUALIDADE_MEDIA`): parado o movimento, em vez de esperar a final, vem primeiro uma imagem com um ponto por pixel, nos pixels da tela, e só então a final. A malha refinada é guardada enquanto só a câmera muda.

**6. A trama some pelo tamanho do pixel da imagem,** não pelo do ponto calculado: inteira abaixo de um quarto do passo, nada a partir de metade. O moiré sumiu.

**7. A resolução das imagens salvas** começa na alta (1200 × 1800 por vista). A malha do corpo é dividida mais uma vez quando a câmera chega perto.

## Defeitos que a imagem nítida mostrou

**A mancha escura no busto.** Três hipóteses erradas antes da certa: triângulos virados (eram 6 em 18 mil, nenhum ali), a sombra do corpo no pano e a sombra do próprio busto. Sondando a luz dentro e fora da mancha, a cor, a oclusão e o lado do pano eram os mesmos; só mudava a direção da superfície. O alisamento do peito (ADR 0229) era estreito: tirava o bico e deixava uma ponta aguda, e o pano armava uma tenda sobre ela. Agora ele é largo (75 mm) e some aos poucos.

**A luz principal ficou maior** (0,42 rad), como uma caixa de luz de estúdio, e a sombra amaciou. Ela foi aumentada na investigação da mancha e não era a causa; ficou porque a imagem melhorou.

**Pontinhos claros do corpo no pano.** O corpo desenhado fica 1,5 mm para dentro do corpo da colisão.

**A folga da sombra no pano** subiu para 7 mm, e o lado do pano passou a sair da normal suave, com a ordem dos cantos só perto da borda de uma dobra. Nenhuma das duas era a causa da mancha; ficaram porque são mais corretas.

**O clique no tronco.** O desenho no corpo conferia o ponto contra a elipse da altura, e o corpo de verdade passa longe dela: cliques no busto eram recusados. Passou no teste de uso antes por sorte das coordenadas, e só apareceu quando o enquadramento mudou. Agora a elipse é uma referência larga, e o braço é separado pela distância ao osso dele.

**A sombra que a superfície fazia em si mesma.** A procura de quem faz a sombra é larga, e numa superfície curva os vizinhos que sobem para a luz pareciam bloqueadores: a pele e o pano escureciam sozinhos, o que na imagem rápida aparecia em riscos e degraus, e na final, como uma penumbra sem motivo. Foi um teste novo que pegou: a trava barrou a gravação com um salto de 17 níveis numa esfera lisa. Cada amostra agora é comparada com o plano da própria superfície.

## O que não foi feito

Perto da costura lateral, onde a frente e as costas se encontram, ainda há um pontilhado fino quando se chega bem perto: as duas camadas se cruzam em pedaços menores que a malha.

## Conferência

- `ui/estudio3d.test.ts`: a trama some com folga; a imagem em faixas é igual à inteira, ponto a ponto.
- `ui/cena3d.test.ts`: o corpo ocupa mais de 90% da altura.
- `ui/lotesDoTecido.test.ts`: o recuo do corpo.
- `ui/PainelDoProvador3D.test.tsx`: o botão de ampliar e a resolução alta de partida.
