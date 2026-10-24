# ADR 0113 — A estampa no encaixe (para a impressão digital do tecido)

## Contexto

O estudo de funcionalidades (ADR 0099) tinha uma linha local que não entrou nas oito fases: "Encaixe de estampa para
impressão digital (molde preenchido com a imagem)", **L** para o arquivo; a impressora é equipamento.

Na sublimação e na impressão digital, o tecido é impresso já com a estampa no lugar de cada peça. Assim:
- a estampa fica de pé em cada peça;
- a localizada cai no meio da frente;
- não se gasta tinta no tecido que vira retalho.

## Decisão

- **Encaixe › Impressão › Estampa no encaixe** abre a janela (`ui/PainelDaImpressaoDigital.tsx`).
- **As imagens** vêm das imagens do modelo (Modelo › Imagens) e do painel de inspiração (ADR 0112).
- **A estampa de todas as peças:**
  - a imagem;
  - **corrida** (repete pela peça) ou **localizada** (uma vez, no meio da peça);
  - a largura da imagem em mm;
  - na localizada, quanto ela sobe.
- **Cada peça** pode ir "como todas", "sem estampa" ou com outra imagem, outro modo e outra largura.
- **A sangria** (de 0 a 30 mm, padrão 3): a estampa passa da linha de corte, e o corte não pega branco.
- **A linha de corte impressa:** um traço fino cinza, para conferir o corte. Fica ligada, a não ser que se desligue.
- **A orientação** (`domain/impressaoDigital.ts`): a estampa fica **de pé no fio de cada peça**, pelos mesmos eixos da
  face do provador 3D (`eixosDaFace`, ADR 0111).
  - **A peça girada pelo encaixe:** o giro acumulado da peça é desfeito, a regra do alto é aplicada na peça de origem,
    e o giro volta. A peça que o encaixe virou de cabeça para baixo continua com a estampa de pé em relação a ela.
  - **A corrida** começa no alto à esquerda da peça, com a sangria, e as cópias cobrem a peça.
  - **A localizada** fica no meio.
- **A prévia:** o tecido como a tela (o comprimento na horizontal), com cada molde estampado. A corrida é um padrão
  SVG, e a localizada é recortada pela peça. A peça sem estampa aparece tracejada. Embaixo, o resumo: quantas peças
  têm estampa, o tamanho do tecido e quantas páginas sairão.
- **O PDF** (`formats/impressao-exportacao.ts`):
  - na escala 1:1, uma página por trecho de até 5 m do comprimento usado (o PDF não passa de 5,08 m de lado);
  - a largura útil do tecido na horizontal e o comprimento descendo: é a vista da tela **girada, não espelhada**, e a
    face sai como a tela mostra;
  - em cada peça, a estampa recortada pela linha de corte com a sangria;
  - a imagem entra **uma vez** no arquivo e é reaproveitada em todas as peças;
  - fora das peças, nada é impresso.
- **A configuração fica no projeto** (`Projeto.impressaoDigital`) e é lida conferida.

**Junto, no provador 3D (ADR 0111):** a simulação passou a andar por um relógio próprio (`setTimeout`), e só o desenho
espera a tela (`requestAnimationFrame`). Antes, com a janela coberta por outra, o Windows pausava a tela e, com ela, a
simulação. Assim ela ficou parada em "Costurando… 1,1 s" por 45 s numa rodada do teste de uso.

## O que não foi feito

- **A impressora não foi testada:** o arquivo é o PDF 1:1, que os programas de impressão (RIP) aceitam.
- **O perfil de cor** da impressora (ICC) e o TIFF não foram feitos: o PDF leva as cores da imagem como estão.
- **O encaixe da estampa entre peças vizinhas**, para continuar a listra de uma peça na outra, depende da costura e
  não foi feito.

## Conferência

- `domain/impressaoDigital.test.ts` (6):
  - a localizada no meio, de pé;
  - a peça virada 180° pelo encaixe, com a estampa virada junto; a girada 90°;
  - a corrida cobrindo a peça com a sangria (65 cópias numa peça de 200 × 300 mm com imagem de 50 × 25 mm);
  - a estampa de cada peça (a de todas, a dela, nenhuma);
  - os trechos de até 5 m; a leitura;
  - o PDF:
    - a página de 1500 × 810 mm na escala 1:1;
    - a imagem embutida uma vez (com a máscara da transparência), para duas peças;
    - dois recortes, porque a terceira peça está sem estampa;
    - a linha de corte das três;
    - o encaixe de 6,3 m em duas páginas.
- `ui/PainelDaImpressaoDigital.test.tsx` (3):
  - sem estampa: as peças tracejadas, e nada a exportar;
  - a estampa de todas, uma peça com a sua (localizada) e outra sem: a prévia, o PDF pedido e a configuração guardada;
  - sem mesa, e sem imagens.
- `ui/BarraDeFerramentas.test.tsx`: o grupo Impressão da aba Encaixe.
- `npx vitest run`: 164 arquivos, 2906 testes passando. `npx eslint .` e `npx tsc -b --noEmit` sem erro.
  `npm run build` gera o programa.
- O teste de uso do repositório, no programa gerado (Windows):
  - a estampa no encaixe com o tecido listrado do painel: as 6 peças estampadas na prévia;
  - o PDF com a página na largura do tecido (1500 mm, 1:1), a imagem e 6 recortes;
  - 75 conferências, nenhuma falha, em três rodadas seguidas, as duas últimas já com o relógio novo do provador.
