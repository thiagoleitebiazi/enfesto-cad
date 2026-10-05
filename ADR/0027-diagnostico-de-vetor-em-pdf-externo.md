# ADR 0027 — Diagnóstico de conteúdo vetorial em PDF de outros programas

## Contexto

O usuário pediu que o app "reconheça que o PDF é um vetor". O PDF de
exemplo (`REF.101-CAMISETA BAS-G.pdf`, de origem Audaces) não foi
exportado por este app, então o importador de peças (ADR 0019) não lê
nada e mostra só "Nenhuma peça reconhecível".

Análise direta do arquivo (fluxos descomprimidos, sem adivinhação):

- 1 página, 2145 × 750 mm (6080 × 2126 pt).
- 239 subcaminhos, 921 segmentos retos, 0 curvas (curvas aproximadas por
  polilinhas), 0 blocos de texto: os nomes das peças estão desenhados
  como contorno, não como texto.
- Uma cor (preto), uma camada, sem tracejado: linha de corte e linha de
  construção não se distinguem.
- A escala não se resolve sozinha: o desenho diz "1:5", mas os contornos
  medem 775×560 mm se 1:1 e cerca de 3,9 m se 1:5. Nenhum dos dois parece
  uma camiseta, então a escala é desconhecida.

## Decisão

Criar um **diagnóstico** separado do importador (`formats/pdf-diagnostico-vetorial.ts`).
Ele descompacta os fluxos FlateDecode, conta subcaminhos, segmentos
retos, curvas e blocos de texto, e lê o tamanho da página. Não gera
peças. Quando o importador não reconhece nada e o PDF tem desenho
vetorial, a faixa de avisos mostra essa descrição no lugar da mensagem
genérica, informando que a escala é desconhecida e indicando o caminho
para trazer as peças (DXF ou "Novo Molde").

Não há importação assistida nem reconstrução de contornos. Isso continua
pendente de decisão, porque sem escala confirmada e sem separar linhas
de corte de linhas de construção, qualquer peça seria um palpite.

## Achados que motivaram a delimitação

- Descompressão: o primeiro teste falhou por um byte de fim de linha
  antes de `endstream`, que o descompressor rejeita. A extração agora
  remove esses bytes.
- Ambiente de teste: o pdfkit resolve para o build de navegador dentro
  do vitest e gera cabeçalho zlib inválido. Os PDFs de exemplo foram
  gerados com o build Node e guardados em `formats/fixtures/`.

## Verificação

- Testes: 4 novos (3 do diagnóstico com fixtures reais, 1 da descrição).
  Suíte completa: 260/260.
- Typecheck, lint (1 aviso antigo, não relacionado) e build limpos.
- Electron de produção: o botão "Importar PDF" com o arquivo de exemplo
  mostra a faixa "Este PDF contém desenho vetorial: 239 caminho(s) e 921
  segmento(s) em 1 página(s) de 2145 × 750 mm (escala desconhecida...)".
  Verificado pelo DOM e por captura de tela.
- Na primeira captura a faixa não aparecia porque a imagem estava
  desatualizada (aba Construção). Repetida com espera e checagem da aba
  ativa, ela mostra a aba Encaixe com a faixa visível.

## O que NÃO foi feito

- Importar as peças do PDF de origem (exige escala confirmada e
  separação de linhas de corte).
- Ler nomes das peças (estão como vetor).
- Publicar: aguardando pedido explícito.
