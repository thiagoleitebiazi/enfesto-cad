# ADR 0028 — Extrai peças de contornos fechados de PDF de outros programas

## Contexto

Depois do ADR 0027, o app reconhecia que o PDF do Audaces era vetorial, mas
não criava peças. O usuário pediu que as peças fossem reconhecidas.

Análise do arquivo (ver ADR 0027):

- 239 polilinhas abertas. Ao tentar unir as pontas, o desenho não fecha em
  laços: a tolerância de 0,5 a 20 pt gera cruzamentos e pontas soltas. Então
  reconstruir contornos por encadeamento não é confiável.
- 32 subcaminhos já vêm fechados (operador `h`/`s`). Entre eles, 4 contornos
  com muitos vértices (37 a 69) são candidatos a peças. Os outros são a
  borda da folha (4 vértices, 97% da página) e caixas pequenas de nota.

## Decisão

`formats/pdf-pecas-vetoriais.ts` interpreta os operadores de caminho e a
matriz `cm`, monta os subcaminhos e aceita como peça só os contornos que:

- estão fechados (`h`, `s`, `re`, pintura de preenchimento, ou ponto final
  igual ao inicial);
- têm pelo menos 8 vértices;
- têm área de pelo menos 500 mm²;
- não cobrem quase toda a folha (borda).

As medidas saem na escala do papel (1 pt = 1/72 in → mm). O contorno é
deslocado para a origem no canto inferior esquerdo.

Na importação, cada peça vira um molde com nome genérico ("Peça N"),
quantidade 1, tamanho M e linha de fio **presumida na vertical**. As peças
são dispostas em grade de 1400 mm. A mensagem informa a escala assumida (1:1),
a linha de fio presumida e o número de formas descartadas.

## Por que 1:1 e não 1:5

O desenho diz "1:5", mas em 1:5 a peça da frente teria quase 4 m. Em 1:1 ela
mede 775 × 560 mm, o que é plausível para uma frente com mangas. Por isso o
1:1 é o padrão assumido, sinalizado na mensagem. O usuário corrige com
Dimensionar.

## O que NÃO foi feito

- Nomes das peças: o texto está desenhado como vetor, e nenhuma associação
  automática entre rótulo e contorno foi tentada.
- Linha de fio real: não é distinguível das linhas de construção. Fica
  presumida e marcada.
- Curvas: o desenho usa polilinhas; o extrator não produz curvas Bézier.
- Reconstrução de contornos a partir de linhas abertas: descartada por não
  fechar de forma confiável no arquivo analisado.

## Verificação

- Testes do extrator com fixture gerada (pdfkit, Node): moldura e
  retângulos pequenos descartados, dois polígonos aceitos, medidas em mm e
  origem no canto inferior esquerdo. Suíte completa: 263/263.
- Typecheck limpo. Lint sem erros (1 aviso antigo, não relacionado).
- Electron de produção, PDF do Audaces (arquivo local, não versionado):
  4 peças na lista ("Peça 1" a "Peça 4"), "Peças: 4" na barra de status,
  mensagem com a escala assumida e 28 formas descartadas. Canvas com
  numeração dos vértices e cotas em mm.
- Pelo extrator direto no arquivo: 67, 69, 37 e 37 vértices, com
  775 × 560, 750 × 560, 641 × 641 e 499 × 270 mm na escala do papel.

## Consequências

- `formats/pdf-fluxos.ts` concentra a leitura dos fluxos, usada pelo
  diagnóstico e pelo extrator.
- Não publicado: aguardando pedido explícito.
