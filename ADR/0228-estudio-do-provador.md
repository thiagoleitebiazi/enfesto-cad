# ADR 0228 — O estúdio do provador 3D

## Contexto

O provador pintava triângulos chapados, de trás para a frente, num canvas 2D (ADR 0111). A pedido, ele passa a ser o mais realista possível. A placa de vídeo não é opção: no Windows o programa abre sem ela (ADR 0083), e sem ela o WebGL não é garantido.

## Decisão

**A imagem é calculada ponto a ponto pelo processador** (`ui/estudio3d.ts`), em TypeScript puro, sem DOM. Roda igual na janela, no Worker, no Mac e nos testes.

- **O que cada ponto vê:** um z-buffer de verdade. A normal é suave e a perspectiva é corrigida; nada mais depende da ordem de pintura.
- **A luz:** um estúdio com a luz principal, o preenchimento e duas luzes de recorte atrás. A sombra é suave: a penumbra cresce com a distância de quem faz a sombra. As dobras escurecem pela oclusão, medida na profundidade da própria imagem.
- **O pano:** fosco de verdade (Oren-Nayar), com a penugem que clareia na borda, o reflexo esticado no fio do cetim, a luz que atravessa o pano fino e a trama, que aparece de perto.
- **O chão:** recebe a sombra e o escuro de contato, e os pés assentam nele.
- **A cor:** o mapa de tons neutro do Khronos, feito para produto: a cor escolhida continua sendo ela, e só o que passa do branco é comprimido.
- **O fundo branco** das imagens salvas é branco de verdade (255), só com a sombra.

**Duas qualidades.** A rápida acompanha o arrasto e a simulação: menos pontos e sem oclusão. Parada a tela, a final (o dobro de pontos por lado) é calculada num Worker (`estudio3d.worker.ts`, `ui/imagemDoEstudio.ts`) e toma o lugar da rápida, sem travar a janela. As imagens salvas usam a final.

**As malhas** (`ui/malhasDoEstudio.ts`, `ui/lotesDoTecido.ts`): cada triângulo vira quatro pela tesselação de Phong, o que tira as facetas sem abrir frestas. Os dois lados de uma costura dividem a normal. O botão e o zíper viram geometria, com a fita, os dentes de metal e o disco com rebaixo.

**O desenho antigo saiu.** `montarCena`, `desenharCena`, a sombra em mancha e os tons da estampa foram apagados; a câmera ficou em `ui/cena3d.ts`.

## O que não foi feito

- **Luz que rebate de verdade** entre os panos (a oclusão é uma aproximação da imagem, não um cálculo da luz).
- **Reflexo no chão.**

## Conferência

- `ui/estudio3d.test.ts`: a cor da esfera, o z-buffer em qualquer ordem, o branco do fundo e a sombra no chão, o brilho, o cetim, a transparência, a estampa, o rego mais escuro e a mesma imagem nas duas contas.
- `ui/lotesDoTecido.test.ts`: as normais, o refino sem fresta, a costura, o mapa de tensão, o zíper e o botão.
- Imagens de conferência geradas por um script fora do repositório, sem abrir o programa.
