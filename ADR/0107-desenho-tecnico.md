# ADR 0107 — O desenho técnico (o croqui da ficha)

## Contexto

Fase 3 do estudo de funcionalidades (ADR 0099). A referência tem um editor vetorial de desenho técnico com:
- o croqui de frente e costas;
- o espelhamento automático (desenha-se um lado e o outro sai);
- a biblioteca de formas (golas, punhos, bolsos) e de bases técnicas, e os manequins;
- os pespontos e as linhas de costura;
- as estampas aplicadas com posição, escala e rotação;
- tudo ligado à ficha técnica.

Aqui a ficha técnica (ADR 0105) mostrava só o desenho das peças da mesa.

## Decisão

- **Modelo › Ficha técnica › Desenho técnico** abre o editor (`ui/PainelDoDesenhoTecnico.tsx`).
- O desenho **mora na ficha técnica** (`FichaTecnica.desenho`): muda junto com ela e trava junto. Com a ficha
  aprovada (ou em aprovação), o editor abre só para ver e diz por quê; para mudar, abre-se uma nova versão. Ele é
  guardado sozinho meio segundo depois de cada mudança; sem ficha ainda, ela é criada.
- **A folha** (`domain/desenhoTecnico.ts`):
  - duas vistas, Frente e Costas, cada uma uma folha de 400 × 500 pontos com o eixo do meio tracejado;
  - o que é marcado **espelhar** aparece também do outro lado do eixo (a estampa espelhada vira e gira ao
    contrário).
  - Os elementos são:
    - **traços**: retos ou curvos (a curva passa pelos pontos), abertos ou fechados (com preenchimento), nos estilos
      contorno, costura, **pesponto** (tracejado) ou detalhe, com a cor e a espessura;
    - **textos**;
    - **estampas**: uma imagem do projeto (Modelo › Imagens), com o centro, a largura, a rotação e a opacidade.
- **As ferramentas:**
  - Selecionar: clicar escolhe, também pelo espelho; arrastar move; arrastar um ponto do traço escolhido muda só
    ele.
  - Reta, Curva, Costura e Pesponto: clicar os pontos; duplo clique ou Enter termina; "Fechar" fecha.
  - Texto: clica onde vai.
  - "Espelhar o que desenhar", ligado de saída.
  - **Desfazer e refazer** (Ctrl+Z, Ctrl+Y), com o arrasto inteiro como uma mudança só. Delete apaga.
- **As propriedades** do escolhido: o estilo, a cor, a espessura, curvo, fechado, preencher, espelhar; o texto e o
  tamanho; a imagem, a largura, a rotação e a opacidade da estampa. Também duplicar, copiar para a outra vista,
  trazer para a frente, mandar para trás e apagar.
- **As bases técnicas** (camiseta, regata, calça, shorts, saia, vestido): o contorno inteiro de frente e de costas
  (feito pela metade e espelhado, fechado) e os detalhes (decote, barras, cós, braguilha, bolsos) já espelhados.
- **A biblioteca de formas** (13):
  - bolso chapa, bolso faca, bolso embutido;
  - punho, cós, passante, carcela, botão, zíper;
  - gola redonda, gola V, gola polo;
  - etiqueta.
  A forma entra num lado (e aparece no outro, com o espelho) ou no meio.
- **O manequim** de guia (feminino ou masculino), em cinza-claro tracejado por baixo; não sai no SVG nem no PDF.
- **Na ficha:** a aba Descrição mostra as vistas desenhadas, com "Abrir o desenho técnico". O **PDF da ficha** ganha
  a parte "Desenho técnico", com as vistas lado a lado, desenhadas em vetor (o mesmo caminho do SVG).
- **Exportar SVG:** a frente e as costas lado a lado, com o nome de cada vista, as estampas dentro do arquivo
  (`formats/desenho-exportacao.ts`). É o vetor que os programas de desenho abrem.

## O que não foi feito

- Não há zoom nem grade na folha: ela cabe inteira na tela.
- Não há medidas no desenho, nem ligação dos pontos do croqui com as peças do molde: o croqui é a ilustração da
  ficha, não o molde.
- As estampas em formato que o PDF não lê (fora PNG e JPEG) ficam de fora do PDF; no SVG e na tela vão.

## Conferência

- `domain/desenhoTecnico.test.ts` (14):
  - o espelho, as vistas, a estampa espelhada e o texto que não espelha;
  - o contorno pela metade;
  - os caminhos (reto e curvo) e os pontos da curva;
  - pegar com o clique (traço, preenchido, espelho, texto, estampa girada);
  - as mudanças;
  - as formas, cada base (fechada e simétrica), os manequins dentro da folha;
  - na ficha (e travado na aprovação);
  - a leitura.
- `ui/PainelDoDesenhoTecnico.test.tsx` (7):
  - pôr a base;
  - a reta com o espelho;
  - escolher pelo espelho, mudar o estilo, apagar e desfazer;
  - arrastar o elemento e um ponto (com o desfazer);
  - texto, forma e estampa;
  - copiar para as costas;
  - só para ver, com o SVG.
- `formats/desenho-exportacao.test.ts` (2), `formats/ficha-exportacao.test.ts` (o croqui no PDF),
  `ui/PainelDaFichaTecnica.test.tsx` (a prévia e o botão).
- `npx vitest run`: 150 arquivos, 2799 testes passando; `npx eslint .` e `npx tsc -b --noEmit` sem erro;
  `npm run build` gera o programa.
- O teste de uso do repositório, no programa gerado (Windows):
  - com a ficha aprovada, o desenho abre só para ver;
  - aberta a nova versão: a base da camiseta, um pesponto desenhado com o mouse de verdade (aparece espelhado) e
    um bolso chapa;
  - o SVG gravado com a frente e as costas;
  - a ficha (versão 2) com as duas vistas na Descrição;
  - o PDF com o desenho;
  - o desenho guardado na ficha do projeto;
  - 41 conferências, nenhuma falha.
- Nas fotos, a moldura da folha ocupava toda a largura, e a coluna das propriedades passava da janela: as duas
  foram ajustadas. O PDF aberto no visualizador mostra as vistas lado a lado, em vetor.
