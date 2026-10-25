# ADR 0117 — As cotas no desenho técnico, ligadas à tabela de medidas

## Contexto

O ADR 0107 deixou em "O que não foi feito": "Não há medidas no desenho, nem ligação dos pontos do croqui com as peças
do molde".

Na ficha técnica de confecção, o croqui costuma ter setas de medida com uma letra (A, B, C…). A letra aponta a linha
da tabela de medidas: o "A" no peito do croqui é o busto, com o valor de cada tamanho. Sem isso, a tabela de medidas
e o desenho ficavam separados, e quem costura a peça-piloto tinha de adivinhar onde se mede "Comprimento total".

## Decisão

**1. A cota, um elemento novo do desenho** (`CotaDoDesenho`):
- **A forma:** uma linha com uma seta em cada ponta e, no meio, o rótulo.
  - O rótulo é a **letra do ponto de medida** da ficha, pela ordem da tabela (A, B, … Z, AA…), num círculo.
  - Sem ponto de medida, o **texto digitado** ("Barra 3 cm"), numa caixa.
- **A letra vem da ordem da tabela.** Subir, descer ou remover um ponto muda a letra no desenho e na tabela juntos.
  Se o ponto ligado sai da tabela, a cota mostra o texto dela ou "?", e as propriedades avisam.
- **A cor** é vermelha (#c62828) e pode ser mudada.
- **A cota não se espelha:** uma medida é uma só.
- **O mesmo desenho em todo lugar:** a geometria (as setas, o rótulo) sai de uma conta só, `geometriaDaCota`. A
  tela, o SVG e o PDF desenham igual.

**2. A ferramenta Cota** na janela do desenho:
- **Dois cliques** fazem a cota. A cota nova liga ao **primeiro ponto de medida da tabela que ainda não tem cota**:
  as cotas seguidas saem A, B, C… Com o ímã (ADR 0116), as pontas param na grade.
- **Com a cota escolhida**, as propriedades mostram:
  - o ponto de medida, numa lista "A — Busto", que marca "(já tem cota)" no ponto que já tem uma;
  - o valor de cada tamanho, para conferir ("Busto (cm): P 96,0 · M 100,0 · G 104,0 · GG 110,0");
  - sem ponto ligado, o campo do texto;
  - a cor.
- **Arrastar** a cota a move; arrastar uma ponta muda só aquela ponta.
- **A ficha sem pontos de medida:** a janela diz onde fazê-los (Ficha técnica › Medidas), e a cota leva o texto.

**3. A letra na tabela de medidas.** Com alguma cota ligada no desenho, a tabela de medidas mostra a letra de cada
ponto: na tela, numa coluna "Cota", e no PDF da ficha, como "A. Busto (na cava)".
- Na tela, a letra com cota vem num círculo vermelho, como no croqui; a sem cota, num círculo cinza.
- Sem cotas, a tabela fica como antes.

**4. Em todo lugar que o croqui aparece**, as cotas vão com a letra:
- a janela do desenho;
- a prévia na ficha;
- o cartão do modelo na coleção;
- o SVG exportado;
- o PDF da ficha;
- a imagem do croqui que vai de referência para a IA.

Os pontos de medida da ficha (`medidas`) foram passados para todos eles.

## O que não foi feito

- **A cota não mede o croqui.** O desenho não está em escala, e o valor é o da tabela de medidas, não o comprimento
  da linha desenhada.
- **A ligação dos pontos do croqui com as peças do molde** continua de fora: o croqui é a ilustração da ficha.
- **A cota é uma reta entre dois pontos.** Não há cota curva (por exemplo, a cava medida pela curva) nem linha de
  chamada separada.

## Conferência

- `domain/desenhoTecnico.test.ts` (+5):
  - as letras (A … Z, AA, AB, AZ, BA);
  - o rótulo ligado, o de ponto que saiu e o de texto;
  - a cota nova no primeiro ponto sem cota;
  - a geometria (as setas para dentro, o círculo da letra, a caixa do texto);
  - pegar, mover, não espelhar, e a leitura do arquivo (a quebrada fica de fora).
- `formats/desenho-exportacao.test.ts` (+1): no SVG, a linha, as quatro setas, a letra no círculo, o texto escapado
  na caixa, e "?" sem as medidas.
- `formats/ficha-exportacao.test.ts` (+1): a tabela de medidas com "A. Busto (na cava)" só com cota; a cor da cota no
  PDF.
- `ui/PainelDoDesenhoTecnico.test.tsx` (+3):
  - dois cliques fazem A e depois B, com os valores e o "(já tem cota)";
  - sem ponto, o texto, e o arrasto da ponta;
  - a ficha sem pontos de medida.
- `ui/PainelDaFichaTecnica.test.tsx` (+1): a coluna Cota com a letra com e sem cota.
- `npx vitest run`: 166 arquivos, 2952 testes passando. `npx eslint .` e `npx tsc -b --noEmit` sem erro;
  `npm run build` gera o programa.
- O teste de uso, no programa gerado: 82 conferências, nenhuma falha, nenhum aviso no console. Duas delas são novas,
  feitas com a tabela de medidas colada da planilha:
  - **dois cliques com a Cota** no peito da camiseta fazem a cota "A" (o busto), e as propriedades mostram
    "Busto (cm): P 96,0 · M 100,0 · G 104,0 · GG 110,0";
  - **na ficha,** a tabela de medidas mostra A em vermelho e B e C em cinza.
