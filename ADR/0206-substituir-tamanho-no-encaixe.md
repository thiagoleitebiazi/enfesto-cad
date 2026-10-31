# ADR 0206 — Substituir o tamanho no encaixe

O manual do encaixe da referência tem "Substituir": troca modelos, moldes ou tamanhos no encaixe. Aqui parecia impossível, porque o encaixe aplicado não guarda a graduação das peças.

**Decisão:** Encaixe › Posicionar › "Substituir tamanho": as peças selecionadas, ou todas de um tamanho, trocam para outro. A peça nova vem da peça graduada de mesmo nome, neste projeto ou em outro da biblioteca, e fica no mesmo lugar e no mesmo giro, com o centro onde estava. Se ficar maior, a validação avisa da sobreposição.

**Limites:** o nome precisa ser igual ao do projeto de moldes. A peça espelhada no encaixe volta sem o espelho, porque a peça não guarda se foi espelhada. Trocar de modelo inteiro não foi feito: aqui é "Unir encaixes".

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
