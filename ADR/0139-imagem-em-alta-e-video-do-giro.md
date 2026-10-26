# ADR 0139 — A imagem em alta, a sombra no chão e o vídeo do giro

## Contexto

Da terceira rodada do estudo, sobre o estúdio 3D da referência:
- **As imagens:** ela gera imagens em alta resolução, com luz e sombra, para o catálogo e a aprovação.
- **O movimento:** ela mostra a roupa em movimento.

O provador do Enfesto CAD salvava o PNG em 600 × 900 por vista. O manequim flutuava no fundo branco, sem sombra, e não
havia vídeo.

## Decisão

**1. A sombra no chão** (`desenharSombraNoChao`, em `ui/cena3d.ts`): uma mancha suave sob os pés.
- **O desenho:** um degradê mais escuro no meio, achatado pela altura da câmera (o raio de 32 cm projetado, de lado e
  de frente).
- **Onde aparece:** na vista da janela e em todas as imagens salvas, desenhada antes do corpo.

**2. A resolução das imagens** (aba Imagem do provador): Normal (600 × 900 por vista), Alta (2×) ou Muito alta (4×). O
nome embaixo cresce junto. Vale para "Salvar esta vista" e para "Salvar frente, lado e costas".

**3. O giro em vídeo** ("Gravar o giro (vídeo WebM)"):
- **O que grava:** uma volta inteira do manequim a partir da vista de agora (`guinadasDoGiro`), em 90 quadros de
  600 × 900, desenhados num desenho à parte.
- **Como grava:** pelo gravador de vídeo do navegador (`MediaRecorder` sobre o fluxo do desenho, 30 quadros por
  segundo), em WebM. Fica com VP9 ou VP8, o que houver.
- **Para onde vai:** o arquivo é salvo como as imagens.
- **Enquanto grava,** o botão diz "Gravando o giro…". A vista da janela não muda.
- **Sem o gravador,** o recado diz que este computador não grava vídeo.

## O que não foi feito

- **A sombra do tecido no corpo e de uma peça na outra** (a sombra projetada): só a do chão.
- **O vídeo da roupa caindo** (a simulação gravada enquanto assenta) e o vídeo em MP4.

## Conferência

- `ui/cena3d.test.ts` (2 novos):
  - **o giro:** uma volta em quatro quadros, a partir da vista dada;
  - **a sombra:** o degradê com as três paradas, o raio, e o achatamento entre 0,1 e 1.
- `npx vitest run`: 176 arquivos, 3074 testes passando. `npx eslint .` e `npx tsc -b --noEmit` sem erro;
  `npm run build` gera o programa.
- O teste de uso, no programa gerado: 114 conferências, nenhuma falha.
  - **A nova:** com a resolução Alta, "Salvar esta vista" grava o PNG de 1440 × 1920, e "Gravar o giro" grava o WebM
    (602 278 bytes, com o cabeçalho EBML do formato).
  - **Nas fotos do provador,** a sombra aparece sob os pés.
