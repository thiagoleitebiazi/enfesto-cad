# ADR 0019 — Importação de PDF (ciclo completo com a própria exportação)

## Contexto

Usuário reportou: "ele não permite importar pdf". Esclarecido via
`AskUserQuestion`: a necessidade real é poder **extrair as peças
vetoriais de um PDF exportado por este app** (ou por outro CAD que gere
PDF vetorial 1:1 equivalente) de volta como peças editáveis — não usar o
PDF como imagem de fundo para decalcar.

## Decisão: parser escrito à mão para o formato exato que este app gera, não um leitor de PDF genérico

Mesmo espírito do importador de DXF (`formats/dxf-importacao.ts`): em vez
de trazer uma biblioteca de PDF genérica e pesada (ex.: pdf.js) para um
problema muito mais amplo do que o necessário, `formats/pdf-importacao.ts`
lê o stream de conteúdo bruto do PDF como texto (`compress:false` na
exportação é exatamente para isto — ver ADR original da exportação) e
reconhece cada elemento pela cor/traço/tracejado EXATOS que
`desenharPeca` usa:

| Elemento | Sinal de reconhecimento |
|---|---|
| Contorno + furos | preenchimento `#f4f5f7` + traço preto, um único bloco `B` (fill+stroke) com um ou mais subcaminhos — o 1º é o contorno, os demais são furos |
| Linha de fio | traço vermelho `#c62828`, só a haste (`S`, 2 pontos) — a ponta da seta (preenchida, `f`) é ignorada de propósito |
| Piques | traço roxo `#8e24aa`, linha de 2 pontos — o 1º ponto é a posição; o índice de aresta é recalculado com `pontoMaisProximoNoContorno` já existente |
| Marcas | preenchimento azul-petróleo `#00838f`, círculo via curvas Bézier — centro = bbox dos pontos na curva |
| Linhas internas | traço preto tracejado (padrão 1,5mm/1mm) |
| Linha de corte (margem de costura) | traço cinza `#555555` tracejado (padrão 3mm/2mm) — a margem em mm é **estimada** pela diferença de envelope entre essa linha e o contorno real, dividida por 4 (média das duas dimensões, dividida por 2 lados) |
| Nome/Referência/Tamanho/Quantidade | texto decodificado dos operadores `TJ` (glifos hexadecimais) — mesma técnica de decodificação já usada em `pdf-exportacao.test.ts` |

Como o parser só reconhece essas cores/traços exatos, um PDF de outro
programa (ou um PDF genérico qualquer) simplesmente não encontra peças
reconhecíveis — com aviso claro ("só PDFs exportados por este app..."),
nunca um resultado errado silencioso.

## Limitação conhecida, documentada e testada explicitamente: peças ladrilhadas

Uma peça maior que uma folha é exportada em várias páginas (cada uma só
com uma fatia recortada da peça — ver `gerarPdfDeMoldesIndividuais`).
Reconstituir a peça inteira exigiria costurar fragmentos de página em
página, um problema bem mais difícil que decidimos não resolver nesta
primeira versão. Detectado de forma direta e robusta: o próprio rodapé
que a exportação já escreve diz "página N/Y" — se Y>1, a peça é
ladrilhada e TODAS as suas páginas são puladas (nenhuma vira uma peça
pela metade fingindo ser a peça inteira), com um aviso único por peça.

(Tentativa inicial usava uma heurística de "mesmo rótulo em páginas
adjacentes" para detectar isso — descartada por ser frágil: duas peças
diferentes mas com nome/referência/tamanho IDÊNTICOS por coincidência
seriam erroneamente tratadas como uma peça só. O sinal "página N/Y" do
rodapé é direto e não tem esse problema.)

## Nova integração Electron: `abrir-arquivo-pdf`

Mesmo padrão do `abrir-arquivo-dxf` (`dialog.showOpenDialog` +
`readFile`), com uma diferença importante: PDF é **binário**, lido como
`Buffer` e convertido para `latin1` (1 byte = 1 código de caractere) em
vez de `utf-8` (que corromperia qualquer byte > 127, comum em
PDF). `latin1` é exatamente a mesma codificação que os testes da
exportação já usam para inspecionar o PDF gerado.

## Verificação

- **11 testes de ida e volta real** (`pdf-importacao.test.ts`): gera um
  PDF de verdade via `gerarPdfDeMoldesIndividuais` com TODOS os recursos
  (furos, linhas internas, piques, marca, margem de costura, quantidade,
  referência vazia) e importa de volta, conferindo contorno/área/furos/
  linhas internas/fio/piques/marcas/margem/quantidade/múltiplas peças/
  peça ladrilhada rejeitada/PDF ilegível sem crashar.
- **Ciclo completo em Electron real** (não só unitário): desenhar uma
  peça → nomear/referenciar → exportar PDF de verdade (diálogo nativo
  mockado só no `showSaveDialog`/`showOpenDialog`, todo o resto — IPC,
  escrita/leitura de arquivo real — roda sem mock) → novo projeto limpo
  → importar o mesmo arquivo PDF real → peça reaparece com Largura/
  Altura/Área **idênticas** (115.4mm/153.8mm/177.5cm² antes e depois),
  nome e referência corretos. Também confirmado que uma peça maior que
  uma folha (4 páginas) é corretamente rejeitada com o aviso certo na
  interface (`.faixa-de-avisos`), não importada pela metade.
- 252/252 testes totais (11 novos), typecheck/lint/build limpos.

## Consequências

- Novo botão "Importar PDF" na aba Encaixe, grupo "Importação e
  exportação", ao lado de "Importar DXF".
- `PecaImportadaPdf` é mais rico que `PecaImportadaDxf` (inclui piques,
  marcas, margem de costura, quantidade, referência, tamanho) porque o
  PDF exportado por este app carrega mais informação que um DXF genérico
  — reconstrução mais completa é possível justamente por ser um ciclo
  fechado com a própria exportação.
- A margem de costura reconstruída é uma **aproximação por envelope**,
  exata para formas convexas/retangulares (como testado) mas pode
  divergir um pouco em formas muito côncavas — mesma classe de limitação
  já aceita e documentada para `deslocarContornoParaFora` (R-2).
