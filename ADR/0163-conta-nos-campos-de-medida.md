# ADR 0163 — A conta nos campos de medida

A apostila da referência tem uma calculadora, porque a modelista faz conta o tempo todo (o quadril sobre quatro, mais a folga).

**Decisão:** em vez de uma janela à parte, os campos de medida de texto aceitam a conta: "45/2+1", "(80-4)/4", "3x12". Vale para os diálogos das ferramentas. Os campos numéricos do navegador (`type="number"`) continuam só com números.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
