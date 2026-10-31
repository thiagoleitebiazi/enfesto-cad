# ADR 0149 — Furos, marcas e linhas internas na mesa digitalizadora

O ADR 0144 só copiava da mesa o contorno, os piques e o fio.

**Decisão:** novos botões do cursor.
- 7: ponto de furo; 8: fechar o furo (3 pontos ou mais).
- 9: marca, com um toque.
- 10 (A): ponto de linha interna; 11 (B): terminar a linha (2 pontos ou mais).

Desfazer tira primeiro o último ponto do furo ou da linha aberta. A peça não fecha com um furo ou uma linha aberta. Tudo entra na peça deslocado junto com o contorno.

**Não feito:** a tabela dos botões continua fixa, e os formatos binários de algumas mesas continuam de fora. Não foi testado numa mesa física.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
