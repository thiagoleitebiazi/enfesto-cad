# ADR 0164 — Travar o movimento da peça

A apostila da referência tem "Travar horizontal / vertical" no encaixe.

**Decisão:** com Shift apertado, o arrasto da peça fica reto, no eixo em que ela mais andou (`eixoTravado`). Soltar o Shift no meio devolve o movimento livre.

O arrasto em si não foi exercitado: só a conta tem teste.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
