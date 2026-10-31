# ADR 0195 — As opções do encaixe avançado e o compactar

O manual do encaixe tem, no encaixe automático avançado, "Manter peças encaixadas", "Usar somente peças encaixadas", "Usar espelhamento de peças", "Compactar", "Dobra (Superior / Inferior)" e "Tolerância de giro (máx. 10°)", e um comando "Compactar" que diminui o comprimento.

**Decisão:**

- "Manter no lugar" as peças selecionadas: elas ficam, e as outras se encaixam em volta, sem usar a caixa delas.
- "Usar somente as peças que estão na mesa": as que foram para fora (Ctrl+F) não entram.
- "Usar espelhamento de peças": todas podem sair espelhadas neste encaixe.
- "Compactar", na janela e como botão: cada peça anda para o começo e para cima até encostar, respeitando as áreas bloqueadas e as emendas.
- "Dobra do tecido", superior ou inferior: a peça de simetria encosta na borda escolhida.
- A inclinação do fio vai até 10°, como no manual; antes parava em 5°.

**Limites:** a peça mantida bloqueia a caixa inteira, não só o contorno. Com grupos, o compactar não mexe, para os trechos não misturarem. "Produto" (auto reconhecimento) e os blocos na vertical não foram feitos. O tubular continua usando uma dobra só por encaixe.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
