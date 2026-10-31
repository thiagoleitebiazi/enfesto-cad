# ADR 0175 — As teclas de atalho

O manual da referência cria combinações de teclado para as ferramentas, avisa quando a combinação já existe e tem "Nenhuma" para tirar.

**Decisão:** na aba Favoritos, cada ferramenta tem um campo de tecla. A combinação vale com Ctrl, Alt ou uma tecla F, funciona de qualquer aba, fora dos campos de texto. A que já está em uso é recusada, dizendo com quem; Delete tira.

**Limites:** só as ferramentas dos Favoritos têm tecla, não todas. Os atalhos do próprio programa não mudam: a lista dos reservados tem os principais, não todos.

Conferência: testes unitários, `npx eslint` e `npx tsc -b --noEmit`. O programa não foi aberto (pedido do usuário: só testes unitários).
