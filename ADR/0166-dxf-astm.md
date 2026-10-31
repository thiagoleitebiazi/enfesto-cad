# ADR 0166 — O DXF no padrão ASTM

O manual da referência exporta "ASTM D6673", o formato que os sistemas de modelagem trocam entre si. O DXF do programa usa camadas com nome.

**Decisão:** Início › "Exportar ASTM" escreve cada peça num bloco, com as camadas por número (1 contorno, 2 cantos, 3 pontos de curva, 4 piques, 6 espelho, 7 fio, 8 linhas internas, 11 recortes, 13 furos de marcação, 14 costura) e os atributos em texto (Piece Name, Size, Quantity, Style Name). Com graduação, sai um bloco por tamanho.

**Não feito:** o arquivo de regras (.RUL): o formato dele não está publicado de forma que dê para conferir. **Limite:** não foi testado em outro sistema; a conferência é a volta pelo importador deste programa, e os textos dos atributos são os usados na prática, não copiados da norma, que é paga.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
