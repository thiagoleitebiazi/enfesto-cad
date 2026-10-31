# ADR 0168 — O tamanho intermediário

O manual da referência tem "Tamanho intermediário" na graduação. Um tamanho novo no programa entrava igual ao base, e as regras dele ficavam por fazer.

**Decisão:** Graduação › "Tamanho intermediário" cria um tamanho depois de outro, em todas as peças que têm os dois, com as regras no meio do caminho entre os vizinhos: os pontos, os piques graduados e os piques internos alinhados.

**Limite:** a média é a dos dois vizinhos, mesmo que a grade não seja igual nos dois lados.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
