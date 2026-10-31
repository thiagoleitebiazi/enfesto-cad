# ADR 0151 — A troca com o ERP sozinha

No ADR 0141 a troca com o ERP era só pelo botão.

**Decisão:** a caixa "Troca com o ERP" ganha "Trocar sozinho a cada 5 minutos, enquanto esta janela estiver aberta". A troca é a mesma do botão, e não começa se outra ainda está em curso.

**Não feito:** a troca com a janela fechada, porque cada troca importa as ordens do molde aberto no planejamento.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
