# ADR 0161 — Alinhar e distribuir as peças

A apostila da referência tem "Alinhar moldes" no encaixe manual.

**Decisão:** Encaixe › "Alinhar peças" alinha as selecionadas pelo começo, fim ou meio do comprimento, pelo alto, base ou meio da largura, ou distribui com espaços iguais. A conta usa a caixa da linha de corte. Se uma peça cair sobre outra, a validação avisa; Ctrl+Z desfaz.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
