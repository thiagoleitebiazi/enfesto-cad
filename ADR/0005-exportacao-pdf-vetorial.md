# ADR 0005 — Exportação de PDF vetorial em escala 1:1

## Contexto

A seção 8 do escopo pede PDF vetorial verdadeiro (linhas/curvas reais, não
imagem rasterizada), escala real 1:1 em milímetros, dois tipos de
exportação (encaixe completo e moldes individuais), formato/orientação/
margem configuráveis, paginação para áreas maiores que uma folha, e uma
medida de referência para conferir a escala após imprimir.

## Decisões

1. **Biblioteca: `pdfkit` + `blob-stream`**, não um gerador próprio.
   Escrever um gerador de PDF do zero (árvore de objetos, streams,
   compressão, fontes) reimplementaria uma especificação inteira sem
   necessidade — ao contrário do parser DXF (seção 3), que só precisa de um
   subconjunto pequeno de entidades. `pdfkit` desenha via API vetorial
   direta (`moveTo`/`lineTo`/`text`), exatamente o que a seção 8 pede.
2. **Unidade interna: mm, convertida para pontos PDF (72/polegada) só no
   momento de desenhar** (`mmParaPontos`, `PONTOS_POR_MM = 72/25.4`) —
   mesmo princípio de unidades consistentes já usado em todo o resto do
   projeto (ADR 0001).
3. **`compress: false` deliberado.** Arquivos de molde/encaixe são pequenos
   o bastante para o tamanho do arquivo não importar, e isso permite
   inspecionar o conteúdo do PDF gerado como texto diretamente nos testes
   (`pdf-exportacao.test.ts`) — os testes confirmam a geometria e a escala
   real (uma linha de referência de 100mm precisa medir exatamente
   `mmParaPontos(100)` pontos no fluxo de conteúdo, não só existir).
4. **Paginação por ladrilhamento (tiling)**: quando a área (do encaixe ou de
   uma peça) é maior que uma folha, o conteúdo é dividido em um grid de
   páginas, cada uma usando `doc.clip()` + `doc.translate()` para mostrar
   só sua fatia — com uma etiqueta "Página X/Y (linha L, coluna C)" em cada
   uma para remontagem manual. Testado com casos pequenos (1 página) e
   grandes (múltiplas páginas) para ambos os tipos de exportação.
5. **Salvar arquivo via IPC do Electron** (`salvar-arquivo`,
   `dialog.showSaveDialog` + `fs.writeFile`), mesmo padrão já usado para
   importação DXF (`abrir-arquivo-dxf`) — nenhuma tentativa de usar
   mecanismos de download de navegador, que não fazem sentido dentro do
   Electron.

## Problema real encontrado e corrigido: fontes padrão não registradas

A build do `pdfkit` que o Vite resolve para o processo de renderer (via o
mapa de `exports` condicional do pacote — condição `default`, não `node`)
**não** carrega fontes do disco como a build Node faz; ela exige registrar
os dados da fonte padrão explicitamente com `registerStdFonts()` antes de
usar `doc.text()`. Sem isso, `doc.text()` lança
`Standard font "Helvetica" is not registered` — e, como o clique do botão
"Exportar" dispara isso dentro do handler de evento do React (síncrono até
o primeiro `await` real dentro da geração), o erro só aparecia como um
diálogo nativo (`window.alert`) bloqueando a interface, sem nenhum stack
trace óbvio no console até isolar passo a passo.

Corrigido importando os dados da fonte Helvetica
(`pdfkit/standard-fonts/Helvetica`) e chamando `registerStdFonts(Helvetica)`
uma vez, no carregamento do módulo — protegido por
`typeof registerStdFonts === 'function'` porque, sob Node (é o que os
testes via `vitest` usam), o `pdfkit` resolve para a build Node, que **não**
exporta `registerStdFonts` (carrega fontes do disco sozinha, não precisa
disso). O guard deixa o mesmo código-fonte correto nos dois ambientes sem
precisar de mocks ou branches de teste separados.

## Consequência prática para depuração futura

Um erro lançado dentro de um handler de clique do React, antes do primeiro
`await`, se manifesta como um `window.alert()` nativo que **bloqueia todo o
processo de renderer** — inclusive scripts de automação via
`executeJavaScript`, que ficam pendurados esperando um clique humano que
nunca chega. Ao investigar uma automação que trava sem erro nem timeout,
suspeitar primeiro de um `window.alert`/diálogo nativo disparado por uma
exceção, não de um loop infinito — isolar adicionando `console.log` a cada
passo (não só no resultado final) é o jeito mais rápido de achar o ponto
exato onde trava.

## Consequências

- `vite.config.ts` precisou de dois ajustes para o pdfkit/blob-stream
  funcionarem no processo de renderer: `define: { global: 'globalThis' }`
  (pdfkit referencia `global`, que não existe no navegador) e
  `vite-plugin-node-polyfills` restrito a `['util', 'stream', 'buffer']`
  (blob-stream depende de `util.inherits`/`stream.Writable`) — deliberadamente
  sem incluir o polyfill de `crypto`, que traria uma dependência transitiva
  com vulnerabilidade conhecida (`elliptic`) sem necessidade real (nada
  neste projeto usa Node `crypto`).
- O bundle do renderer cresceu de ~275KB para ~972KB (fontes/dados do
  pdfkit embutidos) — aceitável para um app Electron, mas registrado aqui
  caso vire um problema real em empacotamento (Etapa 10).
