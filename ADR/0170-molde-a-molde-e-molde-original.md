# ADR 0170 — Molde a molde e o molde original

O manual da referência tem "Visualizar molde a molde" e "Lembrar molde original".

**Decisão:** no menu Visão, "Próximo molde" e "Molde anterior" selecionam e enquadram a peça vizinha, dando a volta na lista. "Lembrar molde original" mostra tracejado o contorno salvo da peça selecionada, por cima da edição.

**Limite:** o "original" é o da última gravação do projeto. O desenho tracejado não tem teste: só o vizinho tem.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
