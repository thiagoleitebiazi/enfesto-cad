# ADR 0101 — Exportação para plotter (PLT/HPGL)

## Contexto

Fase 1 do estudo de funcionalidades (ADR 0099): o risco em papel, em escala 1:1, sai num plotter. Até aqui as
saídas para a produção eram o PDF 1:1 em folhas e o DXF; o plotter de papel e muitas mesas de corte recebem o
arquivo PLT, escrito em HPGL. O plotter em si é equipamento: não há um aqui, e o programa não fala com ele — gera o
arquivo, que vai para o plotter pelo programa do próprio plotter ou pela rede.

## Decisão

- **Início > Importação e exportação > Exportar PLT** grava `encaixe.plt` com o encaixe como está na mesa.
- HPGL básico, sem comandos próprios de nenhum fabricante: `IN` (inicia), `SP1` (caneta 1), `DT` (terminador do
  rótulo), `PU`/`PD` (caneta levantada/abaixada), `SI` e `LB` (o nome da peça, em letras de 5 mm), e no fim `PU0,0`
  e `SP0` (guarda a caneta).
- Escala 1:1, 40 unidades de plotter por mm (0,025 mm cada). O comprimento do encaixe vai no eixo x (o avanço do
  papel) e a largura no y, como na tela — a mesma troca de eixos do DXF (`mundoParaDxf`, ADR 0096).
- O que vai: o contorno da mesa (quando há enfesto: a largura útil e o comprimento), e de cada peça a linha de
  corte, a costura (quando a peça tem margem), os furos, as linhas internas (abertas), o fio, os piques (o corte reto
  que atravessa a linha de corte, de 1 mm fora a 6 mm dentro, o mesmo do DXF), a aresta de simetria e o nome com o
  tamanho.
- O texto que o plotter escreve é ASCII: os acentos saem sem o sinal ("Calça" → "Calca"), o travessão vira hífen e
  o resto que não é ASCII vira "?".
- O arquivo é registrado no histórico do projeto, como as outras exportações.

## O que não foi feito

- **Não foi testado num plotter físico** (não há um aqui). A saída segue a especificação do HPGL; confira a escala
  no primeiro risco impresso (uma peça de medida conhecida).
- Não há várias canetas (corte × risco), faca, nem comandos de mesa de corte: cada fabricante tem os seus e nenhum
  está disponível para conferir.

## Conferência

- `formats/plt-exportacao.test.ts`: o começo e o fim do arquivo, a escala e os eixos (a mesa e a linha de corte nas
  unidades certas), o fio, o pique, o nome sem acento, a costura junto da linha de corte e a linha interna aberta, e
  o texto para o plotter.
- `ui/BarraDeFerramentas.test.tsx`: o botão no grupo Importação e exportação, chamando a exportação.
- `npx vitest run`: 137 arquivos, 2662 testes passando; `npx eslint .` e `npx tsc -b --noEmit` sem erro;
  `npm run build` gera o programa.
- O teste de uso do repositório, no programa gerado (Windows): a aba Início com Exportar PLT; o PLT gravado,
  começando por `IN;SP1;`, terminando em `PU0,0;SP0;` e com o nome das 3 peças — 18 conferências, nenhuma falha.
  O arquivo gravado foi desenhado de novo numa imagem (lendo os `PU`/`PD`/`LB`): a mesa, as 3 peças nas posições da
  tela, o fio, o pique e os nomes.
